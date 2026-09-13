/** The request-side screener filters and timeframe; the row/filter UI types live in types/screener. */
export type ScreenerTimeframe = '1m' | '5m' | '15m' | '1d';

export const TIMEFRAME_OPTIONS: readonly ScreenerTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '1d',
];

/**
 * The screener's default timeframe. Intentionally differs from user_prefs.time_interval's DB
 * default and the backend's own screenerDefaultInterval (both "1m") — the pref still wins when set.
 */
export const DEFAULT_TIMEFRAME: ScreenerTimeframe = '15m';

export interface ScreenerBackendFilters {
  near_52w_high?: string;
  high_volume?: string;
  universe?: string;
  interval?: ScreenerTimeframe;
  rsi_min?: string;
  rsi_max?: string;
  trend?: string;
  /** Custom indicator ranges — server-side only, the row payload has no indicator values. */
  ind?: string;
}
