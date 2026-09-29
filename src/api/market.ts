import type {
  AISignal,
  AISignalsRequest,
  AISignalsResponse,
} from '../types/aiSignals.ts';
import type {
  GetDividendsParams,
  GetDividendsResponse,
} from '../types/dividends.ts';
import type {
  FnoIdeasResponse,
  FnoPositionsResponse,
  FnoRecordWindow,
  FnoTrackRecord,
} from '../types/fno.ts';
import type {GetFundamentalsResponse} from '../types/fundamentals.ts';
import type {
  DeliverableRow,
  FundamentalsDocuments,
  FundamentalsOwnership,
  FundamentalsSection,
  GetFundamentalsDetailResponse,
  OwnershipCategory,
  StatementBasis,
} from '../types/fundamentalsDetail.ts';
import type {
  FundamentalCatalog,
  FundamentalGroup,
  FundamentalLivePrice,
  FundamentalMetric,
  FundamentalPeriod,
  FundamentalPoint,
  FundamentalSeries,
} from '../types/fundamentalSeries.ts';
import type {
  GetIndicatorsParams,
  TechnicalIndicatorData,
} from '../types/indicators.ts';
import type {
  IndustrySearchHit,
  IndustryTree,
  PeerColumnCatalog,
  PeerTable,
  PeerTableQuery,
} from '../types/industries.ts';
import type {
  InstitutionalFlowRow,
  MarketDepth,
  MarketEventsResponse,
  MarketMovers,
  MarketNewsResponse,
  MarketOverview,
  MarketRecommendationsResponse,
  MonthlyPnl,
  RecommendationReport,
} from '../types/market.ts';
import type {AccordNewsResponse, GetAccordNewsParams} from '../types/news.ts';
import type {GetOwnershipResponse} from '../types/ownership.ts';
import type {
  PatternDetectParams,
  PatternDetectResponse,
  PatternScanParams,
  PatternScanResponse,
  PatternVocabEntry,
  PatternVocabResponse,
} from '../types/patternScan.ts';
import type {StockScoreResponse} from '../types/scores.ts';
import type {
  ScreenCatalog,
  ScreenRequest,
  ScreenResult,
} from '../types/screen.ts';
import type {
  ScreenerIndicatorsResponse,
  ScreenerStocksResponse,
} from '../types/screener.ts';
import type {
  ScreenerBackendFilters,
  ScreenerTimeframe,
} from '../types/screenerFilters.ts';
import type {
  CorporateFiling,
  GetStockEventsRequest,
  GetStockEventsResponse,
} from '../types/stockEvents.ts';
import type {HttpClient} from './http.ts';
import {query, statusOf} from './http.ts';
import {joinQuery, symbolQuery} from './params.ts';

export interface RecommendationsQuery {
  horizon?: string;
  status?: string;
}

// drift resolved 2026-09-13: the web's ScreenerFilters carried price/cap/holdings/watchlist
// keys the mobile's ScreenerBackendFilters did not; the union is sent, every key optional.
export interface ScreenerStocksQuery extends ScreenerBackendFilters {
  price_min?: string;
  price_max?: string;
  mkt_cap_min?: string;
  holdings?: string;
  watchlist?: string;
}

export interface WorldIndexRow {
  index_id: number;
  index_symbol: string;
  index_name: string;
  country: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adj_close: number;
  updated_at: string;
}

export type IPOStatus = 'open' | 'upcoming' | 'closed' | 'unknown';

export interface IPORow {
  ipocode: number;
  fincode?: number;
  company_name: string;
  symbol?: string;
  ipo_type?: string;
  status: IPOStatus;
  open_date: string | null;
  close_date: string | null;
  list_date: string | null;
  price_min?: number;
  price_max?: number;
  market_lot?: number;
  min_investment?: number;
  issue_size?: number;
  subscription?: number;
}

export interface IPOSubscriptionTier {
  label: string;
  times: number;
}

