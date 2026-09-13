import type {Watchlist, WatchlistsResponse} from '../types/watchlist.ts';
import type {HttpClient} from './http.ts';

export const watchlistApi = (http: HttpClient) => ({
  /** Every watchlist on the account. */
  getWatchlists: () => http.request<WatchlistsResponse>('/watchlists'),

  /**
   * Update-only: an id absent from the body is left untouched, so this can
   * add, rename and mute but never remove. Deleting goes through `deleteWatchlist`.
   */
  saveWatchlists: (watchlists: Watchlist[]) =>
    http.request<WatchlistsResponse>('/watchlists', {
      method: 'PUT',
      body: {watchlists},
    }),

  /** The only way a saved watchlist is removed. */
  deleteWatchlist: (id: string) =>
    http.request<unknown>(`/watchlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
});

export type WatchlistApi = ReturnType<typeof watchlistApi>;
