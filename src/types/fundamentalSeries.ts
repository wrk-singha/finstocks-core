/**
 * Fundamentals as chart lines: the catalogue /news/fundamentals/metrics serves for one company, and
 * the series /news/fundamentals/series serves for one of its lines. Every value is computed by the
 * backend; a chart only places each point on the bars it covers.
 */

/** Q quarterly · A annual · TTM trailing four quarters · D daily. */
export type FundamentalPeriod = 'Q' | 'A' | 'TTM' | 'D';

export type FundamentalUnit =
  | 'crore'
  | 'rupees'
  | 'pct'
  | 'x'
  | 'days'
  | 'shares'
  | 'count'
  | 'ratio'
  | 'score';

/** One statement the lines are filed in: the income statement, the balance sheet, a bank's own. */
export interface FundamentalGroup {
  id: string;
  label: string;
}

export interface FundamentalMetric {
  id: string;
  label: string;
  /** The statement it is filed in, a `FundamentalGroup` id. */
  group: string;
  /** The part of that statement it sits in ("Revenue", "Assets"). */
  section?: string;
  unit: FundamentalUnit;
  /** 1 for a line that breaks down the one above it. */
  level: number;
  periods: FundamentalPeriod[];
  description?: string;
  /** What other platforms call the same line; searched, never shown. */
  aliases?: string[];
  /** Points per period for the company the catalogue was asked about. */
  available?: Partial<Record<FundamentalPeriod, number>>;
}

export interface FundamentalCatalog {
  symbol?: string;
  basis?: string;
  groups: FundamentalGroup[];
  metrics: FundamentalMetric[];
}

export interface FundamentalPoint {
  /** The period's end (or the day), epoch seconds. */
  time: number;
  period: string;
  value: number;
  /** Against the previous point of the same series. */
  change_pct?: number;
}

export interface FundamentalSeries {
  symbol: string;
  metric: FundamentalMetric;
  period: FundamentalPeriod;
  basis: string;
  points: FundamentalPoint[];
}

/** The chart's last traded price and the bar it traded in, which a daily series can end on. */
export interface FundamentalLivePrice {
  price: number;
  /** Epoch seconds of that bar. */
  at: number;
}
