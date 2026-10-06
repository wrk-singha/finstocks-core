// The journal's filters and summary figures (web feat/chart-parity 76f1dfee). Realised P&L only:
// counting an open trade's mark would make yesterday's summary move with today's price.
import {istDayKey} from '../format/date.ts';
import {IST_OFFSET_MS, type RoundTrip, type TripSource} from './roundTrips.ts';

export interface JournalFilter {
  /** Upper-case symbol, or null for every symbol. */
  symbol: string | null;
  /** IST calendar days, inclusive (`YYYY-MM-DD`), or null for no bound. */
  from: string | null;
  to: string | null;
  side: 'all' | 'long' | 'short';
  source: 'all' | Exclude<TripSource, 'backtest'>;
}

/** The IST calendar day an instant falls on (`YYYY-MM-DD`). */
export const istDay = (ms: number): string => istDayKey(new Date(ms));

/** The IST clock hour (0–23) an instant falls in. */
export const istHour = (ms: number): number =>
  new Date(ms + IST_OFFSET_MS).getUTCHours();

export function filterTrips(
  trips: readonly RoundTrip[],
  f: JournalFilter,
): RoundTrip[] {
  return trips.filter(t => {
    if (f.symbol && t.symbol !== f.symbol) return false;
    if (f.side !== 'all' && t.side !== f.side) return false;
    if (f.source !== 'all' && t.source !== f.source) return false;
    const day = istDay(t.entryMs);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    return true;
  });
}

export interface BucketStats {
  trades: number;
  wins: number;
  /** 0–100. */
  winRate: number;
  net: number;
  /** Mean P&L per trade. */
  avg: number;
}

export interface HourStats extends BucketStats {
  /** IST clock hour the trades were entered in. */
  hour: number;
}

export interface JournalStats extends BucketStats {
  losses: number;
  avgWin: number;
  /** Mean losing trade, as a positive rupee figure (0 with no losers). */
  avgLoss: number;
  /** Mean P&L per trade — what a trade is worth on average. Same as `avg`. */
  expectancy: number;
  /** Expectancy in units of the average loss (1R = avgLoss); null with no losers. */
  avgR: number | null;
  /** Gross profit ÷ gross loss; null with no losers. */
  profitFactor: number | null;
  /** Every entry hour that had a trade, in clock order. */
  hours: HourStats[];
  /** Best and worst by average P&L, among hours with at least MIN_TRADES_PER_HOUR trades. */
  bestHour: HourStats | null;
  worstHour: HourStats | null;
  /** Trades entered on an expiry day, and on the other days; null when no calendar was given. */
  expiry: {on: BucketStats; off: BucketStats; unknown: number} | null;
}

/** An hour is ranked only with this many trades in it: one lucky trade is not a best hour. */
export const MIN_TRADES_PER_HOUR = 2;

function bucket(trips: readonly RoundTrip[]): BucketStats {
  let wins = 0;
  let net = 0;
  for (const t of trips) {
    const pnl = t.pnl ?? 0;
    net += pnl;
    if (pnl > 0) wins += 1;
  }
  const trades = trips.length;
  return {
    trades,
    wins,
    winRate: trades ? (wins / trades) * 100 : 0,
    net,
    avg: trades ? net / trades : 0,
  };
}

/**
 * Summary figures over the closed trips given.
 *
 * `isExpiryDay(day, trip)` answers for a trip's entry day (IST); it returns null when it cannot
 * know (a day outside the calendar it has), and such trips are counted apart rather than guessed
 * into "other days".
 */
export function journalStats(
  trips: readonly RoundTrip[],
  isExpiryDay?: (day: string, trip: RoundTrip) => boolean | null,
): JournalStats {
  const closed = trips.filter(t => t.pnl != null && t.exitMs != null);
  const all = bucket(closed);
  const pnlOf = (t: RoundTrip): number => t.pnl ?? 0;
  const winners = closed.filter(t => pnlOf(t) > 0);
  const losers = closed.filter(t => pnlOf(t) < 0);
  const grossWin = winners.reduce((s, t) => s + pnlOf(t), 0);
  const grossLoss = -losers.reduce((s, t) => s + pnlOf(t), 0);
  const avgWin = winners.length ? grossWin / winners.length : 0;
  const avgLoss = losers.length ? grossLoss / losers.length : 0;

  const byHour = new Map<number, RoundTrip[]>();
  for (const t of closed) {
    const h = istHour(t.entryMs);
    byHour.set(h, [...(byHour.get(h) ?? []), t]);
  }
  const hours: HourStats[] = [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, list]) => ({hour, ...bucket(list)}));
  const ranked = hours.filter(h => h.trades >= MIN_TRADES_PER_HOUR);
  const bestHour = ranked.reduce<HourStats | null>(
    (b, h) => (b === null || h.avg > b.avg ? h : b),
    null,
  );
  const worstHour =
    ranked.length > 1
      ? ranked.reduce<HourStats | null>(
          (w, h) => (w === null || h.avg < w.avg ? h : w),
          null,
        )
      : null;

  let expiry: JournalStats['expiry'] = null;
  if (isExpiryDay) {
    const on: RoundTrip[] = [];
    const off: RoundTrip[] = [];
    let unknown = 0;
    for (const t of closed) {
      const answer = isExpiryDay(istDay(t.entryMs), t);
      if (answer === null) unknown += 1;
      else (answer ? on : off).push(t);
    }
    expiry = {on: bucket(on), off: bucket(off), unknown};
  }

  return {
    ...all,
    losses: losers.length,
    avgWin,
    avgLoss,
    expectancy: all.avg,
    avgR: avgLoss > 0 ? all.avg / avgLoss : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
    hours,
    bestHour,
    worstHour:
      worstHour !== null && worstHour.hour === bestHour?.hour
        ? null
        : worstHour,
    expiry,
  };
}

/** "10:00–11:00" for an IST clock hour. */
export const hourLabel = (hour: number): string =>
  `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`;
