/**
 * The options regime, as `/market/regimepulse/*` serves it (backend-go `internal/models/regimepulse.go`,
 * dev). Row columns are the quant's own: one reading per underlying per engine cycle.
 */

export type Regime =
  | 'BULLISH'
  | 'NEUTRAL-TO-BULLISH'
  | 'RANGEBOUND'
  | 'NEUTRAL-TO-BEARISH'
  | 'BEARISH'
  | 'WARMING_UP';

export type RegimeMethod = 'live' | 'historical';

export interface RegimeRow {
  ts: string;
  trade_date: string;
  underlying: string;
  spot: number;
  avg_ce_z: number;
  avg_pe_z: number;
  z_bias: number;
  avg_ce_roc: number;
  avg_pe_roc: number;
  roc_bias: number;
  roc_bias_z: number | null;
  regime: Regime;
  /** Fractions: 0.124 is 12.4%. */
  atm_ce_iv: number;
  atm_pe_iv: number;
  straddle_iv: number;
  atm_ce_ltp: number;
  atm_pe_ltp: number;
  straddle_premium: number;
  /** Internal users only; blank for everyone else. */
  pzr1_signal: string;
  pzr1_position: -1 | 0 | 1;
  pzr1_entry_ts: string;
  pzr1_entry_spot: number;
  /** Fraction points against yesterday's close. */
  atm_ce_iv_chg: number;
  atm_pe_iv_chg: number;
  straddle_iv_chg: number;
  atm_ce_value: number;
  atm_pe_value: number;
  atm_ce_value_chg_pct: number;
  atm_pe_value_chg_pct: number;
  straddle_atp: number;
  straddle_open: number;
  straddle_chg: number;
  straddle_chg_pct: number;
  expiry: string | null;
  atm_strike: number | null;
  regime_since: string | null;
}

export interface RegimeSentimentRow {
  ts: string;
  total_symbols: number;
  bullish: number;
  nt_bullish: number;
  rangebound: number;
  nt_bearish: number;
  bearish: number;
  bullish_total: number;
  bearish_total: number;
}

/**
 * The latest reading of every underlying the engine scores. `date` and `as_of` are empty and
 * `rows` is `[]` before the engine has stored anything; `as_of` is the newest `ts` across the rows
 * and the breadth row.
 */
export interface RegimeSnapshot {
  date: string;
  as_of: string | null;
  interval_sec: number;
  internal: boolean;
  rows: RegimeRow[];
  breadth: RegimeSentimentRow | null;
}

export interface RegimeSentiment {
  date: string;
  strong_bull: number;
  strong_bear: number;
  rows: RegimeSentimentRow[];
}

export interface RegimeDetailMeta {
  symbol: string;
  date: string;
  expiry: string | null;
  atm: number | null;
  strikes: number[];
  /** Null for an underlying the lot-size table does not know. */
  lot_size: number | null;
  bars: number;
  method: RegimeMethod;
  from_cache?: boolean;
}

/** One underlying's readings through a session, oldest first. */
export interface RegimeDetail {
  meta: RegimeDetailMeta;
  internal: boolean;
  rows: RegimeRow[];
}

/** The two expiry-backtest strategies the engine runs (`GET /market/regimepulse/strategies`). */
export type RegimeStrategyId = 'regime' | 'straddle_sl';

export interface RegimeStrategy {
  id: RegimeStrategyId;
  label: string;
  short: string;
  description: string;
}

export interface DrilldownRow {
  label: string;
  atm: number | null;
  lot_size: number;
  trades: number;
  peak: number;
  trough: number;
  gross: number;
  cost: number;
  net: number;
}

export interface Drilldown {
  rows: DrilldownRow[];
  total: {gross: number; cost: number; net: number; count: number};
}

/** One symbol's record over every trading day to the expiry. */
export interface SymbolBacktestSummary {
  days: number;
  wins: number;
  losses: number;
  win_pct: number;
  best_day: number;
  worst_day: number;
  total_gross: number;
  total_cost: number;
  total_net: number;
}

export interface DateBacktestSummary {
  date: string;
  traded: number;
  wins: number;
  losses: number;
  win_pct: number;
  best_symbol: string;
  best_net: number;
  worst_symbol: string;
  worst_net: number;
  gross: number;
  cost: number;
  net: number;
  detail: Drilldown;
}

/**
 * What `POST /market/regimepulse/expiry-backtest` answers: the strategy walked over every trading
 * day to `expiry` for each symbol, with a null summary for a symbol that traded nothing.
 */
export interface ExpiryBacktest {
  expiry: string;
  from: string | null;
  strategy: RegimeStrategyId;
  trading_days: string[];
  symbols: {
    symbol: string;
    summary: SymbolBacktestSummary | null;
    detail: Drilldown;
  }[];
  dates: DateBacktestSummary[];
}
