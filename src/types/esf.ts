/** The four parts the FinStocks Score blends, each 0–100. */
export interface EsfPillars {
  earnings: number;
  momentum: number;
  quality: number;
  institutional: number;
}

/** Raw /api/esf/score shape: one stock's FinStocks Score as of a close. */
export interface EsfScore {
  symbol: string;
  /** The trading day the scores are from (YYYY-MM-DD). */
  as_of: string;
  universe_size: number;
  /** 0–100. */
  score: number;
  rank: number;
  /** Rank as a share of the universe: 1.4 means the top 1.4%. */
  top_pct: number;
  stage: string | null;
  warnings: string[];
  pillars: EsfPillars;
}
