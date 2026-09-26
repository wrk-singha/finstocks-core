/**
 * Per-trade maths for the recommendation / strategy report.
 *
 * drift resolved 2026-09-13: mobile won `istYMD`'s parser - it goes through the Hermes-safe
 * date parser (core `parseTimestamp`) where the web used a bare `new Date`, which rejects the
 * backend's "2026-08-31 20:00:24+00" spelling on device.
 */
import {IST, parseTimestamp} from '../format/index.ts';
import type {ClosedTrade, MonthlyPnl} from '../types/market.ts';

/** Per-trade % return from entry/exit price, sign-flipped for shorts. Null if unresolved. */
export const tradeReturnPct = (
  t: Pick<ClosedTrade, 'resolved_price' | 'entry_min' | 'direction'>,
): number | null => {
  if (t.resolved_price == null || t.entry_min === 0) return null;
  const raw = (t.resolved_price - t.entry_min) / t.entry_min;
  return (t.direction === 'short' ? -raw : raw) * 100;
};

const IST_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * IST calendar {y, m(1-12), d} for a stored (UTC) timestamp, so trades bucket on the correct
 * NSE trading day regardless of the source zone.
 */
export function istYMD(iso: string): {y: number; m: number; d: number} | null {
  const dt = parseTimestamp(iso);
  if (!dt) return null;
  const parts = IST_PARTS.formatToParts(dt);
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return {y: g('year'), m: g('month'), d: g('day')};
}

export const istDayOfMonth = (iso: string): number | null =>
  istYMD(iso)?.d ?? null;

/**
 * Below this many closed trades the edge figures (avg win/loss, expectancy, drawdown) are noise
 * dressed as a track record; the report dims them and says so.
 */
export const MIN_EDGE_SAMPLE = 30;

/** The monthly grid shows at most this many months, ending on the last month that has a trade. */
export const MONTHS_SHOWN = 12;

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

export type MonthCell = MonthlyPnl & {readonly label: string};

const monthIndex = (key: string): number => {
  const [y = 0, m = 0] = key.split('-').map(Number);
  return y * 12 + m - 1;
};

/**
 * One cell per calendar month from the first traded month to the last, gaps filled with an empty
 * month so a quiet quarter reads as quiet rather than vanishing; capped to the last `MONTHS_SHOWN`.
 * Input months are ascending "YYYY-MM" keys as the backend sends them.
 */
export function monthlyGrid(months: readonly MonthlyPnl[]): MonthCell[] {
  const first = months[0];
  const last = months[months.length - 1];
  if (first === undefined || last === undefined) return [];
  const byKey = new Map(months.map(m => [m.month, m]));
  const cells: MonthCell[] = [];
  const end = monthIndex(last.month);
  const start = Math.max(monthIndex(first.month), end - MONTHS_SHOWN + 1);
  for (let i = start; i <= end; i++) {
    const date = new Date(Date.UTC(Math.floor(i / 12), i % 12, 1));
    const key = date.toISOString().slice(0, 7);
    cells.push({
      ...(byKey.get(key) ?? {month: key, pnl: 0, trades: 0}),
      label: MONTH_LABEL.format(date),
    });
  }
  return cells;
}
