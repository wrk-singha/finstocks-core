export interface GraphDataPoint {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  /** Only present when the request opted in via `includeVolume`. */
  volume?: number;
  absolute_change?: number;
  relative_change?: number;
}

/** Keyed by the symbol spelling the request used. */
export type StockGraphData = Record<string, GraphDataPoint[]>;

// Columnar wire shape emitted by /api/trading/graph-data and
// /api/share/graph-data: index-aligned parallel arrays per symbol.
// Converted back to GraphDataPoint[] at the fetch boundary.
export interface RawGraphSeries {
  t: string[];
  c: number[];
  // Absent when the request opted into closeOnly (see getGraphData).
  o?: number[];
  h?: number[];
  l?: number[];
  ac?: number[];
  rc?: number[];
  // Present only when the request opted in via includeVolume (see getGraphData).
  v?: number[];
}

export type RawStockGraphData = Record<string, RawGraphSeries>;

// `max` is ours, not model2's — the backend stitches DB history behind its 3y
// ceiling rather than forwarding the value upstream.
export type Period = '1d' | '1w' | '1m' | '3m' | '1y' | '3y' | 'max';

// What the backend actually serves. Only "1m" and "1d" are fetchable; every
// other resolution is aggregated client-side from one of those two, so anything
// bound for the wire must pass through `fetchIntervalFor` first.
// drift resolved 2026-09-13: the web named the full resolution list `Interval`
// and the mobile named the fetchable pair `Interval`; the pair keeps the name
// because it is the backend contract, and the resolution list is `ChartInterval`.
export type Interval = '1m' | '1d';

// What the chart's resolution picker offers. Every value besides "1m"/"1d" is
// bucketed client-side from a "1m" fetch. "1w"/"1M" are the exception: the
// TradingView datafeed builds those from daily bars itself. Note "1M" is a
// month here, "1m" a minute.
export type ChartInterval =
  | Interval
  | '2m'
  | '3m'
  | '5m'
  | '10m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '1w'
  | '1M';

// ChartInterval to the TradingView resolution string the datafeed expects.
// Hours are named in minutes there ("60" is 1h).
export const CHART_INTERVAL_RESOLUTION: Record<ChartInterval, string> = {
  '1m': '1',
  '2m': '2',
  '3m': '3',
  '5m': '5',
  '10m': '10',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '1d': '1D',
  '1w': '1W',
  '1M': '1M',
};

// What an interval is called on a button. Day and above read as their
// resolution; below it the interval string already reads correctly.
export const CHART_INTERVAL_LABEL = Object.fromEntries(
  Object.entries(CHART_INTERVAL_RESOLUTION).map(([interval, resolution]) => [
    interval,
    /[DWM]$/.test(resolution) ? resolution : interval,
  ]),
) as Record<ChartInterval, string>;

// Which of the two fetchable intervals backs a display resolution. Day and above
// come off the daily series; everything below is bucketed from 1-minute bars.
export const fetchIntervalFor = (interval: ChartInterval): Interval =>
  /[dwM]$/.test(interval) ? '1d' : '1m';

// Daily bars reach `max`, which the backend serves by stitching DB history
// behind model2's 3y ceiling. Minute bars stop at 3 months: `1m` means a month
// as a period and a minute as an interval, and that pair returns an empty array
// instead of an error — which made `1w` look like the cap.
export const widestPeriodForInterval = (interval: Interval): Period =>
  interval === '1d' ? 'max' : '3m';

// Narrower first paint: 3m/1m is ~2.4MB per symbol vs ~226KB for 1w. Coarse
// resolutions still start wide — a week of minute bars is only 8 candles at 4h,
// far short of what fills a chart.
const COARSE_RESOLUTION_MINUTES = 30;

export const initialPeriodForInterval = (
  interval: Interval,
  resolutionMinutes = 1,
): Period => {
  if (interval === '1d') return '3y';
  return resolutionMinutes >= COARSE_RESOLUTION_MINUTES ? '3m' : '1w';
};

export interface GetGraphDataRequest {
  symbols: string[];
  market: 'IN';
  period?: Period;
  interval?: Interval;
  isCompare?: boolean;
  hmacToken?: string;
  /** Bars only carry `volume` when the request opts in. */
  includeVolume?: boolean;
  /**
   * Live-refresh cadence in ms while the market is open; `false` opts out
   * entirely. Defaults to 60s. Daily/historical windows that can't change
   * intraday pass `false`.
   */
  refetchInterval?: number | false;
}

export interface GetGraphDataResponse {
  data: StockGraphData;
  success: boolean;
  message?: string;
}

export interface UseGraphDataProps {
  symbols: string[];
  market?: 'IN';
  period?: Period;
  interval?: Interval;
  enabled?: boolean;
  isCompare?: boolean;
  hmacToken?: string;
  /**
   * Live-refresh cadence in ms, suppressed automatically outside market hours.
   * Defaults to a minute — an intraday chart that never refetches shows the
   * same last price for the whole session. Pass `false` for daily/historical
   * windows, which don't move intraday.
   */
  refetchInterval?: number | false;
  /**
   * Opts into the volume column on the wire. Most callers of this shared
   * endpoint (index strips, depth panels, screener sparklines) never read
   * volume, so it is left off by default. Part of the query key.
   */
  includeVolume?: boolean;
  // Caps the bars the server returns, for callers that render fewer pixels than
  // the session has minutes — a 72px sparkline is fed ~360 bars otherwise. Part
  // of the query key, so a thinned series never satisfies a full-detail caller.
  maxPoints?: number;
  // Drops open/high/low and the change columns from the wire for callers that
  // only plot closes. Part of the query key, so a close-only series never
  // satisfies a caller that needs candles.
  closeOnly?: boolean;
  // The subset of `symbols` the caller already knows are option/futures
  // contracts, so the backend routes them to fno_ohlcv_1m without re-deriving
  // it from the symbol's spelling.
  fnoSymbols?: string[];
}

/** One symbol's mark: the newest close and the session bar it is measured from. */
export interface LastPrice {
  close: number;
  session_open: number;
  time: string;
}

export type LastPrices = Record<string, LastPrice>;
