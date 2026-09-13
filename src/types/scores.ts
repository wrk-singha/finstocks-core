import type {StockScore, StockScorePillar} from './market.ts';

/** Raw /api/market/score shape. `mapStockScore` turns it into `StockScore`. */
export interface StockScoreResponse {
  symbol: string;
  composite_score: number;
  verdict: string;
  conviction_pct: number;
  rationale: string;
  valuation_score: number;
  financials_score: number;
  technicals_score: number;
  ownership_score: number;
  pillar_details: Record<string, Record<string, number>>;
  industry: string;
  sector_rank: number | null;
  sector_total: number | null;
  computed_at: string;
}

// drift resolved 2026-09-13: the mobile named the raw shape `StockScoreApi` and the
// mapped one `StockScoreDisplay`/`ScorePillar`; the web's names are canonical and
// these aliases keep the mobile spellings valid.
export type StockScoreApi = StockScoreResponse;
export type StockScoreDisplay = StockScore;
export type ScorePillar = StockScorePillar;
