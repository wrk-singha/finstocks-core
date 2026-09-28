import type {
  Chat,
  ChatCategory,
  SSEDonePayload,
  VoiceSessionResponse,
  createChatRequest,
  createChatResponse,
  forkChatRequest,
  forkChatResponse,
  getAllChatsResponse,
  getChatByIdResponse,
  getSharedChatResponse,
  likeMessageResponse,
  pinChatResponse,
  shareChatRequest,
  shareChatResponse,
} from '../types/chat.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

/** A string param that is empty is left out like an unset one, as web's client leaves it out. */
export interface ChatListQuery {
  /** Opaque keyset token echoed back as `next_cursor`; the backend defaults limit to 30 and caps it at 100. */
  cursor?: string | null;
  limit?: number;
  /**
   * Scopes the list to one product surface. Omitted entirely, the backend
   * filters to the unscoped "dashboard" bucket only.
   */
  surface?: string;
  symbol?: string;
  q?: string;
  /** Comma-joined chat categories (`chatCategoryParam`); omitted entirely when none selected. */
  category?: string;
  /** Last-activity window in days; left out when unset (or zero), which is no limit. */
  days?: number | null;
}

/**
 * The `category` query value for a chip selection, and the matching segment of
 * `queryKeys.chatsSearch`. Sorted so one set is one cache entry and one request
 * whatever order the chips were tapped in; '' when nothing is selected.
 */
export const chatCategoryParam = (
  categories: readonly ChatCategory[],
): string => [...categories].sort().join(',');

/** POST body of a streamed turn — the same for the SSE endpoint and the websocket `chat_message` frame. */
export interface ChatStreamRequest {
  chat_id: string;
  message: string;
  model: string;
  market: 'IN';
  is_mock: boolean;
  strategy_id?: string;
  /** Which chat surface this turn came from ("chart" for the terminal dock); the backend routes on it. */
  surface?: string;
  /** Which mode button the user has down, as a route name. */
  mode?: string;
  /** This turn will be spoken aloud, so the answer needs a spoken rendering. */
  voice?: true;
  page_context?: Record<string, unknown>;
}

export interface ChatStreamParams {
  chatId: string;
  message: string;
  market: 'IN';
  isMock: boolean;
  model?: string;
  strategyId?: string;
  surface?: string;
  mode?: string;
  voice?: boolean;
  pageContext?: Record<string, unknown>;
}

/** Builds the wire body once so neither transport can drift from the other. */
export const chatStreamRequest = (p: ChatStreamParams): ChatStreamRequest => ({
  chat_id: p.chatId,
  message: p.message,
  model: p.model ?? 'default',
  market: p.market,
  is_mock: p.isMock,
  ...(p.strategyId ? {strategy_id: p.strategyId} : {}),
  ...(p.surface ? {surface: p.surface} : {}),
  ...(p.mode ? {mode: p.mode} : {}),
  ...(p.voice ? {voice: true as const} : {}),
  ...(p.pageContext ? {page_context: p.pageContext} : {}),
});

/** POST here with a `ChatStreamRequest` body; the response is an SSE stream of `ChatStreamEvent`s. */
export const chatStreamPath = '/chats/stream/sse';
/** Web-only: GET re-attaches to a running turn; 204 when none is in flight. */
export const chatResumeStreamPath = (chatId: string) =>
  `/chats/${chatId}/stream`;
/** Web-only: the websocket transport; the bearer rides in the query because browsers cannot set WS headers. */
export const chatWsPath = (token: string) => `/chats/ws${query({token})}`;

export interface ChatTokenEvent {
  type: 'token';
  data: {token: string};
}
export interface ChatThinkingEvent {
  type: 'thinking';
  data: {description: string};
}
/** Mobile-only frames: the tool ledger the chat renders live. */
export interface ChatToolCallEvent {
  type: 'tool_call';
  data: Record<string, unknown>;
}
export interface ChatToolResultEvent {
  type: 'tool_result';
  data: Record<string, unknown>;
}
/**
 * Authoritative completion frame. The streamed tokens are the narrator's raw
 * prose; the backend post-processes the answer after narration and sends the
 * corrected text in `response` (or the older `bot_response`).
 */
export interface ChatDoneEvent {
  type: 'done';
  data: SSEDonePayload & {bot_response?: string};
}
/** Sent after `done`: the read of the figures, once the model has interpreted them. */
export interface ChatAnalysisEvent {
  type: 'analysis';
  data: {analysis?: string};
}
/** Sent after `done` on purpose — the chips cost a full model round trip. */
export interface ChatSuggestedRepliesEvent {
  type: 'suggested_replies';
  data: {suggested_replies?: unknown[]};
}
export interface ChatErrorEvent {
  type: 'error';
  data: {error?: string; message?: string};
}
/** Websocket-only: the turn's last frame, after which the socket is idle. */
export interface ChatTurnEndEvent {
  type: 'turn_end';
  data?: undefined;
}
/** Websocket-only housekeeping frames; a client ignores both. */
export interface ChatConnectionEvent {
  type: 'connected' | 'pong';
  data?: undefined;
}

