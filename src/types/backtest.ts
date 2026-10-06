/**
 * Chat backtest cards (setup, sweep, results) and the summary maths' contracts.
 * Union of both apps' interfaces/backtest.ts plus the web's TradeSummary (interfaces/components)
 * and the mobile BacktestTradeInput (utils/strategy/backtestStats).
 */
import type {ExecutionLogEntry} from './strategyLogs.ts';

export interface BacktestSetupRow {
  /**
   * The row's machine name, in the same vocabulary as `BacktestSetupTerms`.
   *
   * `k` is a LABEL - English, written for a person, and free to be reworded.
   * Anything that needs to FIND a row keys off this instead: the Go confirm
   * write-back used to match `k` against the literal string "Intraday", so
   * rewording the label in the Python row builder would have silently stopped
   * the user's own choice being recorded, in another repo, with no error.
   *
   * Optional because cards already sitting in older chats do not carry it.
   */
  f?: string;
  k: string;
  v?: string;
  highlight?: boolean;
  missing?: boolean;
  options?: string[];
}

/**
 * The plan in the shape the runner needs, emitted by the tool that drew the
 * rows from the same arguments.
 *
 * Optional because cards already sitting in older chats do not have it. New
 * ones always do, and when it is present nothing reads the rows as data - the
 * rows are a table for a person, and reading them back is how "Tickers: Tata
 * Consultancy Services" became a symbol no backtest could run.
 */
export interface BacktestSetupTerms {
  tickers?: string;
  strategy_name?: string;
  /**
   * The rules themselves. `original_query` is NOT a description - the Go field
   * is commented "entry/exit rules" and it is the only channel the engine
   * parses a strategy from. Sending the strategy NAME instead meant every
   * variant of a sweep shared one, so five different rule changes came back
   * with byte-identical results.
   */
  entry_condition?: string;
  exit_condition?: string;
  timeframe?: string;
  position_sizing?: string;
  sizing_mode?: string;
  total_capital?: string;
  execution_mode?: string;
  intraday?: boolean;
  fno_mode?: boolean;
  backtest_start?: string;
  backtest_end?: string;
  /**
   * Pre-compiled FSM carried through to create-backtest unchanged. Absent on
   * FNO and older cards, where Sentinel compiles its own instead.
   */
  fsm?: unknown;
  /**
   * A composed strategy, on "script_preview" cards: the script and its
   * identity, shown in the card's receipt.
   */
  script?: string;
  script_hash?: string;
  /**
   * "evaluate_v2" marks a C strategy card: its rules ARE its code, and it runs only through
   * `strategy-action`, never through create-backtest (which would deploy a different rule, or
   * nothing).
   */
  script_entry?: string;
  /** The saved strategy the card is a version of, and on a backtest card the row saved for it. */
  strategy_id?: string;
  backtest_id?: string;
  thresholds?: Record<string, number>;
  catalogue?: string;
  /**
   * False on a composed script the engine cannot run yet. Its card says so
   * itself; a create sent for it is a create with no FSM, refused as a 400 in
   * place of the card's own explanation.
   */
  runnable?: boolean;
}

export interface BacktestSetup {
  /**
   * "confirmed" is set by the backend once the user has already run this
   * backtest - it renders the frozen table without a re-clickable confirm.
   *
   * "run" means consent was already given in words and resolved against this
   * plan server-side (llm submit_plan: "confirm draws a button; run fires
   * without one"). This union previously stopped at "confirm", so a "run"
   * card typechecked while matching no branch: the card rendered its params
   * table with no button, no spinner and no error, and the flow simply
   * stopped dead after the user said "yes, run it".
   */
  stage: 'params' | 'confirm' | 'confirmed' | 'run';
  title?: string;
  rows: BacktestSetupRow[];
  backend_rows?: BacktestSetupRow[];
  terms?: BacktestSetupTerms;
  ask?: string;
}

