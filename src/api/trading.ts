import type {PortfolioSegment} from '../portfolio/portfolio.ts';
import type {BacktestAnalysisResponse} from '../types/backtestAnalysis.ts';
import type {FnoChainFallback, FnoExpiries} from '../types/fno.ts';
import type {TopTradedFutures} from '../types/futures.ts';
import type {
  GetGraphDataRequest,
  GraphDataPoint,
  LastPrices,
  RawGraphSeries,
  StockGraphData,
} from '../types/graphData.ts';
import type {PortfolioAnalysisResponse} from '../types/portfolioAnalysis.ts';
import type {AutopilotLog, LogFeedResponse} from '../types/strategyLogs.ts';
import type {
  FSM,
  OrderProduct,
  OrderSide,
  RedeployOverrides,
  useTradeStatusResponse,
} from '../types/trade.ts';
import type {
  BrokerPortfolioResponse,
  CreateSharePortfolioResponse,
  SharePortfolioResponse,
  SyncConflictsResponse,
  fetchPortfolioResponse,
} from '../types/user.ts';
import type {Wallet} from '../types/wallet.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';
import {batchSymbols, joinQuery, repeatedParam, symbolQuery} from './params.ts';

/**
 * Field names are the Model2 contract: backend-go forwards the decoded struct
 * verbatim (handlers/trading/manual.go). The account is derived from the JWT
 * server-side; never send a user_id.
 */
export interface BuyStockPayload {
  stock_symbol: string;
  isMock: boolean;
  market: 'IN';
  quantity: number;
  order_type: string;
  product?: OrderProduct;
  trigger_price?: number;
  take_profit_price?: number;
  stop_loss_price?: number;
  /** "SELL" opens a short. /trading/sell only closes a lot already held. */
  transaction_type?: OrderSide;
  live_price?: number;
}

/** Bracket legs are buy-only: ManualSellRequest declares neither. */
export interface SellStockPayload {
  stock_symbol: string;
  isMock: boolean;
  market: 'IN';
  quantity?: number;
  order_type: string;
  product?: OrderProduct;
  trigger_price?: number | null;
  live_price?: number;
}

export interface OrderResponse {
  success?: boolean;
  message?: string;
}

export type SizingMode = 'AMOUNT' | 'QTY' | 'PERCENT' | 'RISK_PERCENT';

export interface CreateBacktestRequest {
  symbol: string;
  timeframe: string;
  /** Required when is_backtest is true (the default); ignored otherwise. */
  start_date?: string;
  end_date?: string;
  allocated_amount?: number;
  quantity?: number;
  original_query: string;
  strategy_hname?: string;
  is_intraday?: boolean;
  execution_mode?: string;
  /**
   * How `allocated_amount` should be read: AMOUNT (rupees), QTY (shares),
   * PERCENT / RISK_PERCENT (a percentage of `total_capital`). An unrecognised
   * value is a 400.
   */
  sizing_mode?: SizingMode;
  total_capital?: number;
  /** Omit (or true) for a historical backtest; false creates a live/paper strategy and then is_mock is required. */
  is_backtest?: boolean;
  is_mock?: boolean;
  is_fno?: boolean;
  /** Chat message carrying the confirm card that triggered this call, so a reload shows the logs instead of the form. */
  message_id?: string;
  /** Copied onto the strategies_new row, which makes Sentinel skip its own compile. */
  fsm?: unknown;
}

export interface CreateBacktestResponse {
  strategy_id: string;
  status: string;
  message?: string;
}

/** One POST creates every variant of a sweep, so the whole run either starts or it doesn't. */
export interface CreateBacktestBatchRequest {
  variants: CreateBacktestRequest[];
  message_id?: string;
}

export interface CreateBacktestBatchResponse {
  /** Index-aligned with the `variants` sent. */
  strategy_ids: string[];
  status: string;
}

export interface PendingTradeResponse {
  trade_ref: string;
  action: OrderSide;
  symbol: string;
  quantity: number;
  strategy_label: string;
  capital: number;
  target_pct: number;
  expires_at: string;
}

export interface ActivateAutopilotRequest {
  investment_amount: number;
  is_mock: boolean;
}

export type StrategyStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface UpdateFsmOverrides {
  timeframe?: string;
  budget_config?: {mode: string; val: number; total?: number};
  symbol?: string;
}

export interface FnoIndexUnderlying {
  symbol: string;
  /** Same null-means-unknown contract as `FnoChainFallback.lotSize`. */
  lotSize: number | null;
  nearestExpiry: string;
}

