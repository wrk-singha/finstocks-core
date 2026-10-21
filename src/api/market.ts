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
  Recommendation,
  RecommendationReport,
  RecommendationRow,
  RecommendationsWire,
} from '../types/market.ts';
import type {MarketProfile, ProfileInstrument} from '../types/marketProfile.ts';
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
import type {
  RelatedPartyColumn,
  RelatedPartyResponse,
  RelatedPartyRow,
  RelatedPartyTxnRow,
} from '../types/relatedParty.ts';
import type {
  ExpiryRank,
  FlyoneDates,
  FlyoneDetail,
  FlyoneDetailParams,
  FlyoneScreen,
  FlyoneScreenParams,
  FlyoneSnapshot,
} from '../types/flyone.ts';
import type {
  RegimeDates,
  RegimeDecay,
  RegimeDetail,
  RegimeSentiment,
  RegimeSnapshot,
} from '../types/regimePulse.ts';
import type {RsPair, RsSectorMatrix} from '../types/rsSectorMatrix.ts';
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
  SegmentPeriod,
  SegmentSeries,
  SegmentsResponse,
} from '../types/segments.ts';
import type {
  CorporateFiling,
  GetStockEventsRequest,
  GetStockEventsResponse,
} from '../types/stockEvents.ts';
import {parseTimestamp} from '../format/date.ts';
import type {HttpClient} from './http.ts';
import {query, statusOf} from './http.ts';
import {joinQuery, symbolQuery} from './params.ts';

export interface RecommendationsQuery {
  horizon?: string;
  status?: string;
  /**
   * equity (the default) or commodity. The picks are read as equities only (`readRecommendation`),
   * so asking for equities keeps commodity rows from being fetched and counted as dropped, and the
   * server's closed-day fallback is the last day that closed an equity pick.
   */
  kind?: 'equity' | 'commodity';
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

/** The rest of the app names an exchange equity bare (RELIANCE), not RELIANCE-NSE. */
const bareSymbol = (symbol: string): string =>
  symbol.trim().replace(/-(NSE|BSE)$/, '');

const isPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const zoneOf = (low: unknown, high: unknown): [number, number] | null =>
  isPrice(low) && isPrice(high) && low <= high ? [low, high] : null;

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/** A stamp the app can read on every engine (Go sends RFC 3339 with up to nine fraction digits). */
const stampOf = (value: unknown): string | null =>
  typeof value === 'string' && parseTimestamp(value) !== null ? value : null;

/**
 * Target 2 as a pick shows it: its zone and the edge nearest the entry, as `target_price` is read,
 * or null for a call without one, an unreadable one, or one not past the target (a stretch level
 * short of the target is no stretch).
 */
const target2Of = (
  low: unknown,
  high: unknown,
  isLong: boolean,
  targetPx: number,
): {zone: [number, number]; price: number} | null => {
  const zone = zoneOf(low, high);
  if (zone === null) return null;
  const price = isLong ? zone[0] : zone[1];
  return (isLong ? price > targetPx : price < targetPx) ? {zone, price} : null;
};

/**
 * A row that is not a stock pick by design: an options or spread idea (legs), the model portfolio,
 * or a neutral view. Web leaves these out of the picks as well, so they are not counted as dropped.
 */
const isOtherThanAPick = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Partial<Record<keyof RecommendationRow, unknown>>;
  return (
    row.legs != null ||
    row.horizon === 'portfolio' ||
    (typeof row.direction === 'string' &&
      row.direction.toLowerCase() === 'neutral')
  );
};

/** How a closed pick closed. One that never filled (no exit price) reads as expired, as on web. */
const closedStatus = (exitPrice: number | null, reason: unknown): string =>
  exitPrice === null
    ? 'expired'
    : reason === 'target'
      ? 'hit_target'
      : reason === 'stop'
        ? 'hit_stop'
        : 'expired';

/**
 * One row of the recommendations table as the picks UI reads it, or null when it is not a plain
 * pick this app can show and act on. Web's `recommendationView` (a6642a31, bb3d43ac) keeps a row
 * with no legs, outside the model portfolio, long or short, with all six zone edges; this reader
 * keeps the same and also drops what it cannot act on safely:
 * - anything but an equity: the picks open the equity order pad and size a basket in shares, and a
 *   commodity is a lot of a contract;
 * - a zone edge that is not a positive number, or a zone written high to low;
 * - a stop or target on the wrong side of the entry: the order pad seeds them as exits;
 * - a status other than open or closed;
 * - a published or valid-until stamp that cannot be read: an open pick is placeable only until
 *   `valid_until` (`isPickExpired`), and says when it was published.
 * A row is dropped whole, never shown half filled. The server sends no live price, and none is
 * made up: `cmp` is null, and `ref_price` (the entry zone's midpoint, or the exit price once
 * closed) is what the row's own figures are read at.
 *
 * What backend-go 5295af0e added is read as web's 4105264b maps it, each part kept only when it can
 * be read and none of it a reason to drop the row: target 2 (`target2Of`), the stored entry time
 * and price, and when target 2 was reached. A row without them reads as before, with one addition
 * web makes too: a closed row now carries its exit time (`exited_at`, from `exit_at`, which every
 * closed row had before migration 26), so an old closed call gains that and nothing else. Web reads
 * an open call's fill, exit and target 2 touch live from candles; this reader has only what the
 * server stored once the day was finalised.
 */