export interface IPODetail extends IPORow {
  face_value?: number;
  issue_price?: number;
  list_price_nse?: number;
  description?: string;
  objective?: string;
  subscription_tiers?: IPOSubscriptionTier[];
  lead_managers?: string[];
  promoters?: string[];
}

export interface IPOListResponse {
  ipos: IPORow[];
  counts: Record<string, number>;
}

export type FundKind = 'nps' | 'ulip';

export interface FundRow {
  fund_id: number;
  kind: FundKind;
  name: string;
  manager: string;
  category: string;
  nature: string;
  nav: number | null;
  nav_date: string | null;
  return_1y: number | null;
  return_3y: number | null;
  incept_date: string | null;
}

export interface InsuranceInsurer {
  insurer_id: number;
  insurer_name: string;
  short_name: string;
  launch_date: string | null;
  city: string;
  website: string;
  updated_at: string;
}

export interface InsurancePlan {
  insurance_id: number;
  insurer_id: number | null;
  ins_name: string;
  category_id: number | null;
  type: string;
  policy_type: string;
  benefit: string;
  status: string;
  updated_at: string;
}

export interface InsuranceFund {
  fund_id: number;
  insurer_id: number | null;
  fund_name: string;
  funds_name: string;
  incept_date: string | null;
  objective: string;
  sfin: string;
  bloomberg_code: string;
  updated_at: string;
}

export interface InsuranceNAVRow {
  fund_id: number;
  date: string;
  insurer_name: string;
  insurance_name: string;
  plan_name: string;
  nav: number | null;
  updated_at: string;
}

export interface NPSFundRow {
  fund_id: number;
  amc_code: number | null;
  amc_name: string;
  plan: string;
  scheme_description: string;
  nature: string;
  scheme_type: string;
  tier: string;
  incept_date: string | null;
  updated_at: string;
}

export interface NPSNAVRow {
  fund_id: number;
  date: string;
  nav: number | null;
}

export interface NPSPortfolioRow {
  fund_id: number;
  inv_date: string;
  fincode: number | null;
  comp_name: string;
  sect_name: string;
  asect_name: string;
  rating: string;
  no_shares: number | null;
  mkt_val: number | null;
  hold_percentage: number | null;
}

export interface NPSSectorRow {
  fund_id: number;
  inv_date: string;
  industry: string;
  hold_percentage: number | null;
  mkt_val: number | null;
}

export interface AnnouncementRow {
  news_id: string;
  scripcode: number | null;
  datetime: string | null;
  caption: string;
  details: string;
  attachment_url: string;
  announcement_type: string;
  meeting_type: string;
  meeting_date: string | null;
  updated_at: string;
}

export interface AccordNewsRow {
  news_id: number;
  section: string;
  subsection: string;
  date: string | null;
  time: string;
  heading: string;
  caption: string;
  fincode: string;
  feed_name: string;
  updated_at: string;
}

export interface AnnouncementsQuery {
  symbol?: string;
  scripcode?: number;
  type?: string;
  days?: number;
}

export interface AccordNewsQuery {
  section?: string;
  days?: number;
  fincode?: string;
}

/**
 * A screen run gets its own timeout: the server builds the universe it screens on first use, and
 * that read of every company's filings and bars can outlast the client's usual minute. Failing at
 * sixty seconds would abandon work that was about to finish, and the retry would start it over.
 */
const COLD_SCAN_TIMEOUT_MS = 180_000;

/** The order-book socket for one symbol; relative to the API root like the REST paths. */
export const depthStreamPath = (symbol: string): string =>
  `/market/depth/stream${query({symbol})}`;

/**
 * The report as the server sends it. monthly_returns joined the contract after the rest, so a
 * backend that has not shipped it yet still answers; the grid reads an empty list as "nothing to
 * show" rather than throwing on the first month.
 */
interface RecommendationReportWire extends Omit<
  RecommendationReport,
  'monthly_returns'
> {
  monthly_returns?: MonthlyPnl[] | null;
}

