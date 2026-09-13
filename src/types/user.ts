import type {BrokerOptions} from './broker.ts';

export interface UserProfileResponse {
  user_id: number;
  username: string;
  email: string;
  service: BrokerOptions;
  broker_details: BrokerDetails;
  login_service: 'google' | 'email';
  created_at: string;
  user_prefs?: UserPreferences;
  terms_accepted_version: number;
}

export type TimeInterval = '1m' | '5m' | '15m' | '1d';

/** Every preference either app writes; the backend stores the union. */
export interface UserPreferences {
  time_interval?: TimeInterval;
  recieve_emails?: 'all' | 'important';
  allow_update_emails?: boolean;
  allow_performance_emails?: boolean;
  allow_marketing_emails?: boolean;
  sync_broker_daily?: boolean;
  trade_nse_fno?: boolean;
  trade_nse_equity_intraday?: boolean;
  trade_bse_fno?: boolean;
  trade_bse_equity_intraday?: boolean;
}

export type updatePreferencesRequest = UserPreferences;

export interface BrokerDetails {
  groww_api_key?: string;
  groww_api_secret?: boolean;
  groww_request_token?: boolean;
  zerodha_api_key?: string;
  zerodha_api_secret?: boolean;
  zerodha_request_token?: boolean;
  dhann_request_token?: boolean;
  dhann_validity?: string;
  dhann_user_id?: string;
  dhann_auto_refresh?: boolean;
  dhann_pin?: boolean;
  dhann_totp_secret?: boolean;
  upstox_api_key?: string;
  upstox_api_secret?: boolean;
  upstox_access_token?: boolean;
}

export type fetchPortfolioResponse = TradeData[];

export interface TradeData {
  id: string;
  timestamp: string;
  stock_symbol: string;
  quantity: number;
  buy_price: number | null;
  sell_price: number | null;
  buy_time: string | null;
  sell_time: string | null;
  status: string;
  user_id: string;
  execution_strategy: string | null;
  execution_payload?: string;
  product?: string | null;
  order_type?: string | null;
  exchange?: string | null;
  broker_order_id?: string | null;
  sell_broker_order_id?: string | null;
  market?: string | null;
  strategy_id?: string | null;
  broker?: string | null;
  order_status?: string | null;
}

export interface setServiceRequest {
  service: string;
}

export interface updatePasswordRequest {
  old: string;
  new: string;
}

export interface acceptTermsRequest {
  version: number;
}

export interface BrokerHolding {
  trading_symbol: string;
  quantity: number;
  average_price: number;
  pnl: number;
  pnl_percentage: number;
  isin: string;
  exchange: string;
  // Legacy fields (optional for backward compatibility)
  tradingSymbol?: string;
  securityId?: string;
  totalQty?: number;
  dpQty?: number;
  t1Qty?: number;
  mtf_t1_qty?: number;
  mtf_qty?: number;
  availableQty?: number;
  collateralQty?: number;
  avgCostPrice?: number;
  lastTradedPrice?: number;
}

export interface BrokerPortfolioResponse {
  success: boolean;
  user_id: number;
  service: string;
  holdings: BrokerHolding[];
  positions: unknown[];
}

export interface CreateSharePortfolioResponse {
  share_link_uuid: string;
}

/**
 * GET /share/portfolio/:uuid. The web shape: the mobile copy modelled `user.username` and read
 * `hmac_token` through a local cast — the backend sends `user_id`, `username` and `hmac_token`
 * flat (drift resolved 2026-09-13).
 */
export interface SharePortfolioResponse {
  user_id: number;
  username?: string;
  transactions: TradeData[];
  hmac_token: string;
}

export interface SyncConflictDbData {
  id: number;
  timestamp: string;
  stock_symbol: string;
  quantity: number;
  buy_price: number | null;
  sell_price: number | null;
  buy_time: string | null;
  sell_time: string | null;
  status: string;
}

export interface SyncConflictBrokerData {
  trading_symbol: string;
  quantity: number;
  average_price: number;
  pnl: number;
  pnl_percentage: number;
  isin: string;
  exchange: string;
}

export interface SyncConflictItem {
  /** UUID for the conflict. */
  id: string;
  type: 'MISSING_IN_BROKER' | 'MISSING_IN_DB' | 'QUANTITY_MISMATCH';
  description: string;
  db_data: SyncConflictDbData;
  broker_data: SyncConflictBrokerData;
}

export interface SyncConflictsResponse {
  conflicts: SyncConflictItem[];
  matched_count: number;
}

/**
 * A holding as the portfolio tables render it: the raw trade plus every derived figure. Built by
 * one hook per app; read by many modules, so the shape is shared.
 */
export interface HoldingRow {
  tradeId: string;
  symbol: string;
  shares: number;
  qtyLabel: string;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  current: number;
  pnl: number | null;
  returnPercent: number;
  oneDayChange: number;
  todayPercent: number;
  hasDayChange: boolean;
  hasLivePrice: boolean;
  hasSoldTrades: boolean;
  isManualTrade: boolean;
  strategyDisplay: string;
  strategyId: string | null;
  strategyDescription?: string;
  strategyNumber: number | null;
  trade: TradeData;
}