function readRecommendation(value: unknown): Recommendation | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Partial<Record<keyof RecommendationRow, unknown>>;
  const {id, symbol, status} = row;
  if (typeof id !== 'number' || !Number.isFinite(id)) return null;
  if (typeof symbol !== 'string' || bareSymbol(symbol) === '') return null;
  if (row.kind !== 'equity') return null;
  if (row.legs != null || row.horizon === 'portfolio') return null;
  if (status !== 'open' && status !== 'closed') return null;
  const direction =
    typeof row.direction === 'string' ? row.direction.toLowerCase() : '';
  if (direction !== 'long' && direction !== 'short') return null;

  const publishedAt = stampOf(row.published_at);
  const validUntil = stampOf(row.valid_until);
  if (publishedAt === null || validUntil === null) return null;

  const entry = zoneOf(row.entry_min, row.entry_max);
  const stop = zoneOf(row.stop_loss_min, row.stop_loss_max);
  const target = zoneOf(row.target_min, row.target_max);
  if (entry === null || stop === null || target === null) return null;

  const isLong = direction === 'long';
  const stopPx = isLong ? stop[1] : stop[0];
  const targetPx = isLong ? target[0] : target[1];
  const entryMid = (entry[0] + entry[1]) / 2;
  const isOrdered = isLong
    ? stopPx < entryMid && entryMid < targetPx
    : targetPx < entryMid && entryMid < stopPx;
  if (!isOrdered) return null;

  const isClosed = status === 'closed';
  const exitPrice = isClosed && isPrice(row.exit_price) ? row.exit_price : null;
  const refPrice = exitPrice ?? entryMid;
  const horizon = typeof row.horizon === 'string' ? row.horizon : '';
  const modifyZone = zoneOf(row.modify_min, row.modify_max);
  const pnl = row.realized_pnl;
  const target2 = target2Of(row.target2_min, row.target2_max, isLong, targetPx);
  const enteredAt = stampOf(row.entry_at);
  const entryPrice = isPrice(row.entry_price) ? row.entry_price : null;
  const exitedAt = isClosed ? stampOf(row.exit_at) : null;
  const target2HitAt = target2 === null ? null : stampOf(row.target2_hit_at);

  return {
    id,
    stock_symbol: bareSymbol(symbol),
    market: typeof row.market === 'string' ? row.market : '',
    kind: row.kind,
    horizon,
    direction,
    verdict: isLong ? 'Buy' : 'Sell',
    tone: isLong ? 'pos' : 'cau',
    remark: textOf(row.remark),
    rationale: textOf(row.rationale) ?? '',
    entry_min: entry[0],
    entry_max: entry[1],
    stop_loss: stopPx,
    stop_loss_zone: stop,
    target_price: targetPx,
    target_zone: target,
    cmp: null,
    ref_price: refPrice,
    ref_basis: exitPrice === null ? 'entry_mid' : 'exit',
    upside_pct:
      ((isLong ? targetPx - refPrice : refPrice - targetPx) / refPrice) * 100,
    risk_reward: Math.abs(targetPx - entryMid) / Math.abs(entryMid - stopPx),
    hold_label: textOf(row.hold_label) ?? horizon,
    status: isClosed ? closedStatus(exitPrice, row.exit_reason) : 'active',
    published_at: publishedAt,
    valid_until: validUntil,
    ...(isClosed && typeof pnl === 'number' && Number.isFinite(pnl)
      ? {realized_pnl: pnl}
      : {}),
    ...(exitPrice === null ? {} : {resolved_price: exitPrice}),
    modify_zone: modifyZone,
    modify_note: textOf(row.modify_note),
    ...(target2 === null
      ? {}
      : {target2_zone: target2.zone, target2_price: target2.price}),
    ...(enteredAt === null ? {} : {entered_at: enteredAt}),
    ...(entryPrice === null ? {} : {entry_price: entryPrice}),
    ...(exitedAt === null ? {} : {exited_at: exitedAt}),
    ...(target2HitAt === null ? {} : {target2_hit_at: target2HitAt}),
  };
}