const readRecommendationReport = (
  report: RecommendationReportWire,
): RecommendationReport => ({
  ...report,
  monthly_returns: report.monthly_returns ?? [],
});

/**
 * The filing as the server sends it. Go serialises a nil slice as null, so a company whose
 * shareholding rows carried no measure answers `categories: null`, and one with no deliveries or
 * no filings of a kind can answer null where those lists belong. The readers iterate them, so each
 * is filled once here rather than guarded in every one of them.
 */
interface FundamentalsOwnershipWire extends Omit<
  FundamentalsOwnership,
  'categories'
> {
  categories: OwnershipCategory[] | null;
}

type FundamentalsDocumentsWire = {
  [K in keyof FundamentalsDocuments]?: FundamentalsDocuments[K] | null;
};

interface FundamentalsDetailWire extends Omit<
  GetFundamentalsDetailResponse,
  'ownership' | 'deliverables' | 'documents'
> {
  ownership?: FundamentalsOwnershipWire | null;
  deliverables?: DeliverableRow[] | null;
  documents?: FundamentalsDocumentsWire | null;
}

const readFundamentalsDetail = ({
  ownership,
  deliverables,
  documents,
  ...detail
}: FundamentalsDetailWire): GetFundamentalsDetailResponse => ({
  ...detail,
  ...(ownership == null
    ? {}
    : {ownership: {...ownership, categories: ownership.categories ?? []}}),
  ...(deliverables === undefined ? {} : {deliverables: deliverables ?? []}),
  ...(documents == null
    ? {}
    : {
        documents: {
          announcements: documents.announcements ?? [],
          annual_reports: documents.annual_reports ?? [],
          credit_ratings: documents.credit_ratings ?? [],
          concalls: documents.concalls ?? [],
        },
      }),
});

/**
 * The fundamentals catalogue and series as the server sends them. Go serialises a nil slice or map
 * as null, so a company with nothing on file can answer null where a list belongs, and a line with
 * no aliases or no counts null for those. Lists are filled once here. A null count map is left out
 * rather than emptied: it is a map nobody filled, which offers every period, where an empty one
 * offers none.
 */
interface FundamentalMetricWire extends Omit<
  FundamentalMetric,
  'periods' | 'aliases' | 'available'
> {
  periods: FundamentalPeriod[] | null;
  aliases?: string[] | null;
  available?: FundamentalMetric['available'] | null;
}

interface FundamentalCatalogWire extends Omit<
  FundamentalCatalog,
  'groups' | 'metrics'
> {
  groups: FundamentalGroup[] | null;
  metrics: FundamentalMetricWire[] | null;
}

interface FundamentalSeriesWire extends Omit<
  FundamentalSeries,
  'metric' | 'points'
> {
  metric: FundamentalMetricWire;
  points: FundamentalPoint[] | null;
}

const readFundamentalMetric = ({
  periods,
  aliases,
  available,
  ...metric
}: FundamentalMetricWire): FundamentalMetric => ({
  ...metric,
  periods: periods ?? [],
  ...(aliases == null ? {} : {aliases}),
  ...(available == null ? {} : {available}),
});

const readFundamentalCatalog = ({
  groups,
  metrics,
  ...catalog
}: FundamentalCatalogWire): FundamentalCatalog => ({
  ...catalog,
  groups: groups ?? [],
  metrics: (metrics ?? []).map(readFundamentalMetric),
});

const readFundamentalSeries = ({
  metric,
  points,
  ...series
}: FundamentalSeriesWire): FundamentalSeries => ({
  ...series,
  metric: readFundamentalMetric(metric),
  points: points ?? [],
});

/**
 * The signals as the server sends them. Go serialises a nil slice as null, so a chart with no
 * setups, no swings or a signal with no failed gates can answer null where a list belongs; the
 * readers iterate them, so each is filled once here rather than guarded in every one.
 */
