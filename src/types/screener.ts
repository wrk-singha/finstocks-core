/**
 * Screener strategies (templates), their backtests and daily picks, plus the market screener's
 * stock universe and indicator filters. Union of both apps' interfaces/screener.ts.
 */
import type {BrokerOptions} from './broker.ts';

/** Row from `screener_strategies` table */
export interface ScreenerStrategy {
  id: number | string;
  name: string;
  description: string;
  full_prompt?: string;
  /** e.g. 'NIFTY100' */
  symbol: string;
  is_premium: boolean;
  is_intraday?: boolean;
  is_fno?: boolean;
  /** Latest backtest year win rate, 0-100. null when the strategy has no backtest rows. */
  avg_winrate?: number | null;
  /** Latest backtest year return % vs ₹100,000 capital. null when no backtest rows. */
  avg_pnl?: number | null;
  created_at: string;
  /** Cumulative monthly PnL curve from the drawer-default timeframe backtest */
  equity_curve?: number[];
  /** Peak-to-trough drawdown of that curve, as a positive percentage */
  max_drawdown_pct?: number;
  /** Backtested trade count for that timeframe */
  total_trades?: number;
  /** e.g. 'Reversion', 'Channel', 'Composite' */
  category?: string;
  direction?: 'long' | 'short';
  exit_method?: string;
  scorer_fn?: string;
  /** Stock the daily picker selected, refreshed ~10am */
  todays_symbol?: string;
  last_picked_at?: string;
  todays_pick?: {
    trade_count: number;
    gross_pnl: number;
    status: string;
    trade_date: string;
    trades?: TradeLogEntry[];
  };
  /** Today's screener_daily_picks row(s), only populated on the detail endpoint */
  daily_picks?: ScreenerDailyPick[];
}

/** Row from `screener_daily_picks` table */
export interface ScreenerDailyPick {
  id: number;
  strategy_id: number;
  trade_date: string;
  picker_method: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  entry_time?: string;
  quantity: number;
  capital_deployed: number;
  exit_price?: number;
  exit_time?: string;
  exit_reason?: string;
  gross_pnl?: number;
  brokerage?: number;
  net_pnl?: number;
  picker_score?: number;
  picker_rank?: number;
  status: 'recommended' | 'entered' | 'exited' | 'skipped';
  slot_number: number;
}

/** Single entry inside the `trades_log` JSONB array */
export interface TradeLogEntry {
  pnl: number;
  symbol: string;
  buy_time?: string;
  quantity?: number;
  buy_price?: number;
  sell_time?: string;
  sell_price?: number;
  exit_reason?: string;
  stock_symbol?: string;
  expiry?: string;
  strike?: number;
  trade_side?: string;
  legs?: {
    side: string;
    strike: number;
    option_type: string;
    entry_premium: number;
    exit_premium: number;
  }[];
  /** Flexible for any extra fields the backend adds. */
  [key: string]: unknown;
}

/** Row from `screener_backtest_results` table */
export interface ScreenerBacktestResult {
  id: number;
  strategy_id: number;
  /** '1m' | '5m' | '15m' | '1d' */
  timeframe: string;
  /** e.g. 'Jan 2024' */
  period_label: string;
  period_start: string;
  period_end: string;
  is_intraday: boolean;
  target_pct: number;
  stop_loss_pct: number;
  total_trades: number | null;
  realized_pnl: number | null;
  duration_seconds: number | null;
  trades_log: TradeLogEntry[] | null;
  created_at: string;
  /** Nested strategy stub (backend returns empty fields here) */
  strategy?: ScreenerStrategy;
}

/** GET /api/templates/screener-strategies?page=&limit= */
export interface ScreenerStrategiesResponse {
  strategies: ScreenerStrategy[];
  /** Declared by the mobile app only; the web copy never read it. */
  is_subscribed?: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** GET /api/templates/screener-strategies/:id?timeframe=&year= */
export interface ScreenerStrategyDetailResponse {
  strategy: ScreenerStrategy;
  backtest_results: ScreenerBacktestResult[];
  available_timeframes?: string[];
  total: number;
  page: number;
  limit: number;
}

/** Monthly performance data after transformation */
export interface MonthlyPerformance {
  /** 'Jan', 'Feb', ... */
  month: string;
  /** sum of trades_log[].pnl */
  profit: number;
  totalTrades: number;
  trades_log: TradeLogEntry[];
}

/** Summary stats computed from monthly data */
export interface SummaryStats {
  totalReturn: number | null;
  bestMonth: {month: string; profit: number} | null;
  worstMonth: {month: string; profit: number} | null;
}

/**
 * Brokers supported by the brokerage estimator. The same ids as `BrokerOptions`: the mobile copy
 * spelt Dhan "dhan" while every broker record and the web use "dhann" (drift resolved 2026-09-13).
 */
export type BrokerKey = BrokerOptions;

/**
 * One stock in the market screener universe. GET /api/market/screener.
 * Nullable fields are null when no real source exists (name/mkt_cap/div_yield ~ half-covered;
 * change_pct sparse).
 */
export interface ScreenerStock {
  symbol: string;
  name: string | null;
  /** fine-grained, e.g. "Software & Programming" */
  sector: string | null;
  price: number | null;
  change_pct: number | null;
  /** ₹ crore */
  mkt_cap: number | null;
  pe: number | null;
  rsi: number | null;
  /** percent */
  roe: number | null;
  debt_equity: number | null;
  /** percent */
  div_yield: number | null;
  /** "Uptrend" | "Downtrend" */
  trend_status: string | null;
  final_score: number | null;
  high_52w: number | null;
  low_52w: number | null;
  volume: number | null;
  /** user holds this stock */
  in_holdings: boolean | null;
  /** user watches this stock */
  in_watchlist: boolean | null;
}

/** GET /api/market/screener */
export interface ScreenerStocksResponse {
  stocks: ScreenerStock[];
}

/**
 * One filterable indicator. The backend derives this from the live
 * `in_technicals_1d` columns plus the fundamentals the screener parses, and
 * only returns keys that hold data - an indicator absent here has no coverage.
 */
export interface ScreenerIndicator {
  key: string;
  kind: 'number' | 'boolean';
  coverage: number;
}

/** GET /api/market/screener/indicators */
export interface ScreenerIndicatorsResponse {
  indicators: ScreenerIndicator[];
}

/** A user-built indicator filter: a numeric range, or a pattern flag. */
export interface CustomIndicatorFilter {
  key: string;
  min?: string;
  max?: string;
  flag?: boolean;
}
