import type {BacktestSetup} from './backtest.ts';
import type {ChartPlan} from './chartPlan.ts';
import type {ChatCard} from './chatCards.ts';
import type {StrategyLog} from './strategyLogs.ts';
import type {Strategy} from './trade.ts';

/**
 * Union of the two apps' chat contracts (drift resolved 2026-09-13). The mobile copy is the
 * newer one — it carries `category`, `surface` and typed `tool_calls` — so its shapes win where
 * the two disagree on a field's type; the web-only request/response pairs (title rename, the
 * shared-chat envelope's strategies) are added alongside.
 */

export interface ToolCall {
  id: string;
  tool: string;
  status: 'loading' | 'success' | 'error';
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  /** 1 = liked, 0 = neutral, -1 = disliked */
  like_status?: number;
  tool_calls?: ToolCall[];
}

/** The llm service's routes (`llm/graph/routing/routes.py`) a chat can be filed under. */
export type ChatCategory =
  'research' | 'strategy' | 'autopilot' | 'portfolio' | 'order';

export interface Chat {
  id: string;
  user_id: number;
  title: string;
  model: string;
  /**
   * Which product surface owned the chat ("chart" for the terminal dock, "watchlist",
   * "screener", …; absent or "" for the dashboard's default chat).
   */
  surface?: string;
  /** Symbol open on the chart at creation time; scopes the terminal's per-symbol history. */
  symbol?: string;
  created_at: string;
  updated_at: string;
  // drift resolved 2026-09-13: web declared `pinned: boolean` required, mobile optional.
  // Optional wins — rows that predate the column carry no value, and a reader must handle
  // absence either way.
  pinned?: boolean;
  pinned_at?: string;
  /** Branch that last answered the chat, from the llm service's thread state. Absent on chats that predate it. */
  category?: ChatCategory;
}

export interface ChatWithMessages extends Chat {
  messages: ChatMessage[];
}

export interface SendMessageRequest {
  chat_id: string;
  message: string;
}

/** Legacy streaming frame kinds (mobile). The `done` frame is `SSEDonePayload`. */
export interface StreamResponse {
  type: 'thinking' | 'response' | 'complete' | 'error';
  content?: string;
  thinking_steps?: string[];
  symbols?: string[];
  tools_used?: string[];
  strategy_ids?: number[];
}