/**
 * The response as the picks UI reads it: the rows `readRecommendation` keeps, in the server's
 * order, and how many it could not keep (`dropped`), not counting the rows that are not picks.
 */
const readRecommendations = (
  wire: Partial<RecommendationsWire> | null,
): MarketRecommendationsResponse => {
  const rows: unknown = wire?.recommendations;
  const recommendations: Recommendation[] = [];
  let dropped = 0;
  if (Array.isArray(rows)) {
    for (const row of rows as unknown[]) {
      const read = readRecommendation(row);
      if (read !== null) recommendations.push(read);
      else if (!isOtherThanAPick(row)) dropped += 1;
    }
  }
  return wire?.showing_closed === true
    ? {recommendations, dropped, showing_closed: true}
    : {recommendations, dropped};
};

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

/**
 * The segment note as the server sends it. Go serialises a nil slice as null, so a company whose
 * note carried no segment, period or filing can answer null where those lists belong, and so can a
 * segment's series; the table reads every one of them, so each is filled once here.
 */
type SegmentSeriesWire = Nullable<
  SegmentSeries,
  'revenue' | 'result' | 'capital_employed'
>;

interface SegmentsWire extends Omit<
  Nullable<
    SegmentsResponse,
    'basis_available' | 'period_available' | 'periods' | 'filings'
  >,
  'segments'
> {
  segments: SegmentSeriesWire[] | null;
}

const readSegments = ({
  basis_available,
  period_available,
  periods,
  segments,
  filings,
  ...note
}: SegmentsWire): SegmentsResponse => ({
  ...note,
  basis_available: basis_available ?? [],
  period_available: period_available ?? [],
  periods: periods ?? [],
  segments: (segments ?? []).map(
    ({revenue, result, capital_employed, ...segment}) => ({
      ...segment,
      revenue: revenue ?? [],
      result: result ?? [],
      capital_employed: capital_employed ?? [],
    }),
  ),
  filings: filings ?? [],
});

/**
 * The related-party table as the server sends it, with the same nil-slice nulls: a year with no
 * source, a party with no transaction or a row with no figures. Filled here once, as above.
 */
type RelatedPartyColumnWire = Nullable<RelatedPartyColumn, 'sources'>;
type RelatedPartyTxnWire = Nullable<RelatedPartyTxnRow, 'values'>;

interface RelatedPartyRowWire extends Omit<
  Nullable<RelatedPartyRow, 'values'>,
  'txns'
> {
  txns: RelatedPartyTxnWire[] | null;
}

interface RelatedPartyWire extends Omit<
  RelatedPartyResponse,
  'columns' | 'parties'
> {
  columns: RelatedPartyColumnWire[] | null;
  parties: RelatedPartyRowWire[] | null;
}

const readRelatedParty = ({
  columns,
  parties,
  ...table
}: RelatedPartyWire): RelatedPartyResponse => ({
  ...table,
  columns: (columns ?? []).map(({sources, ...column}) => ({
    ...column,
    sources: sources ?? [],
  })),
  parties: (parties ?? []).map(({values, txns, ...party}) => ({
    ...party,
    values: values ?? [],
    txns: (txns ?? []).map(txn => ({...txn, values: txn.values ?? []})),
  })),
});

