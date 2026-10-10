// GET /api/templates/strategy-library — the black-box strategy library on the Strategy Templates
// page (backend-go main internal/strategylibrary and internal/services/librarylive, web main
// src/interfaces/strategyLibrary.ts). The server sends a strategy's shape and a theme-level
// description only: its entry and exit conditions are never part of this payload, nor where it
// came from (that is the LLM-key route's, which an app never calls).

export type LibraryStyle =
  | 'premium_selling'
  | 'income'
  | 'trend_following'
  | 'momentum'
  | 'mean_reversion'
  | 'breakout'
  | 'volatility_long'
  | 'hedged_directional'
  | 'arbitrage'
  | 'market_making'
  | 'relative_value'
  | 'calendar'
  | 'allocation'
  | 'execution';

export type LibrarySegment =
  | 'index_options'
  | 'stock_options'
  | 'equity_cash'
  | 'index_futures'
  | 'stock_futures'
  | 'cash_and_futures'
  | 'multi';

export type LibraryHorizon = 'intraday' | 'swing' | 'positional';
export type LibraryDirection = 'long' | 'short' | 'both' | 'neutral';
export type LibraryComplexity = 'simple' | 'moderate' | 'advanced';
/** `reference` strategies are listed for completeness but are not deployable. */
export type LibraryAvailability = 'available' | 'reference';

export type LibraryExchangeCategory =
  'alpha_seeking' | 'arbitrage' | 'high_frequency' | 'scalping' | 'others';

export interface LibraryStrategy {
  id: string;
  /** The name as it reads in a URL; the strategy routes take it or the id. */
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  highlights: string[];
  style: LibraryStyle;
  segment: LibrarySegment;
  instruments: string[];
  is_fno: boolean;
  horizon: LibraryHorizon;
  holding_period: string;
  trade_frequency: string;
  direction: LibraryDirection;
  structure: string;
  max_open_positions: number | null;
  /** 1 (low) to 6 (very high), on the SEBI riskometer's six steps. */
  risk_level: number;
  risk_note: string;
  risk_capped: boolean;
  protective_exit: boolean;
  holds_overnight: boolean;
  capital_note: string | null;
  suits: string[];
  struggles: string[];
  complexity: LibraryComplexity;
  availability: LibraryAvailability;
  availability_note: string | null;
  /** NSE's black-box strategy category, filed with the exchange. */
  exchange_category: LibraryExchangeCategory;
  /** Rules are frozen per version: a logic change registers a new version. */
  version: number;
  /** A published (hypothetical) backtest exists; the templates page lists only these. */
  has_backtest: boolean;
  /** The backtest's headline, worked out by the server from its whole curve; null without one. */
  backtest_summary: LibraryBacktestSummary | null;
}

/** The headline of a backtest, as fractions: 0.214 is +21.4% a year, -0.18 an 18% drawdown. */
export interface LibraryBacktestSummary {
  annual_return: number;
  max_drawdown: number;
}

/** Set on a position that profits from a fall; a long one carries no side. */
export type LibraryTradeSide = 'short';

/** One position of a backtest: what happened, never why (no signal, score or reason). */
export interface LibraryBacktestTrade {
  symbol: string;
  side?: LibraryTradeSide;
  entry_date: string;
  /** Empty while the position is still open; `exit_price` is then the last close. */
  exit_date: string;
  entry_price: number;
  exit_price: number;
  /** In percent: 30.6 is +30.6%. */
  return_pct: number;
}

/** One day of the equity curve and its benchmark, both normalised to 1 on the first day. */
export interface LibraryBacktestDay {
  date: string;
  nav: number;
  benchmark: number;
}

/** A hypothetical result: an equity curve against a benchmark, and the trades behind it. */
export interface LibraryBacktest {
  /** "Hypothetical backtest". */
  label: string;
  window_start: string;
  window_end: string;
  /** The index the curve is measured against, by name ("NIFTY 50"). */
  benchmark: string;
  daily: LibraryBacktestDay[];
  trades: LibraryBacktestTrade[];
}

/** GET /api/templates/strategy-library */
export interface StrategyLibraryResponse {
  strategies: LibraryStrategy[];
  total: number;
}

/**
 * GET /api/templates/strategy-library/{slug or id} — `backtest` is null for a strategy without
 * published results. 404 for an unknown key.
 */
export interface StrategyLibraryDetailResponse {
  strategy: LibraryStrategy;
  backtest: LibraryBacktest | null;
}

/**
 * One trade of a session. `return_pct` is the closed trade's return for a sell, and the position's
 * return at `last` for a buy. `last` is left out when the server has none.
 */
export interface LibraryFill {
  symbol: string;
  side?: LibraryTradeSide;
  price: number;
  last?: number;
  return_pct: number;
}

/**
 * The positions a strategy's simulation opened (`buys`) and closed (`sells`) on its latest
 * session. `live` while that session is newer than the stored backtest (still trading, or not yet
 * replayed into it); otherwise the session is the backtest's last day.
 */
export interface LibraryActivity {
  date: string;
  live: boolean;
  buys: LibraryFill[];
  sells: LibraryFill[];
}

/**
 * GET /api/templates/strategy-library/{slug or id}/activity — `activity` is null for a strategy
 * without a live run.
 */
export interface StrategyLibraryActivityResponse {
  activity: LibraryActivity | null;
}
