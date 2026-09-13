export interface AppNotification {
  id: string;
  user_id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, string> | null;
  read_at: string | null;
  created_at: string;
}

export interface getNotificationsResponse {
  notifications: AppNotification[];
  next_cursor: string | null;
  has_more: boolean;
  unread_count: number;
}

export interface markReadResponse {
  updated: number;
}

export interface deleteNotificationResponse {
  deleted: number;
}

export interface PicksLogWeek {
  week_start: string;
  wins: number;
  losses: number;
  pnl: number;
}

export interface PicksLogOpenPick {
  symbol: string;
  horizon: string;
  entry_min: number;
  entry_max: number;
  last_price: number;
  change_pct: number;
  enterable: boolean;
}

/** The picks scorecard behind a "how did last week's picks do" notification (mobile only today). */
export interface PicksLogResponse {
  weeks: PicksLogWeek[];
  wins: number;
  losses: number;
  hit_rate_pct: number;
  net_pnl: number;
  worst_week: PicksLogWeek | null;
  open_picks: PicksLogOpenPick[];
  window_weeks: number;
}
