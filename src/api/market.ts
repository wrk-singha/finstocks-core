import type {GetDividendsResponse} from '../types/dividends.ts';
import type {
  FnoIdeasResponse,
  FnoPositionsResponse,
  FnoRecordWindow,
  FnoTrackRecord,
} from '../types/fno.ts';
import type {GetFundamentalsResponse} from '../types/fundamentals.ts';
import type {
  GetIndicatorsParams,
  TechnicalIndicatorData,
} from '../types/indicators.ts';
import type {IndustryTree} from '../types/industries.ts';
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
  GetStockEventsRequest,
  GetStockEventsResponse,
} from '../types/stockEvents.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';
import {joinQuery, repeatedParam, symbolQuery} from './params.ts';

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

  /** Web-only from here to the announcements: the Other Markets surface. */
  getWorldIndices: (days = 30) =>
    http.request<WorldIndexRow[]>(`/market/world-indices${query({days})}`),

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

  getAnnouncements: (params?: AnnouncementsQuery) =>
    http.request<AnnouncementRow[]>(
      `/market/announcements${query({...params})}`,
    ),

  getAccordNews: (params?: AccordNewsQuery) =>
    http.request<AccordNewsRow[]>(`/market/accord-news${query({...params})}`),

  /** The paged news feed behind the mobile News tab and the web's feed page. */
  getNewsFeed: (params: GetAccordNewsParams = {}) =>
    http.request<AccordNewsResponse>(`/news/feed${query({...params})}`),

  getDividends: (market: 'IN' = 'IN') =>
    http.request<GetDividendsResponse[]>(`/news/dividends${query({market})}`),

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

  /** Web-only: the corporate-events calendar; every array filter is a repeated param. */
  getStockEvents: (params: GetStockEventsRequest) =>
    http.request<GetStockEventsResponse>(
      `/news/stock-events${joinQuery(
        query({from: params.from, to: params.to}),
        repeatedParam('category', params.category ?? []),
        repeatedParam('cap', params.cap ?? []),
        repeatedParam('symbol', params.symbol ?? []),
      )}`,
    ),

  /** Web-only: holders, insider trades and bulk deals for one symbol. */
  getOwnership: (symbol: string) =>
    http.request<GetOwnershipResponse>(`/news/ownership${query({symbol})}`),

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
});

export type MarketApi = ReturnType<typeof marketApi>;
