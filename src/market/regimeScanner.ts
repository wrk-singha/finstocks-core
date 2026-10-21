// What web's options regime scanner works out around its table (pages/markets/regimepulse/
// RegimeScanner.tsx and the shared scanner/ScannerTable.tsx, dev 2226a1e1): which rows a search
// and the regime filters keep, the order a sort puts them in, and the status beside the session
// picker. The words stay with each app.
import type {Regime, RegimeRow, RegimeSnapshot} from '../types/regimePulse.ts';
import {
  clockOf,
  REGIME_LABEL,
  REGIME_ORDER,
  REGIME_SHORT,
} from './regimePulse.ts';
import {
  type ScannerSortSpec,
  scannerSortStartsDescending,
  sortScannerRows,
} from './scannerSort.ts';

/**
 * Web's search and filter: a row stays when its regime is one of `regimes` (none picked keeps
 * every regime) and the query, trimmed and case-blind, is part of its symbol, its regime's id, label
 * or short label — so "bear" finds both bearish regimes and "nt-bull" the mild bullish one.
 */
export function filterRegimeRows(
  rows: readonly RegimeRow[],
  query: string,
  regimes: readonly Regime[],
): RegimeRow[] {
  const q = query.trim().toUpperCase();
  return rows.filter(r => {
    if (regimes.length > 0 && !regimes.includes(r.regime)) return false;
    if (!q) return true;
    return (
      r.underlying.includes(q) ||
      r.regime.includes(q) ||
      REGIME_LABEL[r.regime].toUpperCase().includes(q) ||
      REGIME_SHORT[r.regime].toUpperCase().includes(q)
    );
  });
}

/** The columns web's table sorts by, in its column order. */
export const REGIME_SORT_KEYS = [
  'symbol',
  'lastLog',
  'spot',
  'zBias',
  'straddleIv',
  'ivChg',
  'straddleLtp',
  'straddleAtp',
  'chgFromOpen',
  'valueChg',
  'regime',
] as const;

export type RegimeSortKey = (typeof REGIME_SORT_KEYS)[number];

/** Web's table opens sorted by the bias, strongest bullish first. */
export const REGIME_DEFAULT_SORT: RegimeSortKey = 'zBias';

/** Bullish ranks highest; a regime outside the order (warming up) has no rank and sorts last. */
const regimeRank = (row: RegimeRow): number | null => {
  const i = REGIME_ORDER.indexOf(row.regime);
  return i < 0 ? null : -i;
};

const REGIME_SORTS: Readonly<
  Record<RegimeSortKey, ScannerSortSpec<RegimeRow>>
> = {
  symbol: {text: r => r.underlying},
  lastLog: {text: r => r.ts},
  spot: {num: r => r.spot},
  zBias: {num: r => r.z_bias},
  straddleIv: {num: r => r.straddle_iv},
  ivChg: {num: r => r.straddle_iv_chg},
  straddleLtp: {num: r => r.straddle_premium},
  straddleAtp: {num: r => r.straddle_atp},
  chgFromOpen: {num: r => r.straddle_chg},
  valueChg: {num: r => r.atm_ce_value_chg_pct},
  regime: {num: regimeRank},
};

/** A figure starts high-first, text A–Z, as a fresh column does on web. */
export const regimeSortStartsDescending = (key: RegimeSortKey): boolean =>
  scannerSortStartsDescending(REGIME_SORTS[key]);

/**
 * The rows in `key` order, a new array; ties fall back to the symbol A–Z whichever way the sort
 * runs. A missing figure sorts below every number, as web's −∞ does.
 */
export function sortRegimeRows(
  rows: readonly RegimeRow[],
  key: RegimeSortKey,
  isDescending: boolean,
): RegimeRow[] {
  return sortScannerRows(
    rows,
    REGIME_SORTS[key],
    isDescending,
    r => r.underlying,
  );
}

/**
 * What the status beside the session picker says, as web words it: a replayed day; live, with the
 * engine's cycle when the snapshot carries one; the last session's newest reading off-hours; or
 * closed when nothing has been stored.
 */
export type RegimeScannerStatus =
  | {readonly kind: 'replay'; readonly date: string}
  | {readonly kind: 'live'; readonly intervalSec: number | null}
  | {readonly kind: 'lastSession'; readonly at: string}
  | {readonly kind: 'closed'};

export function regimeScannerStatus({
  date,
  isMarketOpen,
  snapshot,
}: {
  /** The replayed trading day; undefined or empty for today's session. */
  readonly date: string | undefined;
  readonly isMarketOpen: boolean;
  readonly snapshot: Pick<RegimeSnapshot, 'interval_sec' | 'as_of'> | undefined;
}): RegimeScannerStatus {
  if (date) return {kind: 'replay', date};
  if (isMarketOpen) {
    const interval = snapshot?.interval_sec ?? 0;
    return {kind: 'live', intervalSec: interval > 0 ? interval : null};
  }
  if (snapshot?.as_of)
    return {kind: 'lastSession', at: clockOf(snapshot.as_of)};
  return {kind: 'closed'};
}
