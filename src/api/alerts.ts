import type {
  AlertHistoryResponse,
  AlertPreferences,
  AlertScope,
} from '../types/alerts.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

export const alertsApi = (http: HttpClient) => ({
  getPreferences: (scope: AlertScope) =>
    http.request<AlertPreferences>(`/alerts/preferences${query({scope})}`),

  updatePreferences: (scope: AlertScope, preferences: AlertPreferences) =>
    http.request<AlertPreferences>('/alerts/preferences', {
      method: 'PUT',
      body: {scope, ...preferences},
    }),

  getHistory: (scope: AlertScope, limit = 30) =>
    http.request<AlertHistoryResponse>(
      `/alerts/history${query({scope, limit})}`,
    ),
});

export type AlertsApi = ReturnType<typeof alertsApi>;
