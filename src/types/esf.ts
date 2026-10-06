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

/** One review of a basket: the close it was decided at and the open its orders go in on. */
export interface EsfRebalance {
  id: number;
  as_of: string;
  effective_on: string;
  market_label: string | null;
  added: number;
}

export interface EsfMember {
  symbol: string;
  rank: number;
  selection_score: number;
  stage: string | null;
  weight: number;
  ref_close: number | null;
  change: 'added' | 'kept';
  return_6m: number | null;
  company_name: string | null;
  industry: string | null;
}

/** The basket's value and the benchmark's, both rebased to 100 at launch. */
export interface EsfNavPoint {
  trade_date: string;
  nav: number;
  benchmark: number | null;
}

export interface EsfBacktestStats {
  'total_%': number;
  'cagr_%': number | null;
  'vol_%': number;
  'max_dd_%': number;
}

export interface EsfBacktestMetrics {
  window: string;
  strategy_net: EsfBacktestStats;
  strategy_gross: EsfBacktestStats;
  nifty500: EsfBacktestStats;
  equal_weight_universe: EsfBacktestStats;
}

export interface EsfBacktestRun {
  id: number;
  label: string;
  window_start: string;
  window_end: string;
  rebalances: number;
  is_primary: boolean;
  method: string;
  metrics: EsfBacktestMetrics;
}

/** One review period of a backtest: what the basket held and how it did until the next review. */
export interface EsfBacktestMonth {
  as_of: string;
  exit_on: string;
  names: number;
  gross: number;
  net: number;
  benchmark: number | null;
  universe: number | null;
  turnover: number;
  market_label: string | null;
}

export interface EsfBacktestPick {
  as_of: string;
  symbol: string;
  rank: number;
  selection_score: number | null;
  stage: string | null;
  fwd_return: number | null;
  change: 'added' | 'kept';
}

export interface EsfBacktestDay {
  date: string;
  nav: number;
  benchmark: number | null;
}

/** Raw /api/esf/baskets/{slug}/backtests/{id}: every month, pick and day of one run. */
export interface EsfBacktestDetail {
  run: EsfBacktestRun;
  months: EsfBacktestMonth[];
  picks: EsfBacktestPick[];
  daily: EsfBacktestDay[];
}

export type EsfOrderStatus =
  | 'pending'
  | 'filled'
  | 'submitted'
  | 'unknown'
  | 'failed'
  | 'skipped_no_session'
  | 'skipped_no_price'
  | 'skipped_no_cash'
  | 'skipped_zero_qty';

export interface EsfOrder {
  id: number;
  rebalance_as_of: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  ref_price: number | null;
  status: EsfOrderStatus;
  error: string | null;
  created_at: string;
}

export interface EsfPosition {
  symbol: string;
  quantity: number;
  avg_price: number;
  last_price: number | null;
  value: number;
  pnl: number;
}

export type EsfMode = 'mock' | 'live';
export type EsfSubscriptionStatus = 'active' | 'paused' | 'cancelled';

/**
 * A subscription as the ledger holds it: what `PATCH /esf/subscriptions/{id}` answers with, and the
 * part of the detail view that is not worked out from prices. `live_trading_enabled` lives on the
 * basket, not here.
 */
export interface EsfSubscriptionRecord {
  id: number;
  mode: EsfMode;
  capital: number;
  realized_pnl: number;
  status: EsfSubscriptionStatus;
  rebalance_id: number | null;
  created_at: string;
}

/**
 * The caller's investment in a basket, as `GET /esf/baskets/{slug}` and the subscribe route return
 * it: the record plus what it is worth now and what it has done. Once it exists the backend trades
 * it at every review without asking again; pausing or cancelling (`EsfSubscriptionStatus`) is the
 * only way to stop that from a client.
 */
export interface EsfSubscription extends EsfSubscriptionRecord {
  invested: number;
  market_value: number;
  cash: number;
  equity: number;
  pnl: number;
  pnl_pct: number;
  positions: EsfPosition[];
  orders: EsfOrder[];
  /** The next day the basket will place orders for this subscription. */
  next_orders_on: string;
}

/**
 * What min_capital was worked out from: the dearest stock, the margin for price moves, the
 * rounding step, and the basket's own floor.
 */
export interface EsfMinCapitalBasis {
  symbol: string;
  price: number;
  margin: number;
  step: number;
  floor: number;
}

export interface EsfBasketBase {
  id: number;
  slug: string;
  name: string;
  description: string;
  size: number;
  /** The review cadence: `weekly`, `monthly`, `quarterly`, `first-monday`, `results-quarterly`. */
  rebalance: string;
  min_capital: number;
  min_capital_basis: EsfMinCapitalBasis | null;
  cost_per_side: number;
  score_label: string;
  score_unit: 'points' | 'pct';
  /** How the stocks are picked, one plain-English step per entry. */
  method: string[];
  /** The review in force today; null before the first review. */
  current: EsfRebalance | null;
  /** YYYY-MM-DD, or "" when no review day falls in the next four months. */
  next_review: string;
}

/** Raw /api/esf/baskets: one card per basket. */
export interface EsfBasketCard extends EsfBasketBase {
  top: EsfMember[];
  member_count: number;
  launch: EsfNavPoint | null;
  latest: EsfNavPoint | null;
  backtest: EsfBacktestRun | null;
  my_subscription_mode: EsfMode | null;
}

/** Raw /api/esf/baskets/{slug}. */
export interface EsfBasketDetail extends EsfBasketBase {
  members: EsfMember[];
  removed: string[];
  history: EsfRebalance[];
  nav: EsfNavPoint[];
  backtests: EsfBacktestRun[];
  subscription: EsfSubscription | null;
  live_trading_enabled: boolean;
}

export interface EsfBasketsResponse {
  baskets: EsfBasketCard[];
}

/**
 * `POST /esf/baskets/{slug}/subscriptions`. One subscription per user per basket across both
 * modes: a second answers 409. `confirm_live` is the user's consent to real orders with no further
 * prompt, and the backend refuses a live subscription without it (400); a client sets it only from
 * the gesture that confirmed a live subscription, never from a default.
 */
export interface EsfSubscribeRequest {
  mode: EsfMode;
  capital: number;
  confirm_live: boolean;
}

/** `PATCH /esf/subscriptions/{id}`: `paused` holds new orders, `active` resumes, `cancelled` ends it. */
export interface EsfSubscriptionStatusRequest {
  status: EsfSubscriptionStatus;
}
