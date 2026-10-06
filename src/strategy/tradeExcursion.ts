/**
 * MAE, MFE and exit efficiency of a trade, from the candles it was open through (web
 * feat/chart-parity 76f1dfee, 564c3b99). The entry and exit candles count whole: a candle can't
 * say whether its extreme came before or after the fill inside it.
 */
import type {RoundTrip} from './roundTrips.ts';

export interface ExcursionBar {
  /** Start of the candle, a true instant (epoch ms). */
  time: number;
  high: number;
  low: number;
}

export interface Excursion {
  /** Per unit, always ≥ 0. */
  maePerUnit: number;
  mfePerUnit: number;
  /** For the whole quantity, rupees, ≥ 0. */
  mae: number;
  mfe: number;
  /** Of the entry price. */
  maePct: number;
  mfePct: number;
  /** The best possible exit: the most favourable price while open, and when it traded (candle start, ms). */
  bestExitPrice: number;
  bestExitMs: number;
  /** The worst price while open, and when. */
  worstPrice: number;
  worstMs: number;
  /** 0–100: where the exit sits between the worst and best price while open. Null while open, or when price never moved. */
  efficiencyPct: number | null;
  /** Candles the figures were read from. */
  bars: number;
  /** Still open: the figures run to the last candle, not to an exit. */
  open: boolean;
}

export type ExcursionRefusal =
  'no-candles' | 'entry-off-candles' | 'exit-off-candles';

export type ExcursionResult =
  | {ok: true; excursion: Excursion}
  | {
      ok: false;
      reason: ExcursionRefusal;
      detail?: {price: number; low: number; high: number};
    };

/** How far outside a candle's range a recorded price may sit and still be the same market (ticks, rounding). */
export const PRICE_TOLERANCE = 0.005;

const within = (price: number, low: number, high: number): boolean =>
  price >= low * (1 - PRICE_TOLERANCE) && price <= high * (1 + PRICE_TOLERANCE);

/** Index of the first candle ending after `ms` (the one holding it, or the next after a gap); -1 when none. */
function firstEndingAfter(
  bars: readonly ExcursionBar[],
  barMs: number,
  ms: number,
): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((bars[mid]?.time ?? 0) + barMs <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo < bars.length ? lo : -1;
}

/** Index of the last candle starting at or before `ms`; -1 when none. */
function lastStartingBy(bars: readonly ExcursionBar[], ms: number): number {
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((bars[mid]?.time ?? 0) <= ms) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

type ExcursionTrip = Pick<
  RoundTrip,
  'side' | 'qty' | 'entryMs' | 'entryPrice' | 'exitMs' | 'exitPrice'
>;

/**
 * Excursion for one trade over ascending `bars` of `barMs`. Refuses when the recorded entry or
 * exit sits outside its candle: the trade was priced on other data.
 */
export function tradeExcursion(
  trip: ExcursionTrip,
  bars: readonly ExcursionBar[],
  barMs: number,
): ExcursionResult {
  const firstBar = bars[0];
  if (firstBar === undefined) return {ok: false, reason: 'no-candles'};
  const first = firstEndingAfter(bars, barMs, trip.entryMs);
  if (first < 0 || firstBar.time > trip.entryMs) {
    return {ok: false, reason: 'no-candles'};
  }
  const exitMs = trip.exitMs;
  const exitPrice = trip.exitPrice;
  const open = exitMs == null || exitPrice == null;
  const last = open ? bars.length - 1 : lastStartingBy(bars, exitMs);
  const entryBar = bars[first];
  const lastBar = bars[last];
  if (last < first || entryBar === undefined || lastBar === undefined) {
    return {ok: false, reason: 'no-candles'};
  }

  if (
    entryBar.time <= trip.entryMs &&
    !within(trip.entryPrice, entryBar.low, entryBar.high)
  ) {
    return {
      ok: false,
      reason: 'entry-off-candles',
      detail: {price: trip.entryPrice, low: entryBar.low, high: entryBar.high},
    };
  }
  if (
    !open &&
    exitMs < lastBar.time + barMs &&
    !within(exitPrice, lastBar.low, lastBar.high)
  ) {
    return {
      ok: false,
      reason: 'exit-off-candles',
      detail: {price: exitPrice, low: lastBar.low, high: lastBar.high},
    };
  }

  let high = trip.entryPrice;
  let highMs = trip.entryMs;
  let low = trip.entryPrice;
  let lowMs = trip.entryMs;
  for (let i = first; i <= last; i += 1) {
    const b = bars[i];
    if (b === undefined) continue;
    if (b.high > high) {
      high = b.high;
      highMs = b.time;
    }
    if (b.low < low) {
      low = b.low;
      lowMs = b.time;
    }
  }
  if (!open) {
    if (exitPrice > high) {
      high = exitPrice;
      highMs = exitMs;
    }
    if (exitPrice < low) {
      low = exitPrice;
      lowMs = exitMs;
    }
  }

  const long = trip.side === 'long';
  const mfePerUnit = Math.max(
    0,
    long ? high - trip.entryPrice : trip.entryPrice - low,
  );
  const maePerUnit = Math.max(
    0,
    long ? trip.entryPrice - low : high - trip.entryPrice,
  );
  const qty = Math.abs(trip.qty) || 0;
  const range = high - low;
  return {
    ok: true,
    excursion: {
      maePerUnit,
      mfePerUnit,
      mae: maePerUnit * qty,
      mfe: mfePerUnit * qty,
      maePct: (maePerUnit / trip.entryPrice) * 100,
      mfePct: (mfePerUnit / trip.entryPrice) * 100,
      bestExitPrice: long ? high : low,
      bestExitMs: long ? highMs : lowMs,
      worstPrice: long ? low : high,
      worstMs: long ? lowMs : highMs,
      efficiencyPct:
        open || !(range > 0)
          ? null
          : ((long ? exitPrice - low : high - exitPrice) / range) * 100,
      bars: last - first + 1,
      open,
    },
  };
}

export interface TripExcursion {
  /** The candles read: 1-minute, or daily for trades older than the minute history. */
  basis: '1m' | '1d';
  result: ExcursionResult;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Excursions per trade: minute candles where they reach the entry, else daily; uncovered trades left out. */
export function tripExcursions(
  trips: readonly (ExcursionTrip & Pick<RoundTrip, 'id'>)[],
  minute: readonly ExcursionBar[],
  daily: readonly ExcursionBar[],
): Map<string, TripExcursion> {
  const out = new Map<string, TripExcursion>();
  const firstMinute = minute[0];
  const firstDay = daily[0];
  for (const trip of trips) {
    if (firstMinute !== undefined && firstMinute.time <= trip.entryMs) {
      out.set(trip.id, {
        basis: '1m',
        result: tradeExcursion(trip, minute, MINUTE_MS),
      });
    } else if (firstDay !== undefined && firstDay.time <= trip.entryMs) {
      out.set(trip.id, {
        basis: '1d',
        result: tradeExcursion(trip, daily, DAY_MS),
      });
    }
  }
  return out;
}