export interface GraphDataQuery extends GetGraphDataRequest {
  /** Server thins the session to this many points (the 72px sparkline). */
  maxPoints?: number;
  /** Omits the o/h/l columns the sparkline never reads. */
  closeOnly?: boolean;
  /**
   * The subset of `symbols` already known to be option/futures contracts, so
   * the backend need not re-derive it from the spelling.
   */
  fnoSymbols?: string[];
}

/**
 * Callers spell this "market"/"MARKET"/"Market" depending on which screen
 * wrote them; the backend only accepts the uppercase literal.
 */
export const normalizeOrderType = (orderType: string): 'MARKET' | 'LIMIT' =>
  orderType.trim().toUpperCase() === 'LIMIT' ? 'LIMIT' : 'MARKET';

/**
 * Drop expiries already past — the backend still lists them, and an expired
 * contract is not tradeable.
 */
export const futureExpiries = (
  expiries: string[] | undefined,
  today = new Date().toISOString().slice(0, 10),
): string[] => (expiries ?? []).filter(e => e >= today);

export const unzipGraphSeries = (
  series: Partial<RawGraphSeries> | null | undefined,
): GraphDataPoint[] => {
  if (!series) return [];
  const t = series.t;
  if (!Array.isArray(t)) return [];
  const o = series.o ?? [];
  const h = series.h ?? [];
  const l = series.l ?? [];
  const c = series.c ?? [];
  const ac = series.ac ?? [];
  const rc = series.rc ?? [];
  const v = series.v;
  const points: GraphDataPoint[] = [];
  for (let i = 0; i < t.length; i++) {
    const point: GraphDataPoint = {
      time: t[i] ?? '',
      open: o[i] ?? Number.NaN,
      high: h[i] ?? Number.NaN,
      low: l[i] ?? Number.NaN,
      close: c[i] ?? Number.NaN,
    };
    const absolute = ac[i];
    if (absolute !== undefined) point.absolute_change = absolute;
    const relative = rc[i];
    if (relative !== undefined) point.relative_change = relative;
    const volume = v?.[i];
    if (volume !== undefined) point.volume = volume;
    points.push(point);
  }
  return points;
};

/**
 * The backend sends each symbol's series as columnar parallel arrays
 * ({t,o,h,l,c,ac,rc,v}), sometimes wrapped in `{data}` or `{data: {data}}`.
 * A value that already arrives as an array (older shape) passes through.
 */
// drift resolved 2026-09-13: the mobile's un-zip dropped `ac` (absolute_change) and the
// web's ignored the `{data:{data}}` wrapper; this is the union of both.
/** The symbol-keyed map inside either wrapper; null when the payload carries none. */
const graphSeriesMap = (raw: unknown): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'object') return null;
  const outer = raw as {data?: unknown};
  let map: unknown = raw;
  if (outer.data && typeof outer.data === 'object') {
    const inner = outer.data as {data?: unknown};
    map =
      inner.data && typeof inner.data === 'object' ? inner.data : outer.data;
  }
  if (!map || typeof map !== 'object') return null;
  return map as Record<string, unknown>;
};

export const parseGraphData = (raw: unknown): StockGraphData => {
  const out: StockGraphData = {};
  const map = graphSeriesMap(raw);
  if (!map) return out;
  for (const [symbol, series] of Object.entries(map)) {
    out[symbol] = Array.isArray(series)
      ? (series as GraphDataPoint[])
      : unzipGraphSeries(series as Partial<RawGraphSeries> | null);
  }
  return out;
};

/**
 * The settled previous close each series carries as `pc`, keyed by symbol. It describes the series
 * rather than a bar in it, so it cannot ride in GraphDataPoint[] and `parseGraphData` necessarily
 * drops it; this reads the same payload for the scalar instead.
 *
 * Preferred over deriving a previous close from the bars: the server resolves it against the feed
 * the prices come from, so it cannot drift when the daily rollup falls behind. A symbol is absent
 * rather than zero when the field is missing — while the backend rolls it out, on the older array
 * shape, or for a symbol with no settled session behind it.
 */
export const parseGraphPrevCloses = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  const map = graphSeriesMap(raw);
  if (!map) return out;
  for (const [symbol, series] of Object.entries(map)) {
    if (!series || typeof series !== 'object' || Array.isArray(series)) {
      continue;
    }
    const {pc} = series as Partial<RawGraphSeries>;
    if (typeof pc === 'number') out[symbol] = pc;
  }
  return out;
};

const PLACEHOLDER_SYMBOLS = new Set(['CUSTOM_LIST', 'UNKNOWN', 'UNDEFINED']);

