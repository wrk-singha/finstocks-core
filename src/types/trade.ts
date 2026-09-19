/**
 * How the order settles, which is the axis every broker's exit-leg support turns on — see
 * trading/orderProtection.ts. Maps to product CNC / MIS.
 */
export type SettlementMode = 'DELIVERY' | 'INTRADAY';

/**
 * The order vocabulary, canonical here because these are literal unions: structural typing makes
 * duplicate copies interchangeable today, so nothing flags the drift until someone widens one of
 * them and the others silently keep accepting the old members.
 */
export type OrderSide = 'BUY' | 'SELL';

export type OrderType = 'MARKET' | 'LIMIT';

/** Broker product code. Settlement is the derived axis — see settlementForProduct(). */
export type OrderProduct = 'CNC' | 'MIS' | 'NRML';

export interface useTradeStatusResponse {
  message: boolean;
  investment_amount?: number;
  key: 'IN';
  is_mock: boolean;
  strategies: Strategy[];
}

/**
 * Union of the two apps' Strategy shapes (drift resolved 2026-09-13). The mobile copy declared
 * the fields the current backend always writes (`user_id`, `shard_id`, `budget_config`, `fsm`,
 * the `is_*` flags) as required and typed `fsm` as the real FSM; the web copy predated that
 * schema and left them optional with `fsm` as an opaque record. Required-ness follows the
 * backend, so the mobile reading wins; the web-only optional fields (`take_profit` as a bare
 * number) widen to the mobile `number | null`, which is what the API returns for an unset leg.
 */
export interface Strategy {
  strategy_id: string;
  user_id: number;
  symbol: string;
  status: string;
  is_mock: boolean;
  created_at: string;
  shard_id: number;
  market: 'IN';
  timeframe: string;
  execution_mode: string;
  original_query: string;
  target_scope: string | null;
  budget_config: BudgetConfig;
  fsm: FSM;
  nlp_triggers?: NLPTrigger[];
  is_parent: boolean;
  is_intraday: boolean;
  is_backtest: boolean;
  is_fno: boolean;
  /** Percentages, not prices. */
  take_profit?: number | null;
  stop_loss?: number | null;
  stock_symbol?: string;
  strategy_hname?: string;
  /** The server-projected FSM (entry/exit clauses). */
  rules?: StrategyRules | null;
  indicators?: {name: string; period?: number}[];
}

/** One structured clause within a compound (AND-joined) FSM rule. */
export interface ConditionClause {
  /** e.g. "rsi14", "close_price" — or the pre-rendered "RSI(14)" on newer rows. */
  indicator: string;
  /** e.g. ">", "crosses_above" */
  operator: string;
  /** e.g. "30", "$entry_price * 1.05" */
  value: string;
}

/**
 * One FSM transition projected into a readable clause. Entry = BUY transitions, Exit = SELL
 * transitions (see backend FSMStrategyRules).
 */
export interface FSMRule {
  /** e.g. "close >= entry_price * 1.008" */
  condition: string;
  /** Present when condition is a compound AND. */
  clauses?: ConditionClause[];
  /** "AND" | "OR" when multiple clauses. */
  logic?: string;
  qty?: string;
  /** Exits only. */
  exit_type?: 'take_profit' | 'stop_loss' | 'signal';
  /** Exits: resolved percentage (e.g. 10 for 10%). */
  pct?: number;
  /**
   * The compiler's own words for the transition, e.g. "Take profit at 5.0%". `projectRawFsm` reads
   * it off the raw transition; `exitHint` prefers it over a derived phrase when it quantifies the
   * exit, because it states the intent exactly.
   */
  comment?: string;
}

/**
 * Prose exit for news-based strategies: no SELL transition exists, so the sentinel evaluates
 * this summary instead of a deterministic condition.
 */
export interface NLPTrigger {
  id: string;
  summary: string;
}

/** Server-projected FSM rules (ExtractStrategyRules) — human-readable clauses. */
export interface StrategyRules {
  entry: FSMRule[];
  exit: FSMRule[];
  nlp_triggers?: NLPTrigger[];
}

/** The web's name for the same projection. */
export type FSMStrategyRules = StrategyRules;

export interface BudgetConfig {
  /**
   * Polymorphic: `val` is ₹ in AMOUNT, a share count in QTY, a percent in PERCENT / RISK_PERCENT
   * — always branch on `mode` before formatting. These strings are what the backend writes
   * (buildBudgetConfig in handlers/trading/createbacktest.go); "PERCENTAGE" matches nothing.
   */
  val: number;
  mode: 'AMOUNT' | 'QTY' | 'PERCENT' | 'RISK_PERCENT';
  /**
   * Capital pool PERCENT/RISK_PERCENT size against (Go: BudgetConfig.Total). Only those modes
   * carry it; for AMOUNT the rupee figure is `val`.
   */
  total?: number;
}

/**
 * PUT /trading/update-fsm replaces the whole fsm column with the client's payload, so any key
 * missing from an outgoing FSM is deleted in production. The index signature keeps undeclared
 * keys expressible rather than silently dropped by a typed spread.
 */
export interface FSM {
  states: Record<string, FSMState>;
  variables: string[];
  nlp_triggers?: NLPTrigger[];
  initial_state: string;
  intent?: string;
  state?: string;
  [key: string]: unknown;
}

export interface FSMState {
  on_entry: FSMAction[];
  on_tick: FSMAction[];
  on_exit: FSMAction[];
  transitions: FSMTransition[];
}

export interface FSMTransition {
  condition: FSMCondition;
  next_state: string;
  actions: FSMAction[];
  comment: string;
}

export interface FSMAction {
  type: string;
  payload: Record<string, unknown>;
}

/**
 * A single indicator/operator/value condition, or a compound AND/OR group of them (recursive) —
 * the backend supports both shapes for FSM transitions.
 */
export type FSMCondition =
  | {op: string; val: number | string; var: string}
  | {logic: string; conditions: FSMCondition[]};

export interface ReserveIpAddressResponse {
  outbound_ip: string;
}

/**
 * Edited-rule overrides for a re-deploy (switch-strategy). All optional; when present they
 * replace the original strategy's values on the recreated run.
 */
export interface RedeployOverrides {
  original_query?: string;
  /** `total` is the pool PERCENT/RISK_PERCENT sizing is measured against; carried through untouched. */
  budget_config?: {mode: string; val: number; total?: number};
  symbol?: string;
  timeframe?: string;
}

/**
 * Per-leg brokerage + statutory charges breakdown. Every line is part of `totalCharges`, and
 * itemised because a breakdown that lists the charges has to add up to the total.
 */
export interface BrokerageBreakdown {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiCharges: number;
  gst: number;
  stampDuty: number;
  dpCharges: number;
  /** Investor Protection Fund trust levy. */
  ipft: number;
  totalCharges: number;
  grossPnl: number;
  netPnl: number;
}
