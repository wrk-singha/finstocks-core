// GET /api/templates/strategy-library — the black-box strategy library on the Strategy Templates
// page (backend-go internal/strategylibrary, web `dev` src/interfaces/strategyLibrary.ts). The
// server sends a strategy's shape and a theme-level description only: its entry and exit conditions
// are never part of this payload.

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
}

/** GET /api/templates/strategy-library */
export interface StrategyLibraryResponse {
  strategies: LibraryStrategy[];
  total: number;
}

/** GET /api/templates/strategy-library/{id} — `backtest` is null until results exist. */
export interface StrategyLibraryDetailResponse {
  strategy: LibraryStrategy;
  backtest: null;
}
