export type StrategyLogsResponse = StrategyLog[];

export interface StrategyLog {
  log_id: number;
  strategy_id: string;
  log_level: LogLevel;
  message?: string;
  payload: LogPayload | null;
  created_at: string;
  /** Symbol associated with this log entry (e.g. "DRREDDY"). */
  symbol?: string;
}

/**
 * A strategy_logs row as backend-go's `models.StrategyLogs` writes it, which is how a forked
 * chat's `source_strategy_logs` arrive (handlers/chat/getbyid.go): `message` and `payload` are
 * left out when empty, and the row is not wrapped as a get-logs timeline item.
 * `sourceLogTimeline` turns these rows into the items the logs card reads.
 */
export interface StrategyLogRow {
  log_id: number;
  strategy_id: string;
  log_level: LogLevel;
  message?: string;
  payload?: LogPayload | null;
  created_at: string;
  symbol: string;
}

/**
 * Backend /trading/get-logs feed shape: a discriminated union of real
 * strategy_logs rows and raw transactions, so a freshly-deployed live
 * strategy still shows fills before its first strategy_logs row lands.
 * Each app's useStrategyLogs collapses this to StrategyLog[].
 */
export interface LogFeedLogEntry {
  entry_type: 'log';
  created_at: string;
  log: Omit<StrategyLog, 'created_at'>;
}

export interface LogFeedTransactionEntry {
  entry_type: 'transaction';
  created_at: string;
  transaction: RawTransaction;
}

export type LogFeedEntry = LogFeedLogEntry | LogFeedTransactionEntry;
export type LogFeedResponse = LogFeedEntry[];

export interface RawTransaction {
  id: number | string;
  stock_symbol: string;
  quantity: number;
  status: string;
  user_id: number | string;
  timestamp: string;
  buy_price: number | null;
  buy_time: string | null;
  sell_price: number | null;
  sell_time: string | null;
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
}

/**
 * Open string: the engine writes dynamic levels ("BUY 99 ADANIPOWER") beside the fixed set in
 * `KNOWN_LOG_LEVELS`, so a closed union would reject real rows.
 */
export type LogLevel = string;

export const KNOWN_LOG_LEVELS = [
  'BACKTEST_RESULT',
  'STATE_CHANGE',
  'EXECUTION_ERROR',
  'EXECUTION_FILLED',
  'INFO',
  'WARNING',
  'ERROR',
] as const;

export interface LogPayload {
  symbol?: string;
  message?: string;
  error?: string;
  return_pct?: number;
  realized_pnl?: number;
  total_trades?: number;
  final_balance?: number;
  initial_balance?: number;
  /** Legacy field - use `trades` instead. */
  execution_log?: ExecutionLogEntry[];
  trades?: ExecutionLogEntry[];
  /** Legs still held when the window ended; not part of the realised stats. */
  open_trades?: OpenTradeEntry[];
}

/**
 * A leg the backtest was still holding when its window ended: bought, not yet sold. backend-go's
 * `resultsPayload` (handlers/trading/tradelogs.go) writes these beside `trades`, `buy_time` in
 * RFC 3339.
 */
export interface OpenTradeEntry {
  symbol: string;
  quantity: number;
  buy_price: number;
  buy_time: string;
}

export interface ExecutionLogEntry {
  pnl: number;
  symbol: string;
  buy_time: string;
  quantity: number;
  buy_price: number;
  sell_time: string;
  sell_price: number;
  exit_reason?: string;
  option_type?: string;
  trade_side?: string;
  expiry?: string;
  strike?: number;
  legs?: {
    side: string;
    strike: number;
    option_type: string;
    entry_premium: number;
    exit_premium: number;
  }[];
}

export interface AutopilotLog {
  logs: string;
  model_id: number;
  created_at: string;
  market: string;
}
