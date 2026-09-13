import type {BacktestSetup, BacktestSweep, StrategySetup} from './backtest.ts';
import type {DataTablePayload} from './dataTable.ts';
import type {
  FindingAction,
  PortfolioAnalysis,
  PortfolioAnalysisPosition,
} from './portfolioAnalysis.ts';
import type {PortfolioSimPayload} from './portfolioSim.ts';
import type {OrderSide, OrderType} from './trade.ts';
import type {WatchlistAlertSetup} from './watchlist.ts';

/**
 * Typed chat card list emitted by the LLM on the completion frame (`cards[]`).
 *
 * The backend derives these server-side from the same signals the clients used to infer cards
 * from (`symbols` / `tools_used` / `strategy_ids`), so `cards` is the authoritative render list.
 * Messages that predate this field carry no `cards`, and the renderer falls back to its legacy
 * `tools_used` inference for them.
 */
export type ChatCard =
  | {
      type: 'autopilot';
      investment_amount: number;
      payload: {stage: 'confirm' | 'live' | 'stop'};
    }
  // drift resolved 2026-09-13: mobile required `symbols` and added `investment_amount?`; web
  // had `symbols?` only. Optional `symbols` wins (a reader must handle an empty news card
  // either way) and mobile's `investment_amount?` is kept.
  | {type: 'news'; symbols?: string[]; investment_amount?: number}
  | {type: 'dividends'}
  | {type: 'strategy'; payload: {strategy_ids: string[]}}
  | {type: 'strategies'; payload: StrategySetup}
  /**
   * template_ids are the server's relevance pick for what the user asked. Absent on older
   * stored messages, which fall back to the library list.
   */
  | {type: 'suggested_strategies'; payload?: {template_ids?: number[]}}
  | {type: 'backtest'; payload: BacktestSetup}
  | {type: 'backtest_sweep'; payload: BacktestSweep}
  | {type: 'watchlist_alert'; payload: WatchlistAlertSetup}
  | {
      type: 'portfolio_sim';
      investment_amount?: number;
      payload: PortfolioSimPayload;
    }
  /**
   * The general "what is my portfolio analysis" answer — headline, health score, top findings
   * (same field shape the standalone Portfolio page renders), plus the exhaustive per-position
   * list. `actions` are this answer's own follow-ups, not a separate "actions" card.
   */
  | {
      type: 'portfolio_analysis';
      payload: {
        analysis: PortfolioAnalysis;
        actions: FindingAction[];
        /** Optional: a message saved before this field existed carries none. */
        positions?: PortfolioAnalysisPosition[];
      };
    }
  | {type: 'data_table'; payload: DataTablePayload}
  /**
   * Card-agnostic follow-up buttons for a plain-text answer — reuses the `FindingAction` shape
   * so any branch can attach `[Why?]`/`[Show X]`-style buttons without a bespoke card.
   */
  | {type: 'actions'; payload: {actions: FindingAction[]}}
  /**
   * A derivatives turn. Carries only the underlyings, which the backend has already checked
   * have contracts trading — the chain itself streams live on the client.
   */
  | {type: 'fno'; payload: {underlyings: string[]}}
  /**
   * An order the assistant read off the user's instruction. It does NOT place anything: the
   * ticket renders pre-filled and the user confirms it there, through the same path as every
   * other order in the product.
   */
  | {
      type: 'order';
      payload: {
        symbol: string;
        side: OrderSide;
        /**
         * Absent when the user named no quantity. The model is forbidden from inventing one, so
         * the ticket asks for it rather than showing a number nobody chose.
         */
        quantity?: number;
        order_type: OrderType;
        limit_price?: number;
        /** The user has said yes to exactly this order. Absent means still a proposal. */
        confirmed?: true;
        /**
         * Minted per confirmation, so a placement happens exactly once across re-renders.
         * Deliberately not derived from the order's contents: two identical buys are two orders.
         */
        order_id?: string;
      };
    };

export type ChatCardType = ChatCard['type'];

/** The card variant carrying a given `type`, for renderers that switch on it. */
export type ChatCardOf<T extends ChatCardType> = Extract<ChatCard, {type: T}>;
