// RS Sector Matrix: the shapes served by backend-go/handlers/rssectormatrix (see its README.md),
// as web `dev` declares them in src/interfaces/rsSectorMatrix.ts.

/** P&F direction of one index's price ratio against another: 1 = X column (beating), -1 = O column (lagging). */
export type RsDirection = 1 | 0 | -1;

export interface RsIndex {
  symbol: string;
  name: string;
}

export interface RsRankedIndex extends RsIndex {
  /** Other indices this one is currently beating. */
  score: number;
}

export interface RsStaleIndex extends RsIndex {
  last_day: string;
}

export interface RsFlip {
  leader: string;
  laggard: string;
  day: string;
}

/** GET /api/market/rs-sector-matrix */
export interface RsSectorMatrix {
  as_of: string;
  box_pct: number;
  reversal: number;
  lookback_years: number;
  /** Last closed before as_of, so left out of every comparison. */
  stale: RsStaleIndex[];
  /** Never priced, so left out of every comparison. */
  missing: RsIndex[];
  /** Every index closed on as_of. Most wins first; matrix[i][j] is indices[i] measured against indices[j]. */
  indices: RsRankedIndex[];
  matrix: RsDirection[][];
  latest_flip: RsFlip | null;
}

export interface RsColumn {
  dir: 1 | -1;
  from: number;
  to: number;
  start: string;
  end: string;
}

/** GET /api/market/rs-sector-matrix/pair */
export interface RsPair {
  row: string;
  col: string;
  dir: RsDirection;
  total_columns: number;
  columns: RsColumn[];
  column_sessions: number;
  last_day: string;
  last_ratio: number;
}
