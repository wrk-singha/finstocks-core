// Type-only: a value import here drags screenerFilters -> screenerIndicators ->
// data/indicatorsConfig (59 KB) onto the startup path, since queryKeys is reached
// from app/_layout via use-notification-observer.
import type {
  ScreenerBackendFilters,
  ScreenerTimeframe,
} from './types/screenerFilters.ts';

/**
 * Centralized React Query key factory.
 *
 * Every reader (`useQuery({ queryKey })`) and every writer
 * (`invalidateQueries`, `prefetchQuery`, …) MUST build its key through this
 * module. Keys used to be inline string arrays scattered across ~30 files, so a
 * rename could silently break invalidation (no type error, just stale UI). With
 * the factory, a key change is one edit and the type checker catches drift.
 *
 * IMPORTANT: each function returns the EXACT array that was previously used
 * inline — same element order, same values. React Query matches keys by
 * structural (prefix) equality, so these arrays must not change shape.
 * Partial-match invalidations are intentional and preserved:
 *   - `chat.all()` → ["chat"] invalidates every ["chat", id]
 *   - `status.all()` → ["status"] invalidates ["status", isMockEnabled]
 */
export const queryKeys = {
  /** ["user"] */
  user: () => ['user'],

  /**
   * ["chats", "list"] — the paginated chat list (infinite query).
   * Deliberately NOT the bare ["chats"]: AuthContext still warms that exact
   * key with a plain (non-infinite) prefetch, and sharing it would hand
   * useInfiniteQuery a payload with no `pages`.
   */
  chats: () => ['chats', 'list'],

  /**
   * ["chats", "pinned"] — the pinned chats (plain query, not paginated).
   * Sibling of `chats()` under the same "chats" prefix, so never invalidate
   * the bare ["chats"]: that prefix also matches AuthContext's non-infinite
   * prefetch. Pin mutations invalidate `chats()` and `chatsPinned()` by name.
   */
  chatsPinned: () => ['chats', 'pinned'],

  /**
   * ["chats", "search", query, surface, category] — server-side title search.
   * Query, surface and category are part of the key so each term and chip
   * selection caches separately and a cleared search falls back to an
   * already-warm list rather than refetching.
   */
  chatsSearch: (query: string, surface: string, category = '') => [
    'chats',
    'search',
    query,
    surface,
    category,
  ],

  /** ["notifications"] — the notification inbox (infinite list) */
  notifications: () => ['notifications'],

  /** ["alert-preferences", scope] — one tab's alert channel subscriptions */
  alertPreferences: (scope: string) => ['alert-preferences', scope],

  /** ["notification-preferences"] — per-kind push switches */
  notificationPreferences: () => ['notification-preferences'],

  /** ["picks-log"] — the published picks track record */
  picksLog: () => ['picks-log'],

  /**
   * ["alert-history", scope] — alerts already sent, scoped to one tab's
   * channels. A filtered view of the same rows `notifications()` lists, so
   * marking one read must invalidate both. `alertHistoryAll()` is the bare
   * prefix that reaches every scope at once.
   */
  alertHistory: (scope: string) => ['alert-history', scope],
  alertHistoryAll: () => ['alert-history'],

  /** ["user-memory"] — the persistent cross-chat memory document */
  memory: () => ['user-memory'],

  chat: {
    /** ["chat"] — matches every chat detail key (broad invalidation) */
    all: () => ['chat'],
    /** ["chat", chatId] — a single chat's messages */
    detail: (chatId: string) => ['chat', chatId],
  },

  /** ["portfolios"] */
  portfolios: () => ['portfolios'],

  /** ["wallet"] — broker cash balance, from the nightly sync */
  wallet: () => ['wallet'],

  status: {
    /** ["status"] — matches any trade-status key (broad invalidation) */
    all: () => ['status'],
    /** ["status", isMockEnabled] — trade status for the current mock mode */
    withMock: (isMockEnabled: boolean) => ['status', isMockEnabled],
    /**
     * ["status", isMockEnabled, "rules"] — the same book WITH each strategy's
     * FSM rules. Keyed apart on purpose: the two payload shapes must not share
     * a cache entry, or a light fetch would strip the rules the console is
     * rendering from under it.
     */
    withRules: (isMockEnabled: boolean) => ['status', isMockEnabled, 'rules'],
  },

  /** ["dividends", market] */
  dividends: (market: string) => ['dividends', market],
  /** ["accord-news", section, search] */
  accordNews: (section: string, search: string) => [
    'accord-news',
    section,
    search,
  ],
  /** ["fundamentals", symbols, market] */
  fundamentals: (symbols: string[], market: string) => [
    'fundamentals',
    symbols,
    market,
  ],
  /** ["technicals", symbols, market, timeframe] */
  technicals: (symbols: string[], market: string, timeframe: string) => [
    'technicals',
    symbols,
    market,
    timeframe,
  ],
  /** ["strategyLogs", market, sorted strategyIds] — the same set asked in
   *  another order is the same question, so it must stay one cache entry. */
  strategyLogs: (market: string, strategyIds: string[]) => [
    'strategyLogs',
    market,
    [...strategyIds].sort(),
  ],
  /** ["backtestAnalysis", strategyId, peerKey] */
  backtestAnalysis: (strategyId: string | undefined, peerKey = '') => [
    'backtestAnalysis',
    strategyId,
    // A different peer set is a different question, so it must be a
    // different cache entry -- callers pass the ids SORTED and joined, so
    // the same set asked in another order stays one entry.
    peerKey,
  ],
  /** ["graphData", symbols, market, period, interval, isCompare, hmacToken, includeVolume] */
  graphData: (params: {
    symbols: string[];
    market: string;
    period: string;
    interval: string;
    isCompare: boolean;
    hmacToken?: string;
    includeVolume?: boolean;
  }) => [
    'graphData',
    // The response is a symbol-keyed map every consumer reads by name, so the
    // same set is the same cache entry however the caller ordered it. FnoPanel
    // moves the selected symbol to the front, which would otherwise refetch
    // the whole grid on every selection.
    [...new Set(params.symbols)].sort(),
    params.market,
    params.period,
    params.interval,
    params.isCompare,
    params.hmacToken,
    params.includeVolume,
  ],

  /**
   * ["screener-strategies", page, limit, isIntraday, isPremium, isFno, hasTodaysPick] — the
   * web's shape, which carries every filter the request sends; the mobile copy keyed on
   * hasTodaysPick alone and would have shared one cache entry across filters.
   */
  screenerStrategies: (
    page: number,
    limit: number,
    filters: {
      isIntraday?: boolean;
      isPremium?: boolean;
      isFno?: boolean;
      hasTodaysPick?: boolean;
    } = {},
  ) => [
    'screener-strategies',
    page,
    limit,
    filters.isIntraday ?? null,
    filters.isPremium ?? null,
    filters.isFno ?? null,
    filters.hasTodaysPick ?? null,
  ],
  /** ["screener-strategy-detail", strategyId, timeframe, year] */
  screenerStrategyDetail: (
    strategyId: number,
    timeframe: string,
    year: number,
  ) => ['screener-strategy-detail', strategyId, timeframe, year],

  // Canonical /market/* keys (distinct from the legacy ["dividends"] key).
  market: {
    /** ["market-recommendations", horizon] — "all" when no horizon is chosen. */
    recommendations: (horizon?: string) => [
      'market-recommendations',
      horizon ?? 'all',
    ],
    report: () => ['market-report'],
    strategyReport: () => ['market-strategy-report'],
    overview: () => ['market-overview'],
    /** ["institutional-flows", days] */
    institutionalFlows: (days: number) => ['institutional-flows', days],
    movers: () => ['market-movers'],
    news: () => ['market-news'],
    events: () => ['market-events'],
    /** ["market-depth", symbol] */
    depth: (symbol: string | null) => ['market-depth', symbol],
    /** ["market-screener-stocks", filters] — every field the request sends must
     *  be in the key, or two different server queries share one cache entry. */
    screenerStocks: (filters?: ScreenerBackendFilters) => [
      'market-screener-stocks',
      filters?.near_52w_high,
      filters?.high_volume,
      filters?.universe,
      filters?.interval,
      filters?.rsi_min,
      filters?.rsi_max,
      filters?.trend,
      filters?.ind,
    ],
    /** ["screener-indicators", interval?] */
    screenerIndicators: (interval?: ScreenerTimeframe) => [
      'screener-indicators',
      interval,
    ],
  },

  fno: {
    /** ["fno-ideas", underlying] */
    ideas: (underlying?: string) => ['fno-ideas', underlying ?? 'all'],
    /** ["fno-positions"] */
    positions: () => ['fno-positions'],
    /** ["fno-track-record", window] */
    trackRecord: (window = 'all') => ['fno-track-record', window],
    /** ["fno-chain-fallback", underlying, expiry] */
    chainFallback: (underlying: string, expiry?: string) => [
      'fno-chain-fallback',
      underlying,
      expiry ?? null,
    ],
    /** ["fno-expiries", underlying] */
    expiries: (underlying: string) => ['fno-expiries', underlying],
  },

  /** ["watchlists"] — the account's saved watches (drafts + active) */
  watchlists: () => ['watchlists'],
  /** ["watchlists", "pending-watch"] — the sentence/draft the open chat is
   *  working out, shared between the portfolio pane and the chat card. */
  pendingWatch: () => ['watchlists', 'pending-watch'],
};
