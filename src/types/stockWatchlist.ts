/**
 * A named list of instruments the user follows — one list per surface that shows a bookmark, all
 * reading the same account. Not `SavedAlert` in `types/savedAlert.ts`, which is a chat-created
 * alert (shown to people as "Alerts").
 */
export interface StockWatchlist {
  id: string;
  name: string;
  description: string;
  /** Newest first. */
  symbols: string[];
  /** Named groups; a symbol in none sits above the first. */
  sections: StockWatchlistSection[];
  /** Set while the list has a public link. */
  share_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockWatchlistSection {
  name: string;
  symbols: string[];
}

export type FlagColor =
  'red' | 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'pink';

export interface StockWatchlistFlag {
  symbol: string;
  color: FlagColor;
  updated_at: string;
}

export type WatchlistSymbolType = 'stock' | 'index' | 'other';

/** What the watchlist symbol search looks through. */
export type WatchlistSearchType = 'all' | 'stock' | 'index';

export interface WatchlistSearchResult {
  symbol: string;
  name: string;
  type: WatchlistSymbolType;
  exchange: string;
  sector?: string;
}

/**
 * One advanced-view row, every figure computed by the backend from the daily
 * candles and the company master. A figure the data cannot support is null.
 */
export interface StockWatchlistDetail {
  symbol: string;
  name: string;
  type: WatchlistSymbolType;
  exchange: string;
  sector?: string;
  industry?: string;
  as_of?: string;
  last: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  avg_vol_10: number | null;
  market_cap: number | null;
  pe: number | null;
  eps: number | null;
  pb: number | null;
  ev_ebitda: number | null;
  dividend_yield: number | null;
  perf_1w: number | null;
  perf_1m: number | null;
  perf_3m: number | null;
  perf_6m: number | null;
  perf_ytd: number | null;
  perf_1y: number | null;
  volatility: number | null;
  beta: number | null;
  max_drawdown: number | null;
  high_52w: number | null;
  low_52w: number | null;
  rsi_14: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  macd_hist: number | null;
  signal?: 'Bullish' | 'Neutral' | 'Bearish';
}

export interface SharedStockWatchlist {
  name: string;
  description: string;
  symbols: string[];
  sections: StockWatchlistSection[];
  details: StockWatchlistDetail[];
}

/** GET /stock-watchlists. */
export interface StockWatchlistsResponse {
  watchlists: StockWatchlist[];
}

/** GET /stock-watchlists/{id}/details. */
export interface StockWatchlistDetailsResponse {
  details: StockWatchlistDetail[];
}

/** GET /stock-watchlist-flags. */
export interface StockWatchlistFlagsResponse {
  flags: StockWatchlistFlag[];
}

/** GET /stock-watchlist-removed: "Deleted symbols", newest first. */
export interface RemovedWatchlistSymbolsResponse {
  symbols: string[];
}

/** GET /stock-watchlist-search. */
export interface WatchlistSearchResponse {
  results: WatchlistSearchResult[];
}

export interface CreateStockWatchlistRequest {
  name: string;
  /** Filed on the new list straight away, so "new list with this stock" is one request. */
  symbols?: string[];
}

/** A field left out is left as it is. */
export interface UpdateStockWatchlistRequest {
  id: string;
  name?: string;
  description?: string;
}

export interface AddWatchlistSymbolsRequest {
  id: string;
  symbols: string[];
}

export interface RemoveWatchlistSymbolRequest {
  id: string;
  symbol: string;
}

/** The list's whole order and grouping at once — a reorder, a move between sections. */
export interface ReplaceWatchlistItemsRequest {
  id: string;
  symbols: string[];
  sections: StockWatchlistSection[];
}

export interface CopyStockWatchlistRequest {
  id: string;
  name: string;
}

/** A null colour clears the flag. */
export interface SetWatchlistFlagRequest {
  symbol: string;
  color: FlagColor | null;
}

export interface RestoreWatchlistSymbolRequest {
  symbol: string;
  listId: string;
}
