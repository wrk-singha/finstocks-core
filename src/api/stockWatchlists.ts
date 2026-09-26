import type {
  AddWatchlistSymbolsRequest,
  CopyStockWatchlistRequest,
  CreateStockWatchlistRequest,
  RemovedWatchlistSymbolsResponse,
  RemoveWatchlistSymbolRequest,
  ReplaceWatchlistItemsRequest,
  RestoreWatchlistSymbolRequest,
  SetWatchlistFlagRequest,
  SharedStockWatchlist,
  StockWatchlist,
  StockWatchlistDetailsResponse,
  StockWatchlistFlagsResponse,
  StockWatchlistsResponse,
  UpdateStockWatchlistRequest,
  WatchlistSearchResponse,
  WatchlistSearchType,
} from '../types/stockWatchlist.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

const listPath = (id: string) => `/stock-watchlists/${encodeURIComponent(id)}`;

/**
 * The account's stock watchlists. Every write answers with the list as the server now holds it, so
 * a caller can put that row back in its cache without a refetch. Each method takes the shape the
 * web hook passes, so it can stand as a mutation's `mutationFn` unwrapped.
 */
export const stockWatchlistsApi = (http: HttpClient) => ({
  getStockWatchlists: () =>
    http.request<StockWatchlistsResponse>('/stock-watchlists'),

  createStockWatchlist: (body: CreateStockWatchlistRequest) =>
    http.request<StockWatchlist>('/stock-watchlists', {method: 'POST', body}),

  updateStockWatchlist: ({id, ...fields}: UpdateStockWatchlistRequest) =>
    http.request<StockWatchlist>(listPath(id), {method: 'PATCH', body: fields}),

  deleteStockWatchlist: (id: string) =>
    http.request<unknown>(listPath(id), {method: 'DELETE'}),

  /** New symbols go on top. The server refuses the whole batch, not the excess, past its cap. */
  addStockWatchlistSymbols: ({id, symbols}: AddWatchlistSymbolsRequest) =>
    http.request<StockWatchlist>(`${listPath(id)}/items`, {
      method: 'POST',
      body: {symbols},
    }),

  removeStockWatchlistSymbol: ({id, symbol}: RemoveWatchlistSymbolRequest) =>
    http.request<StockWatchlist>(`${listPath(id)}/items${query({symbol})}`, {
      method: 'DELETE',
    }),

  replaceStockWatchlistItems: ({
    id,
    symbols,
    sections,
  }: ReplaceWatchlistItemsRequest) =>
    http.request<StockWatchlist>(`${listPath(id)}/items`, {
      method: 'PUT',
      body: {symbols, sections},
    }),

  copyStockWatchlist: ({id, name}: CopyStockWatchlistRequest) =>
    http.request<StockWatchlist>(`${listPath(id)}/copy`, {
      method: 'POST',
      body: {name},
    }),

  /** Gives the list a public link; the answer carries its `share_id`. */
  shareStockWatchlist: (id: string) =>
    http.request<StockWatchlist>(`${listPath(id)}/share`, {method: 'POST'}),

  unshareStockWatchlist: (id: string) =>
    http.request<StockWatchlist>(`${listPath(id)}/share`, {method: 'DELETE'}),

  getStockWatchlistDetails: (id: string) =>
    http.request<StockWatchlistDetailsResponse>(`${listPath(id)}/details`),

  getStockWatchlistFlags: () =>
    http.request<StockWatchlistFlagsResponse>('/stock-watchlist-flags'),

  /** The server reads an empty colour as "no flag", which is how a null clears one. */
  setStockWatchlistFlag: ({symbol, color}: SetWatchlistFlagRequest) =>
    http.request<unknown>('/stock-watchlist-flags', {
      method: 'PUT',
      body: {symbol, color: color ?? ''},
    }),

  getRemovedWatchlistSymbols: () =>
    http.request<RemovedWatchlistSymbolsResponse>('/stock-watchlist-removed'),

  restoreRemovedWatchlistSymbol: ({
    symbol,
    listId,
  }: RestoreWatchlistSymbolRequest) =>
    http.request<StockWatchlist>('/stock-watchlist-removed/restore', {
      method: 'POST',
      body: {symbol, list_id: listId},
    }),

  searchWatchlistSymbols: (term: string, type: WatchlistSearchType) =>
    http.request<WatchlistSearchResponse>(
      `/stock-watchlist-search${query({q: term, type})}`,
    ),

  /** A list opened from its public link, which a signed-out viewer can follow too. */
  getSharedStockWatchlist: (shareId: string) =>
    http.request<SharedStockWatchlist>(
      `/share/stock-watchlists/${encodeURIComponent(shareId)}`,
      {anonymous: true},
    ),
});

export type StockWatchlistsApi = ReturnType<typeof stockWatchlistsApi>;
