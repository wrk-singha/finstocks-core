// What web's options direction scanner works out around its table (pages/markets/flyone/
// DirectionScanner.tsx and DirectionScannerTable.tsx, dev 2226a1e1): which chains the universe
// toggle keeps, the breadth it counts, its five presets, the search under the direction filters,
// the sortable columns, the regime disagreement it marks, and the status beside the session
// picker. The words stay with each app.
import {isIndexSymbol} from '../data/stocksData.ts';
import type {
  FlyoneDirection,
  FlyoneRow,
  FlyoneSnapshot,
} from '../types/flyone.ts';
import type {Regime, RegimeRow} from '../types/regimePulse.ts';
import {
  DIRECTION_ORDER,
  directionSide,
  disagreesWithRegime,
  gexTone,
  isWarmingUp,
  pctAway,
} from './flyone.ts';
import {regimeScannerStatus} from './regimeScanner.ts';
import {
  type ScannerSortSpec,
  scannerSortStartsDescending,
  sortScannerRows,
} from './scannerSort.ts';

/** Web's universe toggle: every chain, the indices, or the stocks. */
export type DirectionUniverse = 'all' | 'index' | 'stock';

export const DIRECTION_UNIVERSES: readonly DirectionUniverse[] = [
  'all',
  'index',
  'stock',
];

/** Whether an underlying is in the universe, with SENSEX and BANKEX among the indices (web 0b090599). */
export const inDirectionUniverse = (
  underlying: string,
  universe: DirectionUniverse,
): boolean =>
  universe === 'all'
    ? true
    : universe === 'index'
      ? isIndexSymbol(underlying)
      : !isIndexSymbol(underlying);

/** The chains the universe toggle keeps, in the snapshot's order. */
export const directionUniverseRows = (
  rows: readonly FlyoneRow[],
  universe: DirectionUniverse,
): FlyoneRow[] =>
  universe === 'all'
    ? [...rows]
    : rows.filter(r => inDirectionUniverse(r.underlying, universe));

/**
 * The header's two cards over the universe: how many chains sit on each call (a chain still warming
 * up is in none of them, only in `warming`), and how many are in a calm or a fast dealer regime;
 * the rest, those balanced or with no regime, are `balanced`, as web subtracts them.
 */
export type DirectionBreadth = {
  readonly counts: Readonly<Record<FlyoneDirection, number>>;
  readonly total: number;
  readonly warming: number;
  /** Chains with a call: every one not warming up. */
  readonly called: number;
  readonly calm: number;
  readonly fast: number;
  readonly balanced: number;
};

export function directionBreadth(rows: readonly FlyoneRow[]): DirectionBreadth {
  const counts: Record<FlyoneDirection, number> = {
    BULLISH: 0,
    LEAN_BULLISH: 0,
    NEUTRAL: 0,
    LEAN_BEARISH: 0,
    BEARISH: 0,
  };
  let warming = 0;
  let calm = 0;
  let fast = 0;
  for (const r of rows) {
    if (isWarmingUp(r)) warming += 1;
    else counts[r.direction] += 1;
    const tone = gexTone(r.gex_regime);
    if (tone === 'calm') calm += 1;
    if (tone === 'fast') fast += 1;
  }
  const total = rows.length;
  return {
    counts,
    total,
    warming,
    called: total - warming,
    calm,
    fast,
    balanced: total - calm - fast,
  };
}

/**
 * The scanner's "!": the call reads the name the other way from its options regime. A chain still
 * warming up has made no call, so it disagrees with nothing.
 */
export const clashesWithRegime = (
  row: Pick<FlyoneRow, 'direction' | 'direction_raw'>,
  regime: Regime | undefined,
): boolean => !isWarmingUp(row) && disagreesWithRegime(row.direction, regime);

/** Spot within this percent of either wall is "near a wall". */
export const NEAR_WALL_PCT = 0.5;

export type DirectionPresetKey =
  'bull_calm' | 'bear_fast' | 'near_wall' | 'confirmed' | 'clash';

export type DirectionPreset = {
  readonly key: DirectionPresetKey;
  /** Whether a chain passes, given the options regime of the same name (if it has one). */
  readonly test: (row: FlyoneRow, regime: Regime | undefined) => boolean;
};

const isNearWall = (row: FlyoneRow): boolean => {
  const call = pctAway(row.spot, row.call_wall);
  const put = pctAway(row.spot, row.put_wall);
  return (
    (call != null && Math.abs(call) <= NEAR_WALL_PCT) ||
    (put != null && Math.abs(put) <= NEAR_WALL_PCT)
  );
};

