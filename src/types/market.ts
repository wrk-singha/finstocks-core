/** Market page response types — mirror `market-api-contract.md` exactly. */

export type RecommendationHorizon = 'swing' | 'intraday' | 'longterm';

/** Row from `autopilot_recommendations` (market='IN'). */
export interface Recommendation {
  id: number;
  stock_symbol: string;
  market: string;
  horizon: string;
  direction: string;
  verdict: string;
  /** pos = constructive/green · neu = neutral · cau = cautious/amber */
  tone: string;
  conviction_pct: number;
  rationale: string;
  entry_min: number;
  /** Upper edge of the published entry band. Absent on rows written before the
   *  zone existed, where entry_min stands for the whole zone. */
  entry_max?: number | null;
  stop_loss: number;
  target_price: number;
  cmp: number;
  upside_pct: number;
  risk_reward: number;
  hold_label: string;
  status: string;
  realized_pnl?: number;
  resolved_price?: number;
}

/** GET /api/market/recommendations */
export interface MarketRecommendationsResponse {
  recommendations: Recommendation[];
  /** The batch shown is the previous session's — the new one is not out yet. */
  showing_closed?: boolean;
  /** IST wall clock "HH:MM" the next batch publishes at, counted down locally. */
  next_batch_at?: string;
  /** RFC3339 stamp of when the shown batch was published. */
  last_updated_at?: string;
}

/** One resolved (closed) recommendation — from autopilot_recommendations. */
export interface ClosedTrade {
  stock_symbol: string;
  direction: string;
  /** hit_target | hit_stop | closed */
  status: string;
  realized_pnl: number;
  resolved_price: number | null;
  entry_min: number;
  hold_minutes: number;
  resolved_at: string;
  /** Strategy-report rows only — the strategy that produced the trade. Absent on
   *  recommendation rows, which have no parent strategy. */
  strategy_name?: string;
}

/** Cumulative realized P&L after one closed trade, with the running peak it is
 *  measured against — `p - c` is the drawdown at that trade. */
export interface EquityPoint {
  t: string;
  c: number;
  p: number;
}

/** Realized P&L of the trades that closed in one IST month ("YYYY-MM"). */
export interface MonthlyPnl {
  month: string;
  pnl: number;
  trades: number;
}

/** GET /api/market/recommendation-report (stock picks) and
 *  /api/market/strategy-report (strategy picker trades). One shape, two sources —
 *  the drawer renders either through the same components. Edge metrics cover
 *  every closed trade and are null when there is nothing to derive them from.
 *  ₹ figures are per recommended position; % figures are the entry → exit price
 *  move. No capital base exists, so there is no % drawdown or return on capital. */
export interface RecommendationReport {
  won_pct: number | null;
  monthly_pnl: number;
  total_setups: number;
  hit_count: number;
  updated_at: string | null;
  profit_factor: number | null;
  expectancy: number | null;
  avg_return_pct: number | null;
  avg_win: number | null;
  avg_loss: number | null;
  avg_win_pct: number | null;
  avg_loss_pct: number | null;
  /** Null when no trade closed in profit. */
  best_trade: number | null;
  max_drawdown_inr: number;
  /** Trades the worst drawdown took to regain its peak; null while unrecovered. */
  drawdown_recovery_trades: number | null;
  closed_trades: ClosedTrade[];
  equity_curve: EquityPoint[];
  monthly_returns: MonthlyPnl[];
}

/** GET /api/market/overview. Sector return %s live in MarketMovers (computed from
 *  NSE sector-index OHLC); this payload carries the LLM narrative fields. */
export interface MarketOverview {
  sentiment: string;
  outlook: string;
  themes: string;
  leading_sector: string | null;
  lagging_sector: string | null;
  leading_reason: string | null;
  lagging_reason: string | null;
  trending_sectors: string | null;
  sectors_to_watch: string | null;
  sector_rotation: string | null;
  economic_impact: string | null;
  geopolitical_factors: string | null;
  updated_at: string;
}

/** One Nifty-50 constituent's latest daily move (heatmap cell). */
export interface Mover {
  symbol: string;
  last: number;
  change_pct: number;
}

/** One session's institutional flow for one reporting source, in Rs crore. */
export interface InstitutionalFlowRow {
  date: string;
  source: string;
  eq_gross_purchase: number | null;
  eq_gross_sale: number | null;
  eq_net: number | null;
  eq_cumulative: number | null;
  debt_gross_purchase: number | null;
  debt_gross_sale: number | null;
  debt_net: number | null;
  debt_cumulative: number | null;
  usd_rate: number | null;
  updated_at: string;
}

/** One NSE sector index's latest daily move. */
export interface SectorReturn {
  name: string;
  symbol: string;
  change_pct: number;
}

/**
 * Advance/decline breadth, derived from the resolved Nifty-50 moves. `total` is
 * the sample the score was computed over and `expected` the full universe; they
 * diverge when the feed cannot price a symbol, which `partial` flags.
 */
export interface Breadth {
  advancing: number;
  declining: number;
  unchanged: number;
  total: number;
  expected?: number;
  partial?: boolean;
  ad_ratio: number;
  score: number;
}