/** Drops the sentinel spellings chat cards sometimes carry instead of a real symbol. */
export const validGraphSymbols = (symbols: readonly string[]): string[] =>
  symbols.filter(
    s => Boolean(s) && !PLACEHOLDER_SYMBOLS.has(s.trim().toUpperCase()),
  );

const graphDataQuery = (params: GraphDataQuery, batch: string[]): string => {
  const fno = new Set(params.fnoSymbols ?? []);
  const fnoParam = repeatedParam(
    'fno_symbols',
    batch.filter(s => fno.has(s)),
  );
  return joinQuery(
    symbolQuery(batch),
    query({
      market: params.market,
      period: params.period ?? '1d',
      interval: params.interval ?? '1m',
      isCompare: params.isCompare ? true : undefined,
      include_volume: params.includeVolume ? 1 : undefined,
      max_points:
        params.maxPoints !== undefined && params.maxPoints > 0
          ? params.maxPoints
          : undefined,
      close_only: params.closeOnly ? 1 : undefined,
    }),
    fnoParam,
  );
};

/** Every graph-data path (own, shared) and batch, so a caller can prefetch without the client. */
export const graphDataPaths = (params: GraphDataQuery): string[] => {
  const symbols = validGraphSymbols(params.symbols);
  if (symbols.length === 0) return [];
  return batchSymbols(symbols).map(batch => {
    const shared = graphDataQuery(params, batch);
    if (!params.hmacToken) return `/trading/graph-data${shared}`;
    return `/share/graph-data${joinQuery(query({hmacToken: params.hmacToken}), shared)}`;
  });
};

const logsQuery = (
  market: 'IN',
  strategyIds: readonly string[] | undefined,
  viewed: boolean,
): string => {
  return joinQuery(
    query({market, viewed: viewed ? 1 : undefined}),
    repeatedParam('strategy_id', strategyIds ?? []),
  );
};

/**
 * The OHLCV socket. The symbol list is mandatory upstream (the backend 400s
 * without it) because an unscoped connection streams every symbol the feed
 * tracks. Relative to the API root like every path here, so the host builds
 * the socket URL as `ws(s)://<host>/api` + this path.
 */
export const ohlcvStreamPath = (symbols: readonly string[]): string =>
  `/trading/ohlcv/stream${query({symbols: symbols.join(',')})}`;

/** The underlying's option-chain socket; the JWT goes in-band as the first message. */
export const premiumStreamPath = (underlying: string): string =>
  `/fno/stream${query({underlying})}`;

