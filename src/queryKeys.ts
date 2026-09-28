// Type-only: a value import here drags screenerFilters -> screenerIndicators ->
// data/indicatorsConfig (59 KB) onto the startup path, since queryKeys is reached
// from app/_layout via use-notification-observer.
import type {ScreenRequest} from './types/screen.ts';
import type {
  ScreenerBackendFilters,
  ScreenerTimeframe,
} from './types/screenerFilters.ts';
import type {
  FundamentalsSection,
  StatementBasis,
} from './types/fundamentalsDetail.ts';
import type {WatchlistSearchType} from './types/stockWatchlist.ts';
import type {GetStockEventsRequest} from './types/stockEvents.ts';
import type {PeerTableQuery} from './types/industries.ts';

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

  auth: {
    /** ["auth", "reset-token", token] — the emailed reset link, checked before the form shows. */
    resetToken: (token: string) => ['auth', 'reset-token', token],
  },

  orders: {
    /** ["orders", "pending-trade"] — the agent's current unresponded trade proposal. */
    pendingTrade: () => ['orders', 'pending-trade'],
  },

  brokers: {
    /** ["brokers", "reserved-ip"] — the account's outbound IP, one per account whatever the broker. */
    reservedIp: () => ['brokers', 'reserved-ip'],
    /** ["brokers", "zerodha-exchange", requestToken] — one entry per single-use Kite token. */
    zerodhaExchange: (requestToken: string) => [
      'brokers',
      'zerodha-exchange',
      requestToken,
    ],
    /** ["brokers", "upstox-exchange", code] — one entry per single-use Upstox code. */
    upstoxExchange: (code: string) => ['brokers', 'upstox-exchange', code],
    /** ["brokers", "oauth-confirm"] — the redirect screen's re-check of the profile. */
    oauthConfirm: () => ['brokers', 'oauth-confirm'],
  },

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
   * ["chats", "surface", surface] — one surface's recent threads (terminal dock, console
   * assistant). Beside `chats()` = ["chats", "list"], so a surface called "list" cannot collide.
   */
  chatsSurface: (surface: string) => ['chats', 'surface', surface],

  /**
   * ["chats", "search", query, surface, category, days] — server-side title search.
   * Query, surface and category are part of the key so each term and chip
   * selection caches separately and a cleared search falls back to an
   * already-warm list rather than refetching. `days` is the last-activity
   * window (null for none), so a filtered list stays inside the family that
   * pin, rename and delete writes reach by the ["chats", "search"] prefix.
   */
  chatsSearch: (
    query: string,
    surface: string,
    category = '',
    days: number | null = null,
  ) => ['chats', 'search', query, surface, category, days],

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
  /**
   * ["fundamentals-detail", symbol, sections, basis, periods, limit] — one entry per section
   * set, basis and depth, which is what makes the surface progressive: opening Financials
   * fetches the statements and leaves ownership unfetched, and asking for every year is a
   * second, wider entry that does not invalidate the five-year one on screen. The sections are
   * sorted and joined, so the same set asked in another order is the same entry.
   */
  fundamentalsDetail: (
    symbol: string | null,
    sections: readonly FundamentalsSection[],
    basis: StatementBasis,
    periods: number,
    limit?: number,
  ) => [
    'fundamentals-detail',
    symbol,
    [...sections].sort().join(','),
    basis,
    periods,
    limit,
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
    /** ["world-indices", days, indexId] — a one-index window and the full table are different
     *  responses, so the id (null for the table) is part of the key. */
    worldIndices: (days: number, indexId?: number | null) => [
      'world-indices',
      days,
      indexId ?? null,
    ],
    movers: () => ['market-movers'],
    news: () => ['market-news'],
    events: () => ['market-events'],
    /** ["stock-events", from, to, categories, caps, symbols] — each list joined in the order
     *  sent, and "" for a filter left out, so a request without dates keys apart from any
     *  window the server might answer it with. */
    stockEvents: (params: GetStockEventsRequest) => [
      'stock-events',
      params.from ?? '',
      params.to ?? '',
      (params.category ?? []).join(','),
      (params.cap ?? []).join(','),
      (params.symbol ?? []).join(','),
    ],
    /** ["market-depth", symbol] */
    depth: (symbol: string | null) => ['market-depth', symbol],
    /** ["ipo-list", status] — one IPO board ("open", "closed", "upcoming"). */
    ipoList: (status: string) => ['ipo-list', status],
    /** ["ipo-detail", ipocode] — one issue, by the vendor's `ipocode`. */
    ipoDetail: (ipocode: number | null) => ['ipo-detail', ipocode],
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
    /**
     * ["ai-signals", symbol, resolution, closedKey] — keyed on the closed bars the request sends,
     * not the view, which pans, and not the forming candle, which the engine never reads: a live
     * chart asks again once per closed bar and panning costs nothing.
     */
    aiSignals: (symbol: string, resolution: string, closedKey: string) => [
      'ai-signals',
      symbol,
      resolution,
      closedKey,
    ],
    /** ["pattern-vocab"] — every pattern the scanner answers: the registry compiled into the
     *  backend, the same for every symbol and day, so it is fetched once and kept. */
    patternVocab: () => ['pattern-vocab'],
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
    /** ["fno-top-traded"] — the most traded futures contracts today */
    topTraded: () => ['fno-top-traded'],
    /** ["fno-index-underlyings"] — the index underlyings with a listed option chain */
    indexUnderlyings: () => ['fno-index-underlyings'],
  },

  /** ["stockScore", symbol] — one stock's FinStocks score and pillars */
  stockScore: (symbol: string | null) => ['stockScore', symbol],

  /** ["ownership", symbol] — one stock's holder register, bulk and block deals and insider
   *  trades; no symbol is "" rather than null, as web keys it */
  ownership: (symbol: string | null) => ['ownership', symbol ?? ''],

  portfolioAnalysis: {
    /** ["portfolioAnalysis"] — every mode and segment (pull-to-refresh) */
    all: () => ['portfolioAnalysis'],
    /** ["portfolioAnalysis", mode, segment] — one book's AI analysis */
    detail: (mode: 'SIMULATION' | 'LIVE', segment: 'equity' | 'fno') => [
      'portfolioAnalysis',
      mode,
      segment,
    ],
  },

  /** ["watchlists"] — the account's saved alerts (drafts + active); the key
   *  keeps the endpoint's pre-rename name */
  savedAlerts: () => ['watchlists'],
  /** ["watchlists", "pending-watch"] — the sentence/draft the open chat is
   *  working out, shared between the portfolio pane and the chat card. */
  pendingWatch: () => ['watchlists', 'pending-watch'],

  /**
   * The account's stock watchlists — the lists of instruments a person
   * follows, not the saved alerts above. `lists()` is the prefix of every
   * other key here, so a prefix invalidation reaches all of them; the list
   * writes themselves target it `exact`.
   */
  stockWatchlists: {
    /** ["stock-watchlists"] — every list on the account */
    lists: () => ['stock-watchlists'],
    /** ["stock-watchlists", "write"] — a mutation key, not a query: every
     *  list write carries it, so `isMutating` can tell the last of a burst */
    writes: () => ['stock-watchlists', 'write'],
    /** ["stock-watchlists", "details", listId, symbols] — one list's
     *  advanced-view rows. Keyed on the symbols too, joined, so an add or a
     *  remove refetches the rows it changed. */
    details: (listId: string | undefined, symbols: readonly string[]) => [
      'stock-watchlists',
      'details',
      listId,
      symbols.join(','),
    ],
    /** ["stock-watchlists", "flags"] — colour flags, one per symbol across
     *  every list */
    flags: () => ['stock-watchlists', 'flags'],
    /** ["stock-watchlists", "removed"] — what came off a list, newest first */
    removed: () => ['stock-watchlists', 'removed'],
    /** ["stock-watchlists", "search", type, TERM] — trimmed and upper-cased,
     *  so a change of case never splits the cache */
    search: (term: string, type: WatchlistSearchType) => [
      'stock-watchlists',
      'search',
      type,
      term.trim().toUpperCase(),
    ],
  },
  /** ["shared-stock-watchlist", shareId] — a list opened from its public
   *  link. Outside the account's prefix: the viewer need not own it. */
  sharedStockWatchlist: (shareId: string | undefined) => [
    'shared-stock-watchlist',
    shareId,
  ],
  screen: {
    /** ["screen", "catalog"] — the field catalogue; asking for it also starts the server warming
     *  the universe a screen reads. */
    catalog: () => ['screen', 'catalog'],
    /** ["screen", "run", request] — the request is the whole question: universes, symbols,
     *  industries, filters and columns all change the answer. */
    run: (request: ScreenRequest) => ['screen', 'run', request],
  },

  industries: {
    /** ["industries", "tree"] — the classification tree, refreshed with the daily master. */
    tree: () => ['industries', 'tree'],
    /** ["industries", "columns"] — the peer tables' column catalogue, refreshed with it. */
    columns: () => ['industries', 'columns'],
    /** ["industries", "table", query] — one peer table page; whose companies, which columns,
     *  the sort and the page all change the answer. */
    table: (query: PeerTableQuery) => ['industries', 'table', query],
    /** ["industries", "search", term] — trimmed and lower-cased, so a change of case never
     *  splits the cache */
    search: (term: string) => [
      'industries',
      'search',
      term.trim().toLowerCase(),
    ],
  },

  /** ["chart-manifest", 1] — the studies, with their aliases, that the chart shell's library can
   *  draw, as the frontend publishes them beside the shell. Not an API read: the file lives on
   *  the frontend origin, and the key carries its version as the file name does. */
  chartManifest: () => ['chart-manifest', 1],
};