export const marketApi = (http: HttpClient) => ({
  /** The plain picks among the rows, each as the picks UI reads it (`readRecommendation`). */
  getRecommendations: async (
    params?: RecommendationsQuery,
  ): Promise<MarketRecommendationsResponse> =>
    readRecommendations(
      await http.request<Partial<RecommendationsWire> | null>(
        `/market/recommendations${query({
          horizon: params?.horizon,
          kind: params?.kind ?? 'equity',
          status: params?.status,
        })}`,
      ),
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

  /**
   * One session's market profile: the price ladder, its key levels, the setups read off it and
   * the order flow estimated beside it. A stock or index is asked for by `symbol`, a future by its
   * `underlying` and expiry `month` (YYYY-MM). Without a `session` (YYYY-MM-DD) the newest session
   * with bars answers, and lists the sessions that can be asked for. An instrument with no bars is
   * the endpoint's 404, and a future the exchange does not list that month its 400.
   */
  getMarketProfile: (instrument: ProfileInstrument, session?: string) =>
    http.request<MarketProfile>(
      `/market/profile${query({...instrument, session})}`,
    ),

  getMarketDepth: (symbol: string) =>
    http.request<MarketDepth>(`/market/depth${query({symbol})}`),

  /**
   * RS Sector Matrix (backend `dev`, handlers/rssectormatrix): every catalogue index ranked by how
   * many others it is beating on a Point & Figure chart of their price ratio, at one box size
   * (a percentage of the ratio, 0.05 to 10; the server's default is 0.25).
   */
  getRsSectorMatrix: (box?: number) =>
    http.request<RsSectorMatrix>(`/market/rs-sector-matrix${query({box})}`),

  /** One pair's P&F columns. 400 when row and col are the same, 404 when either has no current price. */
  getRsSectorPair: (row: string, col: string, box?: number) =>
    http.request<RsPair>(
      `/market/rs-sector-matrix/pair${query({box, row, col})}`,
    ),

  /**
   * The options regime (backend `dev`, handlers/regimepulse): the latest reading of every scored
   * underlying, one request for a whole screen of chips. Without a `date` (YYYY-MM-DD) the newest
   * stored trading day answers; before the engine has stored anything the rows are `[]`.
   */
  getRegimeSnapshot: (date?: string) =>
    http.request<RegimeSnapshot>(
      `/market/regimepulse/snapshot${query({date})}`,
    ),

  /** How many underlyings sit in each regime through the session. */
  getRegimeSentiment: (date?: string) =>
    http.request<RegimeSentiment>(
      `/market/regimepulse/sentiment${query({date})}`,
    ),

  /** The trading days the engine has stored, newest first: the days a scanner can replay. */
  getRegimeDates: () => http.request<RegimeDates>('/market/regimepulse/dates'),

  /** One underlying's readings through the session, oldest first, with its strikes and ATM. */
  getRegimeDetail: (symbol: string, date?: string) =>
    http.request<RegimeDetail>(
      `/market/regimepulse/detail${query({symbol, date})}`,
    ),

  /**
   * One underlying's tracked contracts against decay-only pricing through the session, oldest cycle
   * first; the internal `signal` is blank unless the account sees it.
   */
  getRegimeDecay: (symbol: string, date?: string) =>
    http.request<RegimeDecay>(
      `/market/regimepulse/decay${query({symbol, date})}`,
    ),

  /** Whether the account sees the internal signals the snapshot otherwise blanks. */
  getRegimeMe: () =>
    http.request<{internal: boolean}>('/market/regimepulse/me'),

  /** The underlyings the engine scores. */
  getRegimeSymbols: () => http.request<string[]>('/market/regimepulse/symbols'),

  /**
   * The option levels (backend `dev`, handlers/flyone): every chain's latest row for one expiry
   * rank, one request for a screen of levels cards. Without a `date` the newest stored day answers.
   */
  getFlyoneSnapshot: (expiry: ExpiryRank, date?: string) =>
    http.request<FlyoneSnapshot>(
      `/market/flyone/snapshot${query({expiry, date})}`,
    ),

  /** The trading days the engine has stored, newest first: the days the direction scanner replays. */
  getFlyoneDates: () => http.request<FlyoneDates>('/market/flyone/dates'),

  /** F&O names filtered by their levels: `where` is "score>0,gex_regime=POS|STRONG_POS". */
  getFlyoneScreen: ({symbols, ...params}: FlyoneScreenParams) =>
    http.request<FlyoneScreen>(
      `/market/flyone/screen${query({
        ...params,
        symbols:
          symbols === undefined || symbols.length === 0
            ? undefined
            : symbols.join(','),
      })}`,
    ),

  /**
   * One chain's reading in full (backend `dev`, handlers/flyone/live.go): the latest row, the
   * session's minutes, each wing width's vote and the curves the detail charts draw. `expiry` is
   * `near`, `next` or an exact expiry; the latest stored day answers without a `date`.
   */
  getFlyoneDetail: (symbol: string, {expiry, date}: FlyoneDetailParams = {}) =>
    http.request<FlyoneDetail>(
      `/market/flyone/detail${query({symbol, expiry, date})}`,
    ),

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

  /**
   * One company's segment note: revenue, result and capital employed for each reportable segment,
   * on the basis and at the frequency asked. The answer names the basis it was served on, which
   * falls back to the other one when the asked basis was not filed.
   *
   * 404 means nothing was extracted for the company and resolves to null. Every other status
   * throws, so a blip is never cached as "no segments".
   */
  getSegments: async (
    symbol: string,
    basis: StatementBasis,
    period: SegmentPeriod,
  ): Promise<SegmentsResponse | null> => {
    try {
      return readSegments(
        await http.request<SegmentsWire>(
          `/news/segments${query({symbol, basis, period})}`,
        ),
      );
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  },

  /**
   * One company's related-party transactions, a column per fiscal year. 404 means no such company
   * and resolves to null, as the filing detail does; every other status throws, so a blip is never
   * cached as "none filed".
   */
  getRelatedParty: async (
    symbol: string,
  ): Promise<RelatedPartyResponse | null> => {
    try {
      return readRelatedParty(
        await http.request<RelatedPartyWire>(
          `/news/related-party${query({symbol})}`,
        ),
      );
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  },

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