/** GET /api/market/movers — heatmap + breadth + sector returns. */
export interface MarketMovers {
  movers: Mover[];
  sectors: SectorReturn[];
  breadth: Breadth;
}

export type NewsDirection = 'bullish' | 'bearish' | 'neutral';

/** Single item from GET /api/market/news. Nullable fields are `null` when absent. */
export interface MarketNewsItem {
  stock_symbol: string;
  stock_name: string;
  sector: string;
  cmp: number | null;
  change_pct: number | null;
  headline: string;
  confidence_level: string;
  direction: NewsDirection | null;
  catalyst: string | null;
  catalyst_type: string | null;
  net_score: number | null;
  target_price: number | null;
  upside_pct: number | null;
  news_sources: string[] | null;
  analysis_date: string | null;
}

/** GET /api/market/news */
export interface MarketNewsResponse {
  news: MarketNewsItem[];
}

// drift resolved 2026-09-13: the web listed only dividend/dividend_alert; the mobile copy carries
// the BSE filing kinds the calendar endpoint also serves, so the union is the contract.
export type MarketEventType =
  'dividend' | 'dividend_alert' | 'dividend_notice' | 'agm' | 'meeting';

/**
 * One normalized market-calendar entry. `symbol` is "" for BSE filing rows
 * (agm/meeting/dividend_notice) — that source is keyed by scripcode with no
 * symbol mapping, so those rows aren't tappable.
 */
export interface MarketEvent {
  event_date: string;
  type: MarketEventType;
  symbol: string;
  title: string;
  subtitle: string | null;
  detail: string | null;
}

/** GET /api/market/events */
export interface MarketEventsResponse {
  events: MarketEvent[];
}

/** One price level in the order book. */
export interface DepthLevel {
  price: number;
  quantity: number;
  orders: number;
}

/** GET /api/market/depth?symbol= — five-deep order book. */
export interface MarketDepth {
  bids: DepthLevel[];
  asks: DepthLevel[];
  totalBidQty: number;
  totalAskQty: number;
  /** Unix seconds the snapshot was captured. */
  asOf?: number;
  atp?: number;
  buyQty?: number;
  sellQty?: number;
  oi?: number;
  dayHighOi?: number;
  dayLowOi?: number;
  upperCircuit?: number;
  lowerCircuit?: number;
  spreadBps?: number;
  bidAskImbalance?: number;
  /**
   * The instrument the book is of. A stored book names the symbol as it was asked for, in upper
   * case; a live one names it as the feed spells it, which for a contract need not be the
   * spelling it was asked under.
   */
  symbol?: string;
  /** Last traded price in the book. Left out when it is nought. */
  ltp?: number;
  /** Why an answer has empty sides, where the backend gives a reason. */
  note?: string;
  /** The quant's Depth IEP reading of this book (backend-go/internal/market/depthiep). */
  interpretation?: DepthInterpretation;
  /** Why the book was refused a reading (crossed, one-sided, empty touch). */
  interpretationError?: string;
  /** Which part of the day the backend served this book for. */
  session?: MarketSession;
  /** Pre-open only: NSE's call auction run on the visible book. */
  auction?: PreOpenAuction;
}

/** backend-go/internal/market/depthiep/auction.go. `iep` is null until buyers
 *  and sellers overlap at some price. */
export interface PreOpenAuction {
  iep: number | null;
  matched_quantity: number;
  unmatched_quantity: number;
  unmatched_side?: 'buy' | 'sell';
  reference_price: number | null;
  total_buy_quantity: number;
  total_sell_quantity: number;
  total_book_imbalance: number;
  total_book_imbalance_pct: number;
  broader_bias: DepthBias;
  neutral_band: number;
}

export type DepthBias = 'bullish' | 'bearish' | 'neutral';

export type MarketSession = 'preopen' | 'open' | 'closed';

/** Field names are the quant's own, from Zerodha Depth IEP.py. Imbalances are
 *  decimals (0.3171 = 31.71%); the *_pct fields carry the same as percentages. */
export interface DepthInterpretation {
  last_price: number | null;
  best_bid: number;
  best_ask: number;
  midpoint: number;
  spread: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  visible_buy_quantity: number;
  visible_sell_quantity: number;
  total_book_imbalance: number;
  top5_imbalance: number;
  weighted_top5_imbalance: number;
  total_book_imbalance_pct: number;
  top5_imbalance_pct: number;
  weighted_top5_imbalance_pct: number;
  best_level_microprice: number;
  rough_iep: number;
  rough_iep_rounded: number;
  tick_size: number;
  neutral_band: number;
  stale_spread_multiple: number;
  ltp_distance_from_mid: number | null;
  ltp_distance_in_spreads: number | null;
  data_quality: 'valid' | 'stale_or_unsynchronised_depth';
  signal_valid: boolean;
  broader_bias: DepthBias;
  immediate_bias: DepthBias;
  final_interpretation: string;
}

/** The list a stock was opened from — screen results, recommendations,
 *  movers — so the detail view can step between them without going back. */
export interface SymbolGroup {
  label: string;
  symbols: string[];
}