export type ChatStreamEvent =
  | ChatTokenEvent
  | ChatThinkingEvent
  | ChatToolCallEvent
  | ChatToolResultEvent
  | ChatDoneEvent
  | ChatAnalysisEvent
  | ChatSuggestedRepliesEvent
  | ChatErrorEvent
  | ChatTurnEndEvent
  | ChatConnectionEvent;

/** Frames a client writes to the websocket. */
export type ChatWsClientMessage =
  | {type: 'chat_message'; data: ChatStreamRequest}
  | {type: 'stop'; data: {chat_id: string}}
  | {
      type: 'chart_ack';
      data: {chat_id: string; plan_id: string; ok: boolean; detail?: string};
    };

// An empty search or surface is no filter at all: sent as `surface=`, it would leave the backend to
// guess that the empty value means the unscoped dashboard bucket.
const present = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value === '' ? undefined : value;

export const chatApi = (http: HttpClient) => ({
  // drift resolved 2026-09-13: the web forced limit=30 client-side, the mobile left it to
  // the backend default (also 30) and added category; the mobile copy won.
  getAllChats: (params?: ChatListQuery) =>
    http.request<getAllChatsResponse>(
      `/chats${query({
        cursor: present(params?.cursor),
        limit: params?.limit,
        surface: present(params?.surface),
        symbol: present(params?.symbol),
        q: present(params?.q),
        category: present(params?.category),
        days: (params?.days ?? 0) > 0 ? params?.days : undefined,
      })}`,
    ),

  /** Pinned chats come from the same collection, filtered and unpaginated. */
  getPinnedChats: () =>
    http.request<{chats: Chat[]}>(`/chats${query({pinned: true})}`),

  getChatById: (chatId: string) =>
    http.request<getChatByIdResponse>(`/chats/${chatId}`),

  createChat: (data: createChatRequest) =>
    http.request<createChatResponse>('/chats', {method: 'POST', body: data}),

  deleteChat: (chatId: string) =>
    http.request<{success: boolean}>(`/chats/${chatId}`, {method: 'DELETE'}),

  pinChat: (chatId: string, pinned: boolean) =>
    http.request<pinChatResponse>(`/chats/${chatId}/pin`, {
      method: 'PUT',
      body: {pinned},
    }),

  updateChatTitle: (chatId: string, title: string) =>
    http.request<{success: boolean}>(`/chats/${chatId}/title`, {
      method: 'PUT',
      body: {title},
    }),

  likeMessage: (messageId: string, likeStatus: number) =>
    http.request<likeMessageResponse>('/chats/like', {
      method: 'POST',
      body: {message_id: messageId, like_status: likeStatus},
    }),

  shareChat: (data: shareChatRequest) =>
    http.request<shareChatResponse>('/share/chat', {
      method: 'POST',
      body: data,
    }),

  /** Public: the read-only viewer needs no session. */
  getSharedChat: (shareId: string) =>
    http.request<getSharedChatResponse>(`/share/chat/${shareId}`, {
      anonymous: true,
    }),

  forkChat: (data: forkChatRequest) =>
    http.request<forkChatResponse>('/share/chat/fork', {
      method: 'POST',
      body: data,
    }),

  /**
   * Cancels a turn server-side. Aborting the request alone is
   * indistinguishable from a refresh — and a refresh must leave the turn
   * running — so the backend keeps generating (and billing) until told.
   */
  stopStream: (chatId: string) =>
    http.request<unknown>('/chats/stream/stop', {
      method: 'POST',
      body: {chat_id: chatId},
    }),

  /** Mobile-only: the user id comes from the JWT, never the body. */
  startVoiceSession: (chatId: string) =>
    http.request<VoiceSessionResponse>('/voice/session', {
      method: 'POST',
      body: {chat_id: chatId},
    }),

  /**
   * Mobile-only: the assistant was cut off mid-sentence. Only how long it
   * played is known, so the server records the position and leaves the text
   * as generated.
   */
  reportHeard: (messageId: string, audioEndMs: number) =>
    http.request<unknown>('/chats/heard', {
      method: 'POST',
      body: {
        message_id: messageId,
        heard: '',
        audio_end_ms: Math.max(0, Math.round(audioEndMs)),
      },
    }),
});

export type ChatApi = ReturnType<typeof chatApi>;