export const tradingApi = (http: HttpClient) => ({
  // drift resolved 2026-09-13: the mobile normalised order_type and the web carried the dead
  // `variant`/`validity` fields (neither Go struct has them); the mobile copy won, plus the
  // web's `live_price`, which the backend does read.
  buyStock: (payload: BuyStockPayload, idempotencyKey: string) =>
    http.request<OrderResponse>('/trading/buy', {
      method: 'POST',
      body: {...payload, order_type: normalizeOrderType(payload.order_type)},
      idempotencyKey,
    }),

  // drift resolved 2026-09-13: the mobile required `quantity`, the web left it optional;
  // the web copy won — ManualSellRequest treats an absent quantity as the whole lot.
  sellStock: (payload: SellStockPayload, idempotencyKey: string) =>
    http.request<OrderResponse>('/trading/sell', {
      method: 'POST',
      body: {...payload, order_type: normalizeOrderType(payload.order_type)},
      idempotencyKey,
    }),

  createBacktest: (config: CreateBacktestRequest, idempotencyKey: string) =>
    http.request<CreateBacktestResponse>('/trading/create-backtest', {
      method: 'POST',
      body: config,
      idempotencyKey,
    }),

  /** One call, not N — the server validates every variant before writing any row. */
  createBacktestBatch: (
    payload: CreateBacktestBatchRequest,
    idempotencyKey: string,
  ) =>
    http.request<CreateBacktestBatchResponse>(
      '/trading/create-backtest-batch',
      {method: 'POST', body: payload, idempotencyKey},
    ),

  getPortfolio: () =>
    http.request<fetchPortfolioResponse>('/trading/portfolio'),

  /** Mobile-only: the broker's own view of the holdings, for the sync screen. */
  getBrokerPortfolio: () =>
    http.request<BrokerPortfolioResponse>('/trading/broker-portfolio'),

  getWallet: () => http.request<Wallet>('/trading/wallet'),

  refreshWallet: () =>
    http.request<Wallet>('/trading/wallet/refresh', {method: 'POST'}),

  /**
   * `forceRefresh` is a hint the LLM service may refuse (it floors
   * regeneration at 15min); `segment` picks the equity or F&O book.
   */
  // drift resolved 2026-09-13: the mobile typed the response nullable, the web did not; the
  // mobile copy won — the backend answers null before the first analysis exists.
  getPortfolioAnalysis: (
    isMock: boolean,
    forceRefresh = false,
    segment?: PortfolioSegment,
  ) =>
    http.request<PortfolioAnalysisResponse | null>(
      `/trading/portfolio-analysis${query({
        is_mock: isMock,
        force_refresh: forceRefresh,
        segment,
      })}`,
    ),

  /**
   * `peerIds` is the rest of the sweep, when this run was one of several:
   * judging a variant alone cannot tell "this lost money" from "this was the
   * best of eight and still lost money". Comma-joined, unlike `symbols=`.
   */
  getBacktestAnalysis: (strategyId: string, peerIds?: readonly string[]) =>
    http.request<BacktestAnalysisResponse>(
      `/trading/backtest-analysis${query({
        strategy_id: strategyId,
        peer_ids: peerIds?.length ? peerIds.join(',') : undefined,
      })}`,
    ),

  createSharePortfolio: () =>
    http.request<CreateSharePortfolioResponse>('/share/portfolio', {
      method: 'POST',
    }),

  /** Public: the shared-portfolio viewer needs no session. */
  getSharedPortfolio: (shareLinkUuid: string) =>
    http.request<SharePortfolioResponse>(`/share/portfolio/${shareLinkUuid}`, {
      anonymous: true,
    }),

  /** Mobile-only: halts every live run at once. */
  stopTrade: () =>
    http.request<{success: boolean}>('/trading/stop-trade', {method: 'POST'}),

  activateAutopilot: (
    payload: ActivateAutopilotRequest,
    idempotencyKey: string,
  ) =>
    http.request<{message: string}>('/trading/activate-autopilot', {
      method: 'POST',
      body: payload,
      idempotencyKey,
    }),

  deactivateAutopilot: () =>
    http.request<{message: string}>('/trading/deactivate-autopilot', {
      method: 'POST',
    }),

  /**
   * Mobile-only. Null when there's no current, unresponded, unexpired agent
   * trade proposal. Resolving it is client-side only — there's no confirm/skip endpoint.
   */
  getPendingTrade: () =>
    http.request<PendingTradeResponse | null>('/trading/pending-trade'),

  stopStrategy: (strategyId: string) =>
    http.request<{success: boolean}>('/trading/stop-strategy', {
      method: 'PUT',
      body: {strategy_id: strategyId},
    }),

  updateStrategyStatus: (strategyId: string, status: StrategyStatus) =>
    http.request<{success: boolean}>('/trading/update-strategy', {
      method: 'PUT',
      body: {strategy_id: strategyId, status},
    }),

  /** Re-deploys a strategy with edited rules; the new config takes effect on its next run. */
  redeployStrategy: (
    strategyId: string,
    overrides: RedeployOverrides,
    idempotencyKey: string,
  ) =>
    http.request<{success: boolean}>('/trading/switch-strategy', {
      method: 'PUT',
      body: {strategy_id: strategyId, ...overrides},
      idempotencyKey,
    }),

  /** Direct FSM edit: mutates the live run's condition JSON in place instead of recreating it. */
  updateStrategyFsm: (
    strategyId: string,
    fsm: FSM,
    overrides: UpdateFsmOverrides | undefined,
    idempotencyKey: string,
  ) =>
    http.request<{success: boolean}>('/trading/update-fsm', {
      method: 'PUT',
      body: {strategy_id: strategyId, fsm, ...overrides},
      idempotencyKey,
    }),

  /**
   * `rules=1` adds each strategy's FSM and its derived entry/exit clauses —
   * ~68% of the payload, read only by the Strategy Console.
   */
  // drift resolved 2026-09-13: the web omitted `mock`, so its console silently showed whichever
  // book the backend defaulted to; the mobile copy won.
  isAlive: (isMock: boolean, withRules = false) =>
    http.request<useTradeStatusResponse>(
      `/trading/is-alive${query({
        model: 2,
        mock: isMock,
        rules: withRules ? 1 : undefined,
      })}`,
    ),

  /**
   * Raw discriminated feed (log rows + fallback transaction rows). Never sends
   * viewed=1: this is the endpoint the backtest poll hits, and a poll is not a
   * human reading results.
   */
  getLogs: (market: 'IN', strategyIds?: readonly string[]) =>
    http.request<LogFeedResponse>(
      `/trading/get-logs${logsQuery(market, strategyIds, false)}`,
    ),

  /**
   * Records that a human opened these strategies, which silences the
   * unread-backtest, strategy-live, untested and no-trades notifications.
   * Fire-and-forget: a missed mark costs one redundant notification.
   */
  markStrategyResultsViewed: (market: 'IN', strategyIds: readonly string[]) => {
    if (strategyIds.length === 0) return Promise.resolve(null);
    return http
      .request<LogFeedResponse>(
        `/trading/get-logs${logsQuery(market, strategyIds, true)}`,
      )
      .catch(() => null);
  },

  /** Web-only: the autopilot's own narrative log. */
  getAutopilotLogs: (market: 'IN') =>
    http.request<AutopilotLog[]>(`/trading/autopilot-logs${query({market})}`),

  /**
   * One request per 26 symbols (see `batchSymbols`), merged; `hmacToken`
   * switches to the public /share/graph-data route.
   */
  getGraphData: async (params: GraphDataQuery): Promise<StockGraphData> => {
    const pages = await Promise.all(
      graphDataPaths(params).map(path =>
        http.request<unknown>(path, params.hmacToken ? {anonymous: true} : {}),
      ),
    );
    return Object.assign({}, ...pages.map(parseGraphData)) as StockGraphData;
  },

  /**
   * The same request as `getGraphData`, read for the series-level `pc` instead of the bars.
   * Separate on purpose: every caller of `getGraphData` reads `StockGraphData`, and folding a
   * scalar map into that return would break all of them for a value most never use.
   */
  getGraphPrevCloses: async (
    params: GraphDataQuery,
  ): Promise<Record<string, number>> => {
    const pages = await Promise.all(
      graphDataPaths(params).map(path =>
        http.request<unknown>(path, params.hmacToken ? {anonymous: true} : {}),
      ),
    );
    return Object.assign({}, ...pages.map(parseGraphPrevCloses)) as Record<
      string,
      number
    >;
  },

  /**
   * Web-only: two numbers a symbol instead of a session of minute bars —
   * the newest close and the bar it opened at.
   */
  getLastPrices: async (symbols: readonly string[]): Promise<LastPrices> => {
    const pages = await Promise.all(
      batchSymbols(symbols).map(batch =>
        http.request<LastPrices | null>(
          `/trading/last-prices${joinQuery(symbolQuery(batch))}`,
        ),
      ),
    );
    return Object.assign({}, ...pages.map(p => p ?? {})) as LastPrices;
  },

  deleteTrade: (tradeId: string) =>
    http.request<{success: boolean}>(`/trading/transaction/${tradeId}`, {
      method: 'DELETE',
    }),

  getSyncConflicts: () =>
    http.request<SyncConflictsResponse>('/trading/sync-tx'),

  resolveSyncConflict: (conflictId: string) =>
    http.request<{success: boolean}>('/trading/sync-tx', {
      method: 'PUT',
      body: {uuid: conflictId},
    }),

  /**
   * The backend forwards `expiry` upstream only when non-empty, and scoping
   * the snapshot to one expiry roughly halves it. It stays optional because
   * the page learns which expiries exist from this very response.
   */
  getFnoChainFallback: async (
    underlying: string,
    expiry?: string,
  ): Promise<FnoChainFallback> => {
    const res = await http.request<FnoChainFallback>(
      `/trading/fno/chain-fallback${query({underlying, expiry})}`,
    );
    return {...res, expiries: futureExpiries(res.expiries)};
  },

  /** Expiries + lot size only, one indexed query server-side instead of chain-fallback's four. */
  getFnoExpiries: async (underlying: string): Promise<FnoExpiries> => {
    const res = await http.request<FnoExpiries>(
      `/trading/fno/expiries${query({underlying})}`,
    );
    return {...res, expiries: futureExpiries(res.expiries)};
  },

  /**
   * Web-only: the index underlyings whose option chains can actually be
   * opened — NIFTY100 and INDIAVIX are real indices with no listed options.
   */
  getFnoIndexUnderlyings: async (): Promise<FnoIndexUnderlying[]> => {
    const res = await http.request<{underlyings?: FnoIndexUnderlying[]}>(
      '/trading/fno/index-underlyings',
    );
    return res.underlyings ?? [];
  },

  getTopTradedFutures: () =>
    http.request<TopTradedFutures>('/trading/fno/top-traded'),
});

export type TradingApi = ReturnType<typeof tradingApi>;
