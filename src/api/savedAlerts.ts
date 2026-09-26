import type {SavedAlert, SavedAlertsResponse} from '../types/savedAlert.ts';
import type {HttpClient} from './http.ts';

/** Saved alerts live at `/watchlists`: the endpoint predates the rename and keeps its name. */
export const savedAlertsApi = (http: HttpClient) => ({
  /** Every saved alert on the account. */
  getSavedAlerts: () => http.request<SavedAlertsResponse>('/watchlists'),

  /**
   * Update-only: an id absent from the body is left untouched, so this can
   * add, rename and mute but never remove. Deleting goes through `deleteSavedAlert`.
   */
  saveSavedAlerts: (savedAlerts: SavedAlert[]) =>
    http.request<SavedAlertsResponse>('/watchlists', {
      method: 'PUT',
      body: {watchlists: savedAlerts},
    }),

  /** The only way a saved alert is removed. */
  deleteSavedAlert: (id: string) =>
    http.request<unknown>(`/watchlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
});

export type SavedAlertsApi = ReturnType<typeof savedAlertsApi>;
