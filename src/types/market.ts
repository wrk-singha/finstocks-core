/** Market page response types — mirror `market-api-contract.md` exactly. */

export type RecommendationHorizon = 'swing' | 'intraday' | 'longterm';

/** A leg of an options/spread recommendation, or a holding of the model portfolio. */
export interface RecommendationLeg {
  instrument?: string;
  side?: 'buy' | 'sell';
  lots?: number;
  symbol?: string;
  weight?: number;
  entry?: number | null;
  exit_price?: number | null;
}

/**
 * A row of the `recommendations` table as GET /api/market/recommendations sends it (backend-go
 * 4c8bf631, `repository.Recommendation`). Read only through `marketApi.getRecommendations`, which
 * turns the rows it can read into `Recommendation`s and drops the rest.
 */
export interface RecommendationRow {
  id: number;
  market: string;
  /** equity | commodity */
  kind: string;
  /** intraday | btst | swing | positional | longterm | portfolio */
  horizon: string;
  /** "RELIANCE-NSE"; MCX names pass through. */
  symbol: string;
  /** long | short | neutral */
  direction: string;
  legs: RecommendationLeg[] | null;
  remark: string | null;
  rationale: string | null;
  hold_label: string | null;
  entry_min: number | null;
  entry_max: number | null;
  stop_loss_min: number | null;
  stop_loss_max: number | null;
  target_min: number | null;
  target_max: number | null;
  modify_min: number | null;
  modify_max: number | null;
  modify_note: string | null;
  published_at: string;
  valid_until: string;
  updated_at: string;
  /** open | closed | cancelled */
  status: string;
  exit_at: string | null;
  exit_price: number | null;
  /** target | stop | expired | manual */
  exit_reason: string | null;
  realized_pnl: number | null;
  return_pct: number | null;
}

/** GET /api/market/recommendations as the server sends it. `next_batch_at` is no longer sent. */
export interface RecommendationsWire {
  recommendations: RecommendationRow[] | null;
  /** Nothing is open, so the rows are the latest day that closed any. */
  showing_closed?: boolean;
}

/**
 * One plain pick as the picks UI renders it: a single stock, long or short, with its entry, stop
 * and target zones, read from a `RecommendationRow` (see `getRecommendations`). The scalar levels
 * are the zone edge a fill exits at; the zones stay on the row for display.
 */
export interface Recommendation {
  id: number;
  /** Bare for an exchange equity (RELIANCE), the name the rest of the app uses. */
  stock_symbol: string;
  market: string;
  kind: string;
  horizon: string;
  direction: 'long' | 'short';
  verdict: 'Buy' | 'Sell';
  /** pos = long · cau = short */
  tone: 'pos' | 'cau';
  remark: string | null;
  rationale: string;
  entry_min: number;
  entry_max: number;
  /** The stop zone's edge nearest the entry: its top for a long, its bottom for a short. */
  stop_loss: number;
  stop_loss_zone: [number, number];
  /** The target zone's edge nearest the entry: its bottom for a long, its top for a short. */
  target_price: number;
  target_zone: [number, number];
  /**
   * A live price for the symbol (the app's own quote), or null. The server sends none and the
   * reader sets none: an order is priced and sized only by a live quote, never by `ref_price`.
   */
  cmp: number | null;
  /**
   * The price the row's figures are read at while no live one is known, and what `ref_basis`
   * says it is: the entry zone's midpoint while the pick is open, its exit price once it closed
   * with one. Shown only with that label; never an order's price or size.
   */
  ref_price: number;
  ref_basis: 'entry_mid' | 'exit';
  /** Target against `ref_price`, in %. */
  upside_pct: number;
  /** Reward over risk, both measured from the entry zone's midpoint. Always above 0. */
  risk_reward: number;
  hold_label: string;
  /** active (open) · hit_target · hit_stop · expired (closed, including not triggered) */
  status: string;
  published_at: string;
  valid_until: string;
  realized_pnl?: number;
  resolved_price?: number;
  modify_zone: [number, number] | null;
  modify_note: string | null;
}

/** GET /api/market/recommendations, read: only the rows that are plain picks. */
export interface MarketRecommendationsResponse {
  recommendations: Recommendation[];
  /** The batch shown is the previous session's — the new one is not out yet. */
  showing_closed?: boolean;
  /** IST wall clock "HH:MM" the next batch publishes at. No longer sent; kept for the horizons. */
  next_batch_at?: string;
  /** RFC3339 stamp of when the shown batch was published. No longer sent. */
  last_updated_at?: string;
}

/** One resolved (closed) recommendation — from the `recommendations` table. */
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
}

/** What we'd do about a stock, as one number. */
export type ScoreAction = 'buy' | 'hold' | 'sell';

/**
 * One component of the score. `tab` names where the evidence for it lives, so
 * the score doubles as the table of contents for the rest of the drawer — a
 * number you can't chase down to its reasoning is just an opinion with a
 * decimal point.
 */
export interface StockScorePillar {
  key: string;
  label: string;
  /** 0–100. */
  score: number;
  /** The single fact behind the number, in a person's words. Optional: the
   *  scoring endpoint doesn't return per-pillar prose. */
  note?: string;
  /** Drawer tab that evidences this pillar. */
  tab?: string;
}

/**
 * The mapped shape every score surface renders — built by `mapStockScore` from
 * the raw `StockScoreResponse` in `types/scores`.
 */
export interface StockScore {
  stock_symbol: string;
  /** 0–100, the headline. */
  score: number;
  action: ScoreAction;
  /** How much weight we put behind the action. Separate from the score: a
   *  stock can score well on evidence we hold with little confidence. */
  conviction_pct: number;
  /** One line of why. */
  summary: string;
  pillars: StockScorePillar[];
  updated_at?: string;
}

/** The list a stock was opened from — screen results, recommendations,
 *  movers — so the detail view can step between them without going back. */
export interface SymbolGroup {
  label: string;
  symbols: string[];
}