type Nullable<T, K extends keyof T> = Omit<T, K> & {[P in K]: T[P] | null};

type AISignalWire = Nullable<
  AISignal,
  'gates_passed' | 'gates_failed' | 'points' | 'lines'
>;

interface AISignalsWire extends Omit<
  Nullable<AISignalsResponse, 'pivots'>,
  'signals'
> {
  signals: AISignalWire[] | null;
}

const readAISignals = ({
  signals,
  pivots,
  ...response
}: AISignalsWire): AISignalsResponse => ({
  ...response,
  pivots: pivots ?? [],
  signals: (signals ?? []).map(
    ({gates_passed, gates_failed, points, lines, ...signal}) => ({
      ...signal,
      gates_passed: gates_passed ?? [],
      gates_failed: gates_failed ?? [],
      points: points ?? [],
      lines: lines ?? {},
    }),
  ),
});

/**
 * The holder register, deals and insider trades as the server sends them. Go serialises a nil slice
 * as null, as the filing above shows, so a stock with no deals can answer `deals: null`; every list
 * is filled here once, and a missing register date reads as empty, rather than every reader
 * carrying the guard.
 */
type OwnershipWire = {
  [K in keyof GetOwnershipResponse]?: GetOwnershipResponse[K] | null;
};

const readOwnership = (wire: OwnershipWire | null): GetOwnershipResponse => ({
  deals: wire?.deals ?? [],
  insider: wire?.insider ?? [],
  top_holders: wire?.top_holders ?? [],
  holders_as_of: wire?.holders_as_of ?? '',
});

/**
 * The pattern vocabulary as the server sends it. Go serialises a nil slice as null, so a pattern
 * with no other spellings can answer `aliases: null`, and a registry with nothing in it
 * `patterns: null`; a picker searches every entry's aliases, so both are filled once here.
 */
type PatternVocabEntryWire = Nullable<PatternVocabEntry, 'aliases'>;

interface PatternVocabWire {
  patterns: PatternVocabEntryWire[] | null;
}

const readPatternVocab = (
  wire: PatternVocabWire | null,
): PatternVocabResponse => ({
  patterns: (wire?.patterns ?? []).map(({aliases, ...entry}) => ({
    ...entry,
    aliases: aliases ?? [],
  })),
});

