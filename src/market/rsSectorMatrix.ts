import type {
  RsColumn,
  RsDirection,
  RsIndex,
  RsRankedIndex,
  RsSectorMatrix,
} from '../types/rsSectorMatrix.ts';

// The RS Sector Matrix as the Markets page reads it (web `dev`
// src/components/pages/markets/rssectormatrix/*). Nothing here computes P&F: the backend does, so
// every surface matches the parity-tested port. This is the reading of its answer.

/** Web's default box, with the choices its toggle offers. */
export const RS_DEFAULT_BOX = 0.25;
export const RS_BOXES: readonly number[] = [RS_DEFAULT_BOX, 0.5, 1, 2];

/** The index every sector is read against in the summary tiles. */
export const RS_BENCHMARK = 'NIFTY';

/** How many rows a ranking shows before "Show more". */
export const RS_TOP_N = 10;

/** The last columns the pair route keeps, so a chart's width is bounded. */
export const RS_PAIR_COLUMNS = 40;

export interface RsResult {
  index: RsRankedIndex;
  dir: RsDirection;
}

export const indexName = (data: RsSectorMatrix, symbol: string): string =>
  data.indices.find(ix => ix.symbol === symbol)?.name ?? symbol;

export const resultsAt = (data: RsSectorMatrix, row: number): RsResult[] =>
  data.indices.flatMap((index, j) =>
    j === row ? [] : [{index, dir: data.matrix[row]?.[j] ?? 0}],
  );

/** The others the row is beating, and the ones it is not, in ranking order. */
export function splitResults(
  data: RsSectorMatrix,
  symbol: string,
): {beats: RsRankedIndex[]; losesTo: RsRankedIndex[]} {
  const row = data.indices.findIndex(ix => ix.symbol === symbol);
  const results = row < 0 ? [] : resultsAt(data, row);
  return {
    beats: results.filter(r => r.dir === 1).map(r => r.index),
    losesTo: results.filter(r => r.dir !== 1).map(r => r.index),
  };
}

/** Of the others, how many a row is lagging: the ranking bar's red share. */
export const lossesAt = (data: RsSectorMatrix, row: number): number =>
  (data.matrix[row] ?? []).filter(d => d === -1).length;

/** How many sectors are beating the benchmark, or null when it is not in the matrix. */
export function beatingBenchmark(
  data: RsSectorMatrix,
  benchmark: string = RS_BENCHMARK,
): number | null {
  const at = data.indices.findIndex(ix => ix.symbol === benchmark);
  if (at < 0) return null;
  return data.matrix.filter((r, i) => i !== at && r[at] === 1).length;
}

const SHORT: Record<string, string> = {
  NIFTY: 'N50',
  BANKNIFTY: 'BANK',
  FINNIFTY: 'FIN',
  NIFTYMIDCAP: 'MID',
  NIFTYPHARMA: 'PHAR',
  NIFTYMETAL: 'METL',
  NIFTYREALTY: 'RLTY',
  NIFTYENERGY: 'ENGY',
  NIFTYINFRAST: 'INFR',
  NIFTYPSUBANK: 'PSU',
  NIFTYMIDCAP150: 'M150',
  MIDCPNIFTY: 'MSEL',
  NIFTYSMALL: 'S100',
  NIFTYSMALLCAP250: 'S250',
  NIFTYPVTBANK: 'PVTB',
};

const INDEX_PREFIX = 'NIFTY';

/** The matrix's column heading for an index: a hand-picked short form, else the symbol's tail. */
export function rsShortLabel(symbol: string): string {
  const bare = symbol.startsWith(INDEX_PREFIX)
    ? symbol.slice(INDEX_PREFIX.length)
    : symbol;
  return SHORT[symbol] ?? bare.slice(0, 5);
}

/**
 * Which pair a reader sees: the one picked where both are still in the matrix and differ, else the
 * leader against the laggard (or the laggard against the leader when the laggard was picked), as
 * web's section resolves its `?rs=&vs=` link against the data.
 */
export function resolvePair(
  data: RsSectorMatrix,
  picked: {row: string | null; col: string | null},
): {row: string; col: string} {
  const symbols = data.indices.map(ix => ix.symbol);
  const leader = symbols[0] ?? '';
  const laggard = symbols[symbols.length - 1] ?? leader;
  const opposite = (symbol: string) => (symbol === laggard ? leader : laggard);
  const row =
    picked.row !== null && symbols.includes(picked.row) ? picked.row : leader;
  const col =
    picked.col !== null && symbols.includes(picked.col) && picked.col !== row
      ? picked.col
      : opposite(row);
  return {row, col};
}

/** Choosing a row keeps the column, unless it is the row itself. */
export function pickRow(
  data: RsSectorMatrix,
  symbol: string,
  col: string,
): {row: string; col: string} {
  const symbols = data.indices.map(ix => ix.symbol);
  const leader = symbols[0] ?? '';
  const laggard = symbols[symbols.length - 1] ?? leader;
  const opposite = symbol === laggard ? leader : laggard;
  return {row: symbol, col: symbol === col ? opposite : col};
}

export interface PfSpan {
  dir: 1 | -1;
  /** Lowest and highest box the column fills, in log-box levels. */
  lo: number;
  hi: number;
}

/**
 * Columns in log boxes, because the backend sizes each box as a percentage of the ratio (the
 * quant's px * box_pct), not in fixed points. An X column starts one box above where it reversed
 * from; an O column one box below.
 */
export function pfSpans(
  columns: readonly RsColumn[],
  boxPct: number,
): PfSpan[] {
  const step = Math.log(1 + boxPct / 100);
  const level = (v: number) => Math.round(Math.log(v) / step);
  return columns.map(c => {
    const a = level(c.from);
    const b = level(c.to);
    return c.dir === 1
      ? {dir: 1, lo: a + 1, hi: Math.max(b, a + 1)}
      : {dir: -1, lo: Math.min(b, a - 1), hi: a - 1};
  });
}

/** The box range a chart of these spans covers. */
export function pfExtent(spans: readonly PfSpan[]): {lo: number; hi: number} {
  return {
    lo: Math.min(...spans.map(s => s.lo)),
    hi: Math.max(...spans.map(s => s.hi)),
  };
}

/** How many boxes the last column has filled, at least one. */
export function pfLastColumnBoxes(
  last: RsColumn | undefined,
  boxPct: number,
): number {
  if (last === undefined) return 0;
  return Math.max(
    1,
    Math.round(
      Math.abs(Math.log(last.to / last.from)) / Math.log(1 + boxPct / 100),
    ),
  );
}

/** The ratio's move since the last column began, as a percentage, or null before any column. */
export function pfRatioChange(
  last: RsColumn | undefined,
  lastRatio: number,
): number | null {
  return last === undefined ? null : (lastRatio / last.from - 1) * 100;
}

/** The distinct days a set of stale indices last priced on, for the data notes. */
export const staleDays = (stale: readonly {last_day: string}[]): string[] => [
  ...new Set(stale.map(ix => ix.last_day)),
];

export const namesOf = (indices: readonly RsIndex[]): string =>
  indices.map(ix => ix.name).join(', ');
