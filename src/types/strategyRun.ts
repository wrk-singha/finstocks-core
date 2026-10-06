import type {ConsoleSizingMode} from './console.ts';
import type {NLPTrigger, Strategy} from './trade.ts';

/**
 * The values a strategy's rule steps are drawn from, and the ones its underlined tokens edit. One
 * shape for both a plan card that has not run yet and a saved strategy in the console, so the two
 * render the same steps.
 */
export interface StrategyRuleValues {
  symbol: string;
  timeframe: string;
  amount: number;
  sizingMode: ConsoleSizingMode;
  totalCapital?: number | undefined;
  isIntraday: boolean;
  executionMode: string;
  isFno: boolean;
  isParent?: boolean | undefined;
  fsm: unknown;
  /** Plain-text entry/exit, shown when there is no FSM to draw steps from. */
  entryText?: string | undefined;
  exitText?: string | undefined;
}

/** `entry:<transition>:<leaf path>` addresses one numeric threshold in the FSM. */
export type RuleTokenKey =
  | 'symbol'
  | 'timeframe'
  | 'amount'
  | 'takeProfit'
  | 'session'
  | 'repeat'
  | `entry:${string}`
  | `entryOp:${string}`
  | `entryVar:${string}`;

export type RuleTokenEditability = Partial<
  Record<
    | 'symbol'
    | 'timeframe'
    | 'amount'
    | 'takeProfit'
    | 'session'
    | 'repeat'
    | 'entry',
    boolean
  >
>;

export interface RuleLeaf {
  indicator: string;
  /** The projection's own wording of `rawOperator`; an app that translates words the raw one. */
  operator: string;
  value: string;
  numeric: number | null;
  /** The FSM's own `var` and `op`, which an editor writes back and pre-selects. */
  rawIndicator: string;
  rawOperator: string;
  /** Indexes into nested `conditions`, from the transition's own condition. */
  path: number[];
}

export interface ParsedEntryRule {
  transitionIndex: number;
  logic: 'AND' | 'OR';
  leaves: RuleLeaf[];
}

export interface ParsedExitRule {
  kind: 'take_profit' | 'stop_loss' | 'signal';
  pct?: number;
  /** A take profit whose threshold is `$entry_price * m` and can be rewritten. */
  editablePct: boolean;
  /** True when the exit fires as price falls (a long stop, a short target). */
  falling: boolean;
  logic: 'AND' | 'OR';
  leaves: RuleLeaf[];
}

export interface ParsedRuleFsm {
  entries: ParsedEntryRule[];
  exits: ParsedExitRule[];
  nlpTriggers: NLPTrigger[];
  indicators: string[];
}

export type BacktestPeriod = '1m' | '3m' | '6m' | '1y' | '2y' | '3y' | '5y';

/** The newest run of each kind among the strategies a plan has produced. */
export interface StrategyRunSnapshot<T = Strategy> {
  backtest?: T | undefined;
  forward?: T | undefined;
  live?: T | undefined;
}

export type RunOptionKind = 'backtest' | 'forward' | 'live';

/** A C strategy card's code and the rows it was saved as (`scriptRunOf`). */
export interface ScriptRun {
  script: string;
  scriptHash: string;
  /** The card's `script_sig`, when it carries one. */
  scriptSig?: string | undefined;
  strategyId?: string | undefined;
  backtestId?: string | undefined;
}

/**
 * Tone of the plan's one-line status pill. "running"/"warning" cover a backtest that is still
 * replaying or never finished.
 */
export type StrategyStatusTone =
  'live' | 'mock' | 'running' | 'warning' | 'tested' | 'idle';