export const marketApi = (http: HttpClient) => ({
  getRecommendations: (params?: RecommendationsQuery) =>
    http.request<MarketRecommendationsResponse>(
      `/market/recommendations${query({
        horizon: params?.horizon,
        status: params?.status,
      })}`,
    ),

  getRecommendationReport: async (): Promise<RecommendationReport> =>
    readRecommendationReport(
      await http.request<RecommendationReportWire>(
        '/market/recommendation-report',
      ),
    ),

  getStrategyReport: async (): Promise<RecommendationReport> =>
    readRecommendationReport(
      await http.request<RecommendationReportWire>('/market/strategy-report'),
    ),

  getMarketOverview: () => http.request<MarketOverview>('/market/overview'),

  getMarketMovers: () => http.request<MarketMovers>('/market/movers'),

  getMarketNews: () => http.request<MarketNewsResponse>('/market/news'),

  getMarketEvents: () => http.request<MarketEventsResponse>('/market/events'),

  getMarketDepth: (symbol: string) =>
    http.request<MarketDepth>(`/market/depth${query({symbol})}`),

  getScore: (symbol: string) =>
    http.request<StockScoreResponse | null>(`/market/score${query({symbol})}`),

  getScreenerStocks: (filters?: ScreenerStocksQuery) =>
    http.request<ScreenerStocksResponse>(
      `/market/screener${query({...filters})}`,
    ),

  /** Only indicator keys with real coverage on that interval's technicals table come back. */
  getScreenerIndicators: (interval?: ScreenerTimeframe) =>
    http.request<ScreenerIndicatorsResponse>(
      `/market/screener/indicators${query({interval})}`,
    ),

  /** Mobile-only: follows the recommendation basket. Keyed because following can commit the account to the basket's orders. */
  followBasket: (idempotencyKey: string) =>
    http.request<{following: boolean}>('/market/basket/follow', {
      method: 'POST',
      idempotencyKey,
    }),

  /** Mobile-only. */
  unfollowBasket: () =>
    http.request<{following: boolean}>('/market/basket/follow', {
      method: 'DELETE',
    }),

  getFnoIdeas: (underlying?: string) =>
    http.request<FnoIdeasResponse>(`/market/fno/ideas${query({underlying})}`),

  getFnoPositions: () =>
    http.request<FnoPositionsResponse>('/market/fno/positions'),

  getFnoTrackRecord: (window: FnoRecordWindow = 'all') =>
    http.request<FnoTrackRecord>(`/market/fno/track-record${query({window})}`),

  getInstitutionalFlows: (days = 30, source?: string) =>
    http.request<InstitutionalFlowRow[]>(
      `/market/institutional-flows${query({days, source})}`,
    ),

  /** `indexId` narrows the window to one benchmark. The table wants all sixteen; a detail page
   *  drawing one line does not, and at a 1Y window the difference is sixteen indices of daily
   *  history fetched to render one. */
  getWorldIndices: (days = 30, indexId?: number) =>
    http.request<WorldIndexRow[]>(
      `/market/world-indices${query({days, index_id: indexId})}`,
    ),

  /** Web-only from here to the announcements: the Other Markets surface. */
  getWorldIndicesMaster: () =>
    http.request<WorldIndexRow[]>('/market/world-indices/master'),

  getIPOList: (status = 'all', limit = 50) =>
    http.request<IPOListResponse>(`/market/ipos${query({status, limit})}`),

  getIPODetail: (ipocode: number) =>
    http.request<IPODetail>(`/market/ipo${query({ipocode})}`),

  getFunds: (kind?: FundKind) =>
    http.request<FundRow[]>(`/market/funds${query({kind})}`),

  getInsuranceInsurers: () =>
    http.request<InsuranceInsurer[]>('/market/insurance/insurers'),

  getInsurancePlans: (insurerId?: number) =>
    http.request<InsurancePlan[]>(
      `/market/insurance/plans${query({insurer_id: insurerId})}`,
    ),

  getInsuranceFunds: (insurerId?: number) =>
    http.request<InsuranceFund[]>(
      `/market/insurance/funds${query({insurer_id: insurerId})}`,
    ),

  getInsuranceNAV: (fundId: number, days = 30) =>
    http.request<InsuranceNAVRow[]>(
      `/market/insurance/nav${query({fund_id: fundId, days})}`,
    ),

  getNPSFunds: (amcCode?: number) =>
    http.request<NPSFundRow[]>(
      `/market/nps/funds${query({amc_code: amcCode})}`,
    ),

  getNPSNAV: (fundId: number, days = 30) =>
    http.request<NPSNAVRow[]>(
      `/market/nps/nav${query({fund_id: fundId, days})}`,
    ),

  getNPSPortfolio: (fundId: number) =>
    http.request<NPSPortfolioRow[]>(
      `/market/nps/portfolio${query({fund_id: fundId})}`,
    ),

  getNPSSectors: (fundId: number) =>
    http.request<NPSSectorRow[]>(
      `/market/nps/sectors${query({fund_id: fundId})}`,
    ),

  /**
   * Go serialises a nil slice as null, so a company that has filed nothing can answer null; it
   * arrives as an empty list. The corporate filings and dividends reads fill it the same way.
   */
  getAnnouncements: async (
    params?: AnnouncementsQuery,
  ): Promise<AnnouncementRow[]> =>
    (await http.request<AnnouncementRow[] | null>(
      `/market/announcements${query({...params})}`,
    )) ?? [],

  /** One stock's buyback, ESOP, preferential-issue and merger filings, tagged by the backend. */
  getCorporateFilings: async (symbol: string): Promise<CorporateFiling[]> =>
    (await http.request<CorporateFiling[] | null>(
      `/market/corporate-filings${query({symbol})}`,
    )) ?? [],

  getAccordNews: (params?: AccordNewsQuery) =>
    http.request<AccordNewsRow[]>(`/market/accord-news${query({...params})}`),

  /** The paged news feed behind the mobile News tab and the web's feed page. */
  getNewsFeed: (params: GetAccordNewsParams = {}) =>
    http.request<AccordNewsResponse>(`/news/feed${query({...params})}`),

  /**
   * The market's dividend feed, or one stock's whole history with `symbol`; `upcoming` keeps the
   * ex-dates still ahead. Each filter is sent only when set, as web sends them.
   */
  getDividends: async (
    market: 'IN' = 'IN',
    {symbol, upcoming}: Omit<GetDividendsParams, 'market'> = {},
  ): Promise<GetDividendsResponse[]> =>
    (await http.request<GetDividendsResponse[] | null>(
      `/news/dividends${query({
        market,
        symbol: symbol === '' ? undefined : symbol,
        upcoming: upcoming === true ? true : undefined,
      })}`,
    )) ?? [],

  /**
   * `fields: "summary"` drops the per-period arrays for peer-comparison
   * lookups. Symbols are repeated params — the Go handler never splits commas.
   */
  // drift resolved 2026-09-13: the web swallowed every error into `[]`, the mobile let them
  // propagate; the mobile copy won — a host that wants the empty-list fallback adds it.
  getFundamentals: (
    symbols: readonly string[],
    market: 'IN' = 'IN',
    fields?: 'summary',
  ) =>
    http.request<GetFundamentalsResponse[]>(
      `/news/fundamentals${joinQuery(symbolQuery(symbols), query({market, fields}))}`,
    ),

  /**
   * The filing as filed, one request per section set: statements, quarterly results with their
   * filings, the shareholding register, deliveries and documents. `periods` 0 asks for every
   * period on file. `limit` caps each documents list and is sent only when given, so the other
   * sections' requests are unchanged.
   *
   * 404 is the answer for a company with nothing on file, so it resolves to null. Every other
   * status throws: a 502 swallowed into null would be cached as "filed nothing" for as long as the
   * host keeps the answer fresh, and nothing downstream could tell the difference.
   */
  getFundamentalsDetail: async (
    symbol: string,
    sections: readonly FundamentalsSection[],
    basis: StatementBasis = 'C',
    periods = 5,
    limit?: number,
  ): Promise<GetFundamentalsDetailResponse | null> => {
    const path = `/news/fundamentals/detail${query({
      symbol,
      sections: sections.join(','),
      basis,
      periods,
      limit,
    })}`;
    try {
      return readFundamentalsDetail(
        await http.request<FundamentalsDetailWire>(path),
      );
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  },

  /**
   * Every line a company's filings can be charted as, grouped by statement in the backend's order,
   * each with how many points this company has at each period.
   */
  getFundamentalCatalog: async (symbol: string): Promise<FundamentalCatalog> =>
    readFundamentalCatalog(
      await http.request<FundamentalCatalogWire>(
        `/news/fundamentals/metrics${query({symbol})}`,
      ),
    ),

  /**
   * One line of a company's filings as points to chart. `live` asks for a daily series that ends
   * on the value at the chart's last traded price, dated to the session of the bar it traded in.
   */
  getFundamentalSeries: async (
    symbol: string,
    metric: string,
    period: FundamentalPeriod,
    live?: FundamentalLivePrice,
  ): Promise<FundamentalSeries> =>
    readFundamentalSeries(
      await http.request<FundamentalSeriesWire>(
        `/news/fundamentals/series${query({
          symbol,
          metric,
          period,
          live_price: live?.price,
          live_at: live?.at,
        })}`,
      ),
    ),

  getTechnicals: (params: GetIndicatorsParams) =>
    http.request<TechnicalIndicatorData[]>(
      `/news/technicals${joinQuery(
        symbolQuery(params.stocks),
        query({market: params.market, interval: params.interval}),
      )}`,
    ),

  /** Web-only: which symbols match a chart pattern right now. */
  scanPatterns: (params: PatternScanParams) =>
    http.request<PatternScanResponse>('/market/pattern-scan', {
      method: 'POST',
      body: params,
    }),

  /** Web-only: which patterns one symbol shows over its recent bars. */
  detectPatterns: (params: PatternDetectParams) =>
    http.request<PatternDetectResponse>('/news/pattern-detect', {
      method: 'POST',
      body: params,
    }),

  /**
   * Every pattern the scanner can answer, whether or not a chart shows it: the catalogue the
   * Indicators picker lists. The same for every symbol and day, so a caller fetches it once.
   */
  getPatternVocab: async (): Promise<PatternVocabResponse> =>
    readPatternVocab(
      await http.request<PatternVocabWire | null>('/market/patterns'),
    ),

  /**
   * The pattern engine's trade plans on the bars a chart shows. The caller sends those bars —
   * the newest `AI_SIGNALS_MAX_BARS`, oldest first — because the engine reads the candles on
   * screen, not a series of its own, and a plan drawn on other candles would not line up.
   */
  postAISignals: async (
    request: AISignalsRequest,
  ): Promise<AISignalsResponse> =>
    readAISignals(
      await http.request<AISignalsWire>('/market/ai-signals', {
        method: 'POST',
        body: request,
      }),
    ),

  /**
   * The corporate-events calendar. POST, not GET: a watchlist or holdings filter can name
   * thousands of symbols, more than a URL holds. The body carries the fields the GET params
   * did; a request without dates lets the server pick the window, which it names in
   * `from`/`to`.
   */
  getStockEvents: (params: GetStockEventsRequest) =>
    http.request<GetStockEventsResponse>('/news/stock-events', {
      method: 'POST',
      body: params,
    }),

  /** The newest holder register, bulk and block deals and insider trades for one symbol. */
  getOwnership: async (symbol: string): Promise<GetOwnershipResponse> =>
    readOwnership(
      await http.request<OwnershipWire | null>(
        `/news/ownership${query({symbol})}`,
      ),
    ),

  /** Every field a screen can filter on or show, and the universes it can start from. */
  getScreenCatalog: () => http.request<ScreenCatalog>('/news/screen/fields'),

  /** Runs one screen over the whole listed universe. */
  runScreen: (request: ScreenRequest) =>
    http.request<ScreenResult>('/news/screen', {
      method: 'POST',
      body: request,
      timeoutMs: COLD_SCAN_TIMEOUT_MS,
    }),

  /** The four-level industry tree the sector picker and the industry pages read. */
  getIndustryTree: () => http.request<IndustryTree>('/news/industries'),

  /** Every column a peer table can show, with the tabs the column picker files them under. */
  getPeerColumnCatalog: () =>
    http.request<PeerColumnCatalog>('/news/industries/columns'),

  /**
   * One page of an industry's companies: a node's, the industry a symbol is filed under, or an
   * explicit set to compare. Unlike the symbol endpoints above, this one takes `symbols` and
   * `columns` comma-joined, as web sends them.
   */
  getPeerTable: (request: PeerTableQuery) =>
    http.request<PeerTable>(
      `/news/industries/companies${query({
        node: request.node,
        symbol: request.symbol,
        symbols: request.symbols?.join(','),
        columns: request.columns.join(','),
        sort: request.sort,
        order: request.order,
        page: request.page,
        per_page: request.perPage,
      })}`,
    ),

  /** Any listed company by ticker or name, not only the universe the global search knows. */
  searchIndustryCompanies: (term: string) =>
    http.request<IndustrySearchHit[]>(
      `/news/industries/search${query({q: term})}`,
    ),
});

export type MarketApi = ReturnType<typeof marketApi>;