/** Web's five presets, in its order; each app words their labels and hints. */
export const DIRECTION_PRESETS: readonly DirectionPreset[] = [
  {key: 'bull_calm', test: r => r.score > 0 && (r.ngex ?? 0) > 0},
  {
    key: 'bear_fast',
    test: r =>
      directionSide(r.direction) < 0 && gexTone(r.gex_regime) === 'fast',
  },
  {key: 'near_wall', test: isNearWall},
  {
    key: 'confirmed',
    test: r => r.pattern === 'BULL_CONFIRM' || r.pattern === 'BEAR_CONFIRM',
  },
  {key: 'clash', test: (r, regime) => clashesWithRegime(r, regime)},
];

export const directionPreset = (
  key: DirectionPresetKey,
): DirectionPreset | undefined => DIRECTION_PRESETS.find(p => p.key === key);

/**
 * Web's filter under the table: with directions picked, a chain stays when it has made one of those
 * calls (one warming up has made none); a preset keeps the chains its test passes, joined to the
 * options regime of the same name; and the query, trimmed and case-blind, is part of the symbol.
 */
export function filterDirectionRows(
  rows: readonly FlyoneRow[],
  {
    query,
    directions,
    preset,
    regimes,
  }: {
    readonly query: string;
    readonly directions: readonly FlyoneDirection[];
    readonly preset: DirectionPresetKey | null;
    /** The options regime by underlying, as the regime snapshot keys its rows. */
    readonly regimes: Readonly<Record<string, Pick<RegimeRow, 'regime'>>>;
  },
): FlyoneRow[] {
  const q = query.trim().toUpperCase();
  const test = preset === null ? undefined : directionPreset(preset)?.test;
  return rows.filter(r => {
    if (
      directions.length > 0 &&
      (isWarmingUp(r) || !directions.includes(r.direction))
    )
      return false;
    if (test !== undefined && !test(r, regimes[r.underlying]?.regime))
      return false;
    return !q || r.underlying.includes(q);
  });
}

/** The columns web's table sorts by, in its column order; the regime column does not sort. */
export const DIRECTION_SORT_KEYS = [
  'symbol',
  'spot',
  'direction',
  'score',
  'read',
  'support',
  'gammaFlip',
  'resistance',
  'dealers',
  'sigma',
] as const;

export type DirectionSortKey = (typeof DIRECTION_SORT_KEYS)[number];

/** Web's table opens sorted by the score, most bullish first. */
export const DIRECTION_DEFAULT_SORT: DirectionSortKey = 'score';

const DIRECTION_SORTS: Readonly<
  Record<DirectionSortKey, ScannerSortSpec<FlyoneRow>>
> = {
  symbol: {text: r => r.underlying},
  spot: {num: r => r.spot},
  direction: {num: r => -DIRECTION_ORDER.indexOf(r.direction)},
  score: {num: r => r.score},
  read: {text: r => r.pattern},
  support: {num: r => r.put_wall},
  gammaFlip: {num: r => r.gamma_flip},
  resistance: {num: r => r.call_wall},
  dealers: {num: r => r.ngex},
  sigma: {num: r => r.sigma_pts},
};

/** A figure starts high-first, text A–Z, as a fresh column does on web. */
export const directionSortStartsDescending = (key: DirectionSortKey): boolean =>
  scannerSortStartsDescending(DIRECTION_SORTS[key]);

/**
 * The rows in `key` order, a new array; ties fall back to the symbol A–Z whichever way the sort
 * runs, and a missing level sorts below every number. "Read" sorts by the pattern's id, as web's
 * column does.
 */
export function sortDirectionRows(
  rows: readonly FlyoneRow[],
  key: DirectionSortKey,
  isDescending: boolean,
): FlyoneRow[] {
  return sortScannerRows(
    rows,
    DIRECTION_SORTS[key],
    isDescending,
    r => r.underlying,
  );
}

/**
 * What the status beside the session picker says, as web's direction scanner words it: a replayed
 * day; live, with the engine's cycle when the snapshot carries one; off-hours, the day and time of
 * the last session's newest reading; or closed when nothing has been stored.
 */
export type DirectionScannerStatus =
  | {readonly kind: 'replay'; readonly date: string}
  | {readonly kind: 'live'; readonly intervalSec: number | null}
  | {readonly kind: 'lastSession'; readonly day: string; readonly at: string}
  | {readonly kind: 'closed'};

export function directionScannerStatus({
  date,
  isMarketOpen,
  snapshot,
}: {
  /** The replayed trading day; undefined or empty for the latest session. */
  readonly date: string | undefined;
  readonly isMarketOpen: boolean;
  readonly snapshot:
    Pick<FlyoneSnapshot, 'interval_sec' | 'as_of' | 'date'> | undefined;
}): DirectionScannerStatus {
  const status = regimeScannerStatus({date, isMarketOpen, snapshot});
  return status.kind === 'lastSession'
    ? {kind: 'lastSession', day: snapshot?.date ?? '', at: status.at}
    : status;
}
