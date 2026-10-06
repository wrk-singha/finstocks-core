import type {BacktestSetup, BacktestSweep, StrategySetup} from './backtest.ts';
import type {CustomIndicatorDraft} from './customIndicator.ts';
import type {DataTablePayload} from './dataTable.ts';
import type {ManualReportPayload} from './manualReport.ts';
import type {ProfileSnapshot} from './marketProfile.ts';
import type {
  DepthInterpretation,
  DepthLevel,
  PreOpenAuction,
} from './market.ts';
import type {
  FindingAction,
  PortfolioAnalysis,
  PortfolioAnalysisPosition,
} from './portfolioAnalysis.ts';
import type {PortfolioSimPayload} from './portfolioSim.ts';
import type {RsSectorMatrix} from './rsSectorMatrix.ts';
import type {AlertSetup} from './savedAlert.ts';
import type {OrderSide, OrderType} from './trade.ts';

/**
 * The sector reading a sectors answer was written from (llm graph/nodes/sectors/node.py `_card`):
 * the matrix as read, the sector the answer is about, the pair when one was asked, and `source`,
 * the code-built line saying which close it is from.
 */
export interface SectorsCardPayload {
  matrix: RsSectorMatrix;
  focus: string;
  highlight: string[];
  pair: {row: string; col: string} | null;
  source: string;
  /** How the standings are worked out, in plain words; web shows it on hover over `source`. Absent on older messages. */
  method?: string;
}

/**
 * The market profiles a market-profile answer was written from (llm graph/nodes/market_profile/
 * node.py `_card`): one per instrument, as read, with `source` the code-built line saying which
 * session and when. `horizon` is which setups the question was about.
 */
export interface MarketProfileCardPayload {
  horizon: 'intraday' | 'swing' | 'both';
  profiles: {
    name: string;
    page: string;
    profile: ProfileSnapshot;
    source: string;
  }[];
}

/**
 * One order book the depth branch read (llm graph/nodes/depth/node.py), as it stood when read.
 * `source` is the code-built line saying where and when — "NSE order book · as of 23 Sep, 3:11 PM
 * IST" — and `live` is true only for a book seen in the last two minutes, so an older one is never
 * shown as live. `status` "index" means `symbol` is the index's nearest future, read instead.
 */
export interface DepthCardBook {
  query: string;
  status: 'stock' | 'contract' | 'index';
  symbol: string;
  /** How a person names it: "NIFTY 25000 CE · 6 Oct"; the symbol for a stock. */
  name?: string;
  /** A contract's parts, which its own page is addressed by; absent for a stock. */
  contract?: {
    underlying: string;
    expiry: string;
    strike: number;
    right: 'FUT' | 'CE' | 'PE';
  } | null;
  live: boolean;
  source: string;
  ltp?: number | null;
  bids: DepthLevel[];
  asks: DepthLevel[];
  total_bid_qty: number;
  total_ask_qty: number;
  as_of?: number;
  interpretation?: DepthInterpretation | null;
  interpretation_error?: string;
  auction?: PreOpenAuction | null;
}

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
  | {type: 'watchlist_alert'; payload: AlertSetup}
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
   * A derivatives turn. Carries the underlyings, which the backend has already checked have
   * contracts trading — the chain itself streams live on the client — and, when the user
   * described an option order, what they named of it.
   */
  | {type: 'fno'; payload: {underlyings: string[]; draft?: FnoOrderDraft}}
  /**
   * An indicator the assistant built from what the user brought — English, Pine Script, AFL, a
   * formula. Offered, not kept: it is saved only when the user presses Save, and only then lists
   * in the chart picker.
   */
  | {type: 'custom_indicator'; payload: CustomIndicatorDraft}
  /**
   * A stock's research report: Finstocks research guidance for its industry and cap band applied
   * item by item, with the note an investor reads. The card is the short summary; the report
   * itself opens on its own screen. There is no endpoint: the payload is the whole report.
   */
  | {type: 'report'; payload: ManualReportPayload}
  /** The order books a depth answer is written from, one card per book. */
  | {type: 'depth'; payload: {books: DepthCardBook[]}}
  /** The sector reading a sectors answer is written from. */
  | {type: 'sectors'; payload: SectorsCardPayload}
  /** The market profiles a market-profile answer is written from. */
  | {type: 'market_profile'; payload: MarketProfileCardPayload}
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

/**
 * An option order the user described in chat — only the parts they named. The chain's ticket opens
 * on it; the premium stays the live one.
 */
export interface FnoOrderDraft {
  underlying: string;
  side: 'buy' | 'sell';
  lots?: number;
  /** Absent means the at-the-money strike. */
  strike?: number;
  right?: 'CE' | 'PE';
  /** YYYY-MM-DD; absent means the nearest expiry. */
  expiry?: string;
}

export type ChatCardType = ChatCard['type'];

/** The card variant carrying a given `type`, for renderers that switch on it. */
export type ChatCardOf<T extends ChatCardType> = Extract<ChatCard, {type: T}>;