/** The "backtest it first" action a create card offers beside "create it". */
export interface BacktestOffer {
  ask: string;
  label: string;
  /**
   * How far back the offer reaches. Decided server-side so this card and a
   * typed "yes, backtest it first" a turn later cover the same period.
   */
  window_days?: number;
}

/** `type:"strategies"` card payload (live/LOOP strategy, no backtest). */
export interface StrategySetup {
  /**
   * Set to "confirmed" by create-backtest on the message it created from, the
   * same rewrite that stamps a BacktestSetup. Optional because it is absent
   * until then - and it is the only durable "this turn already made a
   * strategy" mark, which /chart's auto-create reads so a reload does not make
   * a second one.
   *
   * "script_preview": composed and proved on the server; the card is the
   * usual one, with the script's receipt under it.
   */
  stage?: 'params' | 'confirm' | 'confirmed' | 'run' | 'script_preview';
  rows: BacktestSetupRow[];
  /**
   * Machine-shaped rows, when the card sends both. Only consulted where `terms` is absent, since
   * those take precedence.
   */
  backend_rows?: BacktestSetupRow[];
  terms?: BacktestSetupTerms;
  backtest_offer?: BacktestOffer;
}

/** One arm of a parallel sweep - a full plan plus the label it ranks under. */
export interface BacktestSweepVariant {
  /**
   * What distinguishes this variant, for the leaderboard row. One term differs
   * from the base and this names it, because eight rows of the same strategy
   * name ranked against each other explain nothing.
   */
  label: string;
  /** Prose table for a person. */
  rows: BacktestSetupRow[];
  /**
   * The same terms in machine shape. A variant is created from these, not from
   * its own rows - re-deriving a symbol out of prose is what put unrunnable
   * rows in the database.
   */
  terms?: BacktestSetupTerms;
}

/**
 * `type:"backtest_sweep"` - N variants of one idea run in parallel, ranked.
 *
 * "run" means consent was already resolved server-side against this sweep, so
 * the card fires the batch call itself. "running" is what the server writes
 * back once the variants exist, so a reload resumes reading them rather than
 * creating a second set; server ids always win over locally created ones.
 */
export interface BacktestSweep {
  stage: 'confirm' | 'run' | 'running';
  title?: string;
  /** One line on what is being varied and why - rendered as the "Varying" row. */
  rationale?: string;
  /** What every variant shares, so the comparison is about the one change. */
  held_constant?: {tickers?: string; period?: string; timeframe?: string};
  variants: BacktestSweepVariant[];
  ask?: string;
  /** Server-written once the rows exist, index-aligned with `variants`. */
  strategy_ids?: string[];
}

/**
 * What the backtest logs drawer opens on. `TStrategy` is the app's Strategy row; core does not
 * pin it so the drawer contract stays usable before the strategy type lands here.
 */
export interface BacktestLogsData<TStrategy = unknown> {
  strategy: TStrategy;
  trades: ExecutionLogEntry[];
  /** undefined for QTY sizing - there is no fixed capital pool to measure against. */
  initialBalance: number | undefined;
  finalBalance: number | undefined;
}

/**
 * Minimal shape the summary maths reads. Any richer trade type (ExecutionLogEntry, the screener's
 * TradeLogEntry, a closed TradeData mapped by the caller) structurally satisfies it.
 */
export interface BacktestTradeInput {
  pnl?: number | undefined;
  buy_time?: string | undefined;
  sell_time?: string | undefined;
  buy_price?: number | undefined;
  quantity?: number | undefined;
}

export interface TradeSummary {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  avgHoldTime: string;
  sharpeRatio: {value: number | null; tradingDays: number};
  /** Fraction (0.25 = 25%), only meaningful with a real capital baseline. */
  maxDrawdown: number;
  /**
   * Peak-to-trough of cumulative rupee P&L - needs no baseline at all, so this is what a
   * QTY-sized backtest (no fixed capital pool) shows instead of a percentage that would have to
   * be measured against a number that doesn't exist.
   */
  maxDrawdownAmount: number;
  /** Earliest buy to latest sell span in days, for annualising the total return. */
  periodDays: number;
}
