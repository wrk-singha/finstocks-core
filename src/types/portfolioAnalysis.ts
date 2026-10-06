export interface CapitalSummary {
  /** All capital put in. Always equals priced_invested + unpriced_derivative_value + unpriced_equity_value. */
  deployed: number;
  /** Cost basis of positions that have a live price. */
  priced_invested: number;
  /** Current market value of those same positions. */
  priced_value: number;
  /** Signed: priced_value - priced_invested. Positive means the portfolio is up. */
  unrealized_pnl: number;
  /** Signed, measured against priced_invested. */
  unrealized_pct: number;
  /** Signed. Booked P&L on positions already closed — not part of `deployed`. */
  realized_pnl: number;
  /** >=0. F&O capital with no price data — a data gap, never a loss. */
  unpriced_derivative_value: number;
  unpriced_derivative_symbols: string[];
  /** >=0. Equity capital with no price data — a data gap, never a loss. */
  unpriced_equity_value: number;
  unpriced_symbols: string[];
}

/**
 * "unpriced" is a data gap, not a loss: no mark exists, so the capital's current
 * value is unknown. "drawdown" is a live mark that can still move. Neither may
 * be rendered as a decided loss.
 */
export type FlowTone = 'unpriced' | 'drawdown' | 'live' | 'gain';

export interface CapitalFlowSegment {
  key: string;
  label: string;
  amount: number;
  /** Share of deployed capital. */
  pct: number;
  tone: FlowTone;
}

/** Every deployed rupee in exactly one segment. Empty when nothing is deployed. */
export interface CapitalFlow {
  deployed: number;
  /** The collapsed card's one line: the larger of the two losses, named. */
  summary: string;
  segments: CapitalFlowSegment[];
}

/** How an order reached the book. Mirrors transactions.execution_strategy. */
export type CapitalSourceKey = 'direct' | 'strategy' | 'autopilot';

export interface CapitalSourceRow {
  key: CapitalSourceKey;
  label: string;
  amount: number;
  /** For `deployed`, share of deployed capital; for `unpriced_fno`, share of the unpriced F&O total. */
  pct: number;
}

/**
 * Attribution for deployed capital and for the F&O part that cannot be priced.
 * Null when nothing is deployed; `mixed` is false when every lot came from the
 * same place, and attribution then says nothing worth rendering.
 */
export interface CapitalSources {
  deployed: CapitalSourceRow[];
  unpriced_fno: CapitalSourceRow[];
  strategy_count: number;
  automated_pct: number;
  mixed: boolean;
}

export interface ExposureRow {
  label: string;
  value: number;
  pct: number;
}

/** Industry and market-cap split of priced equity only. Null when none is priced. */
export interface Exposure {
  base: number;
  industries: ExposureRow[];
  market_caps: ExposureRow[];
  largest_position: {symbol: string; value: number; pct: number};
  uncategorized_pct: number;
}

export interface Concentration {
  position_count: number;
  /** Inverse Herfindahl over invested capital: how many bets the book really is. */
  effective_bets: number | null;
  largest: {symbol: string; amount: number; pct: number} | null;
  top_industry: {label: string; pct: number} | null;
  derivative_share_pct: number;
}

export type FindingSeverity = 'critical' | 'warning' | 'positive';
export type FindingTier = 'action' | 'working';
export type FindingActionType =
  'chat_prompt' | 'open_symbol' | 'open_page' | 'exit_position' | 'none';

export interface FindingAction {
  type: FindingActionType;
  label: string;
  /** Present when type === "chat_prompt". */
  prompt?: string | null;
  /** Present when type === "open_symbol" or "exit_position". */
  symbol?: string | null;
  /** Present when type === "open_page": an in-app path such as "/market#sector-strength". */
  path?: string | null;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  tier: FindingTier;
  title: string;
  amount: number | null;
  symbols: string[];
  evidence: string;
  action: FindingAction;
}

export interface ScoreBreakdownEntry {
  label: string;
  /** Null when the portfolio has no data for this dimension. */
  score: number | null;
}

export type HealthLabel =
  | 'Excellent'
  | 'Good'
  | 'Fair'
  | 'Needs Attention'
  | 'Poor'
  | 'N/A'
  | 'Not enough data';

export interface PortfolioAnalysis {
  capital_summary: CapitalSummary;
  capital_flow: CapitalFlow;
  capital_sources: CapitalSources | null;
  exposure: Exposure | null;
  concentration: Concentration | null;
  headline: string;
  /** 2-3 sentence connective read of the portfolio. Absent on analyses saved before this field existed. */
  summary?: string;
  health_score: number | null;
  health_label: HealthLabel;
  score_breakdown: ScoreBreakdownEntry[];
  findings: Finding[];
  /** The single biggest structural lever, phrased as a noun never an instruction — "" when none
   *  stands out. Absent on older saved analyses. */
  consider?: string;
}

/**
 * One held position's P&L, straight from the snapshot — not the model's pick.
 * Exhaustive (every position), unlike `findings` which is a curated subset;
 * this is what a "which stock is dragging me down" / holdings table needs.
 */
export interface PortfolioAnalysisPosition {
  symbol: string;
  invested_value: number;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  priced: boolean;
}

export interface PortfolioAnalysisResponse {
  user_id: number;
  analysis: PortfolioAnalysis;
  computed_at: string;
  cached: boolean;
}
