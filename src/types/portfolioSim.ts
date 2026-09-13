/**
 * `type:"portfolio_sim"` card payload (MCS schema v2).
 *
 * Emitted by the LLM's Monte-Carlo portfolio lane (graph/mcs) on
 * `job_completed.data.cards[]` when a bare-amount "grow my money" ask routes
 * through the portfolio node. The shape is frozen server-side
 * (llm/graph/mcs/payload.py `build_portfolio_sim_payload`); mirror it exactly.
 * All monetary fields are rupee values; percentages are whole-number percents.
 */

export interface PortfolioSimHolding {
  symbol: string;
  kind: string;
  name: string;
  sub: string;
  weight_pct: number;
  amount: number;
}

export interface PortfolioSimBasket {
  key: string;
  label: string;
  risk_label: string;
  why: string;
  n_label: string;
  weight_pct: number;
  amount: number;
  holdings: PortfolioSimHolding[];
}

export interface PortfolioSimSamplePath {
  /** "median" | "optimistic" | "pessimistic", or any label the server adds later. */
  kind: string;
  values: number[];
}

export interface PortfolioSimFanChart {
  months: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  sample_paths: PortfolioSimSamplePath[];
}

export interface PortfolioSimComparison {
  months: number[];
  portfolio_p50: number[];
  nifty50: number[];
  fd: number[];
  fd_rate_pct: number;
  gold: number[];
  gold_cagr_pct: number;
}

export interface PortfolioSimOutcomes {
  worst_10pct: number;
  most_likely: number;
  best_10pct: number;
  beats_fd_pct: number;
  loss_pct: number;
}

export interface PortfolioSimAction {
  id: string;
  label: string;
  display_only: boolean;
}

export interface PortfolioSimPayload {
  schema_version: number;
  as_of: string | null;
  generated_at: string | null;
  seed: number;
  n_paths: number;
  investment_amount: number;
  risk_profile: string;
  horizon_years: number;
  allocation: {baskets: PortfolioSimBasket[]};
  fan_chart: PortfolioSimFanChart;
  comparison: PortfolioSimComparison;
  outcomes: PortfolioSimOutcomes;
  insight: string;
  actions: PortfolioSimAction[];
  assumptions: string[];
  data_notes: string[];
}

/** The `portfolio_sim` typed-card variant (not in the shared ChatCard union). */
export interface PortfolioSimCardData {
  type: 'portfolio_sim';
  investment_amount?: number;
  payload: PortfolioSimPayload;
}
