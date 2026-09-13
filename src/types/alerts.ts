/** Which tab's alert set the bell is opening — Stocks or F&O. */
export type AlertScope = 'stocks' | 'fno';

/** The backend's channel column names (services/notifications/kinds.go). */
export type AlertChannelId =
  | 'stocks_intraday'
  | 'stocks_swing'
  | 'strategies_intraday'
  | 'strategies_swing'
  | 'fno_intraday'
  | 'fno_positional'
  | 'fno_expiry'
  | 'fno_exits';

export interface AlertChannel {
  id: AlertChannelId;
  label: string;
  /** What lands in the user's phone if this is on, in their terms. */
  description: string;
  /**
   * No producer behind this channel yet — shown inert rather than hidden, so the roadmap is
   * visible without promising a delivery that can't happen.
   */
  soon?: boolean;
}

export interface AlertPreferences {
  /**
   * Master switch. Off silences every channel without losing their state, so turning it back
   * on restores the set the user had chosen.
   */
  enabled: boolean;
  channels: Partial<Record<AlertChannelId, boolean>>;
}

export interface AlertHistoryItem {
  id: number | string;
  channel: AlertChannelId | (string & {});
  title: string;
  body: string;
  symbol?: string | null;
  /** ISO timestamp of when it was sent. */
  sent_at: string;
  read?: boolean;
}

export interface AlertHistoryResponse {
  notifications: AlertHistoryItem[];
}