export interface getAllChatsResponse {
  chats: Chat[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface getChatByIdRequest {
  id: string;
}

// drift resolved 2026-09-13: web inlined a looser shape (`role: string`, no tool_calls);
// mobile's `ChatWithMessages` is the same rows typed precisely, so it wins.
export type getChatByIdResponse = ChatWithMessages;

export interface deleteChatRequest {
  id: string;
}

export interface deleteChatResponse {
  success: boolean;
}

export interface pinChatRequest {
  id: string;
  pinned: boolean;
}

export interface pinChatResponse {
  success: boolean;
  // drift resolved 2026-09-13: web reads the echoed state back, mobile ignored it. The handler
  // echoes it, so it is on the wire; web wins.
  pinned: boolean;
}

export interface createChatRequest {
  title: string;
  model: string;
  /** Chat origin ("chart" for the terminal panel); omit for the dashboard's default chat. */
  surface?: string;
  /** Symbol open on the chart at creation time. Chart surface only. */
  symbol?: string;
}

export interface createChatResponse {
  chat_id: string;
  title: string;
  model: string;
}

export interface updateChatTitleRequest {
  id: string;
  title: string;
  silent?: boolean;
}

export interface updateChatTitleResponse {
  success: boolean;
}

export interface likeMessageRequest {
  message_id: string;
  /** 1 = liked, 0 = neutral, -1 = disliked */
  like_status: number;
}

export interface likeMessageResponse {
  success: boolean;
  like_status: number;
}

export interface shareChatRequest {
  chat_id: string;
  /** Omitted for a chat-scoped share; present to share one assistant response plus its prompting turn. */
  message_id?: string;
}

export interface shareChatResponse {
  share_link_uuid: string;
}

export interface getSharedChatRequest {
  chat_id: string;
}

export interface SharedChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
  like_status?: number;
  tool_calls?: ToolCall[];
}

/**
 * The chat as the public share route serves it: the owner's row minus what a logged-out
 * viewer has no business seeing.
 */
export interface SharedChat {
  id: string;
  user_id?: number;
  title: string;
  model: string;
  created_at: string;
  updated_at?: string;
  /**
   * Which product surface owned the chat ("chart", "watchlist", "screener", …; "" for the
   * dashboard). A share link renders under its origin surface's card rules rather than
   * defaulting to the dashboard's.
   */
  surface?: string;
  symbol?: string;
  messages: SharedChatMessage[];
}

/**
 * The backend wraps the chat in an envelope (backend-go handlers/chat/share.go
 * GetSharedChatHandler) — unlike getChatByIdResponse this is NOT the bare chat object.
 * drift resolved 2026-09-13: mobile typed `{chat, hmac_token}` only; web's envelope also carries
 * the strategies and logs the shared cards render from, so web wins. `hmac_token` was required
 * on mobile and optional on web; optional wins because web documents it as the logged-out
 * viewer's token, which a signed-in viewer may not be issued.
 */
export interface getSharedChatResponse {
  chat: SharedChat;
  strategies: Strategy[];
  strategy_logs: StrategyLog[];
  share_scope?: 'chat' | 'message';
  /** Short-lived token letting a logged-out viewer read this chat's chart bars through the public /share/graph-data route. */
  hmac_token?: string;
}

export interface forkChatRequest {
  share_id: string;
}

export interface forkChatResponse {
  chat_id: string;
  source_chat_id: string;
  messages_count: number;
  backtests_count: number;
}

/** A single news-source citation carried on a bot envelope / the `done` frame. */
export interface NewsCitation {
  id: string;
  title: string;
  source?: string;
  url?: string | null;
  published_at?: string;
  publisher_domain?: string;
}

/**
 * The planner's own per-step purpose text, joined — what a research action bar prefills an
 * alert/backtest with instead of generic "on these criteria" boilerplate.
 */
export interface ChatChipContext {
  criteria: string;
  alert_condition?: string;
}

/**
 * What the model is allowed to say about a turn it did not compute.
 *
 * The session owns the conversation but no facts: every number it speaks arrives here, from the
 * ordinary chat turn. `speak` is the spoken rendering of that answer; `speak_policy` "verbatim"
 * means it must be said as written, because a rounded price is a wrong price.
 */
export interface VoiceEnvelope {
  speak: string;
  speak_policy: 'verbatim' | 'free';
  card_shown: boolean;
  offers_open: {id: string; label: string}[];
  detail: Record<string, unknown>;
}

/**
 * Short-lived credential for a speech-to-speech session, minted per session by the backend. The
 * session's instructions and tool surface are attached to it server-side, so neither ever
 * reaches the client. `cold` means the chat is empty and the assistant should open the
 * conversation rather than wait.
 */
export interface VoiceSessionResponse {
  client_secret: string;
  expires_at?: number;
  model?: string;
  tool_name?: string;
  cold?: boolean;
}

/** Extra asks for a single turn, beyond the text itself. Union of the web and mobile members. */
export interface ChatSendOptions {
  isMockOverride?: boolean;
  /** This turn will be spoken aloud, so the answer needs a spoken rendering. */
  voice?: boolean;
  /** Fires when that rendering arrives; the voice session hands it to the model. */
  onVoice?: (envelope: VoiceEnvelope) => void;
  /**
   * Pins this ONE turn's route, same contract as the composer's mode button but for a single
   * send rather than the whole conversation.
   */
  mode?: string;
}

/**
 * What a prewritten prompt is about, pinned above the composer once the chat opens so
 * "what about the exit rule" keeps its referent. Shared by lessons and the start-chat hooks.
 */
export interface ChatContext {
  label: string;
  sublabel?: string;
  /** Stock symbol, when there is one, for the logo. */
  symbol?: string;
}

/**
 * The `done` frame of a streamed turn, as the wire carries it. Fields are optional because a
 * frame carries only what the turn produced; a consumer folds them onto the trailing message.
 */
export interface SSEDonePayload {
  cards?: ChatCard[] | null;
  tools_used?: string[];
  symbols?: string[];
  strategy_ids?: string[];
  suggested_replies?: string[];
  investment_amount?: number;
  response?: string;
  backtest_setup?: BacktestSetup | null;
  /** Routing lane the turn resolved to (e.g. "strategy"/"autopilot") — gates the legacy symbols→buy-card fallback. */
  routed_by?: string;
  /** What the plan substituted or dropped to answer this turn — receipt shown below the answer. */
  assumptions?: string[];
  /** How the turn read the question, one line per part — resolved before any row is fetched. */
  read_as?: string[];
  /** A read of the figures is being written and will arrive on its own frame after this one. */
  analysis_pending?: boolean;
  chart_plan?: ChartPlan | null;
  news_citations?: NewsCitation[];
  chip_context?: ChatChipContext | null;
  /** The persisted row id for the reply, for card actions that need to bind to it. */
  message_id?: string;
  /** A server-generated title the chat picks up after its first turn. */
  chat_title?: string;
  /** Present only when the turn asked for a spoken rendering (`voice: true`). */
  voice?: VoiceEnvelope | null;
}

export type ChatDoneFrame = SSEDonePayload;

/**
 * One streamed chat turn, normalised (web's `StreamChatResult`): every field present, absence
 * spelled as null or empty, so the two transports (SSE and websocket) fill one shape.
 */
export interface StreamChatResult {
  finalBotReply: string;
  intent: string;
  // drift resolved 2026-09-13: the wire frame's `investment_amount` is a number (mobile
  // SSEDonePayload); web's normalised result keeps the string it always held, since that is
  // web's own contract with its renderers, not the backend's.
  investment_amount: string | null;
  suggestedReplies: string[];
  /** The read of a screen's figures. Written after the answer is delivered, so it rides its own trailing event. */
  analysis: string;
  /** True when the turn is still writing one. Read off `done`, before the text exists. */
  analysisPending: boolean;
  /** The conditions the turn read the question as, one line per part. */
  readAs: string[];
  /** What the plan decided the question did not say, sent on `done` once the turn has finished executing. */
  assumptions: string[];
  newsCitations: NewsCitation[];
  /** Absent when there's no spec (non-research turns). */
  chipContext: ChatChipContext | null;
  symbols: string[] | null;
  toolsUsed: string[] | null;
  strategyIds: string[] | null;
  cards: ChatCard[] | null;
  chartPlan: ChartPlan | null;
  messageId: string | null;
  chatTitle: string | null;
  routedBy: string | null;
  /** Present only when the turn asked for a spoken rendering. */
  voice: VoiceEnvelope | null;
}
