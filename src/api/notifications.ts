import type {NotificationPreferencesResponse} from '../types/notificationPreferences.ts';
import type {
  PicksLogResponse,
  deleteNotificationResponse,
  getNotificationsResponse,
  markReadResponse,
} from '../types/notifications.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

export interface NotificationsQuery {
  cursor?: string;
  limit?: number;
}

export const notificationsApi = (http: HttpClient) => ({
  /**
   * The full inbox — every notification kind the server produces, cursor-paged.
   * Not /alerts/history: that serves the eight alert channels only, so fill
   * confirmations (money moved) never reach it.
   */
  getNotifications: (params?: NotificationsQuery) =>
    http.request<getNotificationsResponse>(
      `/notifications${query({cursor: params?.cursor, limit: params?.limit})}`,
    ),

  /** Mobile-only: the week-by-week picks ledger behind the notification centre. */
  getPicksLog: () => http.request<PicksLogResponse>('/picks-log'),

  markRead: (id: string) =>
    http.request<markReadResponse>(`/notifications/${id}/read`, {
      method: 'PUT',
    }),

  markAllRead: () =>
    http.request<markReadResponse>('/notifications/read-all', {
      method: 'PUT',
    }),

  remove: (id: string) =>
    http.request<deleteNotificationResponse>(`/notifications/${id}`, {
      method: 'DELETE',
    }),

  getPreferences: () =>
    http.request<NotificationPreferencesResponse>('/notifications/preferences'),

  /** Sends only the switches that changed; the server replies with the full saved set. */
  updatePreferences: (preferences: Record<string, boolean>) =>
    http.request<NotificationPreferencesResponse>(
      '/notifications/preferences',
      {
        method: 'PUT',
        body: {preferences},
      },
    ),
});

export type NotificationsApi = ReturnType<typeof notificationsApi>;
