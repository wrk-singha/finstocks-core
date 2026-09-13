/**
 * Per-trade maths for the recommendation / strategy report.
 *
 * drift resolved 2026-09-13: mobile won `istYMD`'s parser - it goes through the Hermes-safe
 * date parser (core `parseTimestamp`) where the web used a bare `new Date`, which rejects the
 * backend's "2026-08-31 20:00:24+00" spelling on device.
 */
import {IST, parseTimestamp} from '../format/index.ts';
import type {ClosedTrade} from '../types/market.ts';

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
