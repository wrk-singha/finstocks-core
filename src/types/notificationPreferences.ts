/**
 * One switchable notification, as served by GET /notifications/preferences.
 *
 * The backend owns the catalog — label, description and grouping all arrive with the value
 * (services/notifications/preferences.go). Nothing here is hardcoded client-side, so a kind
 * added or reworded on the server appears without an app release.
 */
export interface NotificationPreference {
  /** The user_prefs column, echoed back on save. */
  key: string;
  /** The notification Kind this switch governs, for debugging. */
  kind: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreference[];
}
