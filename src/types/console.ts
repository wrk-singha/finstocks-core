/**
 * Data contracts for the Strategy Console (web's full-screen console; the mobile strategy
 * drawer reads the same rows). The React prop interfaces (ConsoleStrategyRailProps,
 * ConsoleRulesEditorProps, StrategyConsoleProps) stay in the web app: they carry callbacks and a
 * ReactNode slot, which is UI wiring rather than data.
 */
import type {FSMStrategyRules} from './trade.ts';
import type {TradeData} from './user.ts';

export type ConsoleFilter = 'ACTIVE' | 'ARCHIVED';

/** Semantic run-state, mapped to a status colour inside each pane by the app. */
export type ConsoleRunState = 'live' | 'paused' | 'archived';

export interface ConsoleRailItem {
  id: string;
  name: string;
  state: ConsoleRunState;
  /** pre-formatted, e.g. "+₹12,340" or "—" */
  pnl: string;
  /** null => neutral/muted colour */
  pnlPositive: boolean | null;
  /** e.g. "RSI · Intraday · 5m" */
  meta: string;
  /** e.g. "68%" */
  win?: string;
  /** 0-100 for the mini bar width; null/undefined hides the bar */
  winPct?: number | null;
}

/** Which control cluster the detail header shows. */
export type ConsoleControls = 'live' | 'archived' | 'none';

export interface ConsoleKpi {
  label: string;
  val: string;
  /** tints val with the P&L colour when set */
  valPositive?: boolean | null;
}

/**
 * Read-only strategy-rules breakdown ("Edit rules" panel, view mode).
 * Every field past `universe` is optional because the backend only carries a
 * subset - entry is free text - so the panel renders only what actually
 * exists rather than faking the missing rows.
 */
export interface ConsoleRules {
  /** e.g. "NIFTY100" or the traded symbol */
  universe: string;
  /** e.g. "1D" */
  timeframe?: string;
  /** free-text entry rule (strategy's original query) */
  entry?: string;
  /** e.g. "+10%" */
  takeProfit?: string;
  /** e.g. "-5%" */
  stopLoss?: string;
  /** e.g. "Square off same day" / "None" */
  timeExit?: string;
  /** e.g. "₹1,00,000" */
  capital?: string;
  /** e.g. "Fixed amount" */
  sizingMethod?: string;
  /**
   * The real FSM projected into entry/exit clauses. When present the panel
   * renders these instead of the flat entry/TP/SL strings above.
   */
  fsm?: FSMStrategyRules | null;
}

export type ConsoleSizingMode = 'AMOUNT' | 'QTY' | 'PERCENT' | 'RISK_PERCENT';

/**
 * The editable subset of a strategy's rules. When `rawFSM` is present the
 * editor works in direct-FSM mode: edits mutate the FSM JSON in place and
 * save via PUT /api/trading/update-fsm. When absent, the legacy re-deploy
 * path (switch-strategy) is used instead.
 */
export interface ConsoleRulesDraft {
  /**
   * The row's size in its mode's unit (`budgetVal`). Absent for a row sized by quantity that
   * states no count: never the capital passed in, read as one.
   */
  capital?: number;
  /** budget_config.mode */
  sizingMode: ConsoleSizingMode;
  /**
   * budget_config.total - the capital pool PERCENT/RISK_PERCENT size against.
   * Carried through the editor untouched: redeploy marshals whatever
   * budget_config it is handed, so omitting it stripped the pool the
   * percentages referred to and left a percent strategy sizing against
   * nothing.
   */
  totalCapital?: number;
  /** original_query */
  entryQuery: string;
  /** strategy's traded symbol ("universe" pill) */
  symbol: string;
  /** chart interval pill */
  timeframe: string;
  rawFSM?: Record<string, unknown> | null;
  strategyId?: string;
  /** index strategies - symbol is not editable */
  isParent?: boolean;
  // Display-only context for the rule steps; not saved by either path.
  isIntraday?: boolean;
  executionMode?: string;
  isFno?: boolean;
}

export interface ConsolePosition {
  sym: string;
  /** e.g. "12 sh · avg ₹1,204" */
  sub: string;
  val: string;
  /** e.g. "+₹640" or "—" */
  pl: string;
  /** e.g. "+5.6%" or "—" */
  plp: string;
  plpPositive: boolean | null;
  /** exited trade: shows a "Closed" badge, val tinted by P&L */
  closed?: boolean;
}

export interface ConsoleActivityRow {
  /** "BUY" | "SELL" | "WARN" | "ERR" */
  side: string;
  /** true => buy/green, false => sell/red (ignored when level set) */
  sidePositive: boolean;
  sym: string;
  /** e.g. "12 @ ₹1,204" or a warning/error message */
  detail: string;
  /** short relative/absolute time */
  t: string;
  /** strategy_logs alert; drives the severity badge colour */
  level?: 'warning' | 'error';
}

/** Structured, pre-formatted detail data for the selected strategy. */
export interface StrategyConsoleDetail {
  name: string;
  metaChips: string[];
  controls: ConsoleControls;
  isPaused: boolean;
  /**
   * Symbol the detail chart falls back to when there are no open positions
   * (latest traded ticker -> strategy underlying). Empty => no chartable symbol.
   */
  chartSymbol?: string;
  /**
   * Backend `is_fno` flag - gates the live CE/PE option-premium panel. Distinct
   * from symbol-pattern F&O detection: a NIFTY100 equity screener still charts
   * its NIFTY underlying, which looks index-like but isn't an options strategy.
   */
  isFnO?: boolean;
  kpis: ConsoleKpi[];
  /** e.g. "Positions" */
  posLabel: string;
  /** open holdings (also the chart's pick-to-chart list) */
  positions: ConsolePosition[];
  /** exited trades w/ realized P&L, newest exit first */
  closedPositions: ConsolePosition[];
  activity: ConsoleActivityRow[];
  /**
   * This strategy's (or autopilot's) own trades, unfiltered by symbol - the
   * detail chart derives buy/sell arrows from these for whichever position is
   * currently selected.
   */
  trades: TradeData[];
  /** Structured rules for real strategies; null/undefined (e.g. autopilot) falls back to `rule`. */
  rules?: ConsoleRules | null;
  /** strategy logic sentence (fallback when `rules` is absent) */
  rule: string;
  /**
   * Raw editable values for the selected strategy. Present only for real,
   * editable strategies (absent for autopilot) - its presence is what unlocks
   * the rules panel's edit mode.
   */
  rulesDraft?: ConsoleRulesDraft | null;
}
