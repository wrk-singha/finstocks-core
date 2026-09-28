import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';
import {cagr} from './profitLossTable.ts';

/**
 * Revenue and profit period by period, the pair a stock's overview charts, with
 * the growth rates read under it and the axis it is drawn against. Figures are
 * ₹ crore, as filed.
 */

export interface PeriodPoint {
  /** The vendor's YYYYMM period end. */
  period: number;
  revenue: number | null;
  profit: number | null;
}

export type PerformanceMeasure = 'revenue' | 'profit';

/** The feed a series came from: the annual profit & loss or the quarterly results. */
export type PerformanceFeed = 'annual' | 'quarter';

// Vendor key pairs differ between the annual and quarterly feeds for the same
// two lines, and a bank files interest earned where a manufacturer files net
// sales — so revenue is read from the first key present rather than one name.
const KEYS: Readonly<
  Record<PerformanceFeed, Readonly<Record<PerformanceMeasure, string[]>>>
> = {
  annual: {
    revenue: ['Net_sales', 'Total_income'],
    profit: ['Profit_after_tax', 'Consolidated_NetProfit'],
  },
  quarter: {
    revenue: ['Net_Sales', 'Total_Income'],
    profit: ['Pat', 'Net_Profit'],
  },
};

const pick = (
  series: FundamentalsSeries,
  keys: readonly string[],
  index: number,
): number | null => {
  for (const key of keys) {
    const value = series.items[key]?.[index];
    if (value != null) return value;
  }
  return null;
};

/** Oldest first, because a time axis reads left to right. */
export function toPoints(
  series: FundamentalsSeries | undefined,
  feed: PerformanceFeed,
): PeriodPoint[] {
  if (!series) return [];
  const keys = KEYS[feed];
  return series.periods
    .map((period, i) => ({
      period,
      revenue: pick(series, keys.revenue, i),
      profit: pick(series, keys.profit, i),
    }))
    .filter(p => p.revenue != null || p.profit != null)
    .reverse();
}

/** The sum of every value, or null when any one of them was not filed. */
const sumOf = (values: readonly (number | null)[]): number | null => {
  let total = 0;
  for (const value of values) {
    if (value == null) return null;
    total += value;
  }
  return total;
};

/**
 * Trailing-twelve-month growth: the last four quarters against the four before
 * them. Computed on quarters rather than on two annual rows because that is
 * what "TTM" means — an annual comparison is a year behind for three quarters
 * out of four.
 */
export function ttmGrowth(
  points: readonly PeriodPoint[],
  measure: PerformanceMeasure,
): number | null {
  if (points.length < 8) return null;
  const values = points.map(p => p[measure]);
  const recent = sumOf(values.slice(-4));
  const prior = sumOf(values.slice(-8, -4));
  if (recent == null || prior == null) return null;
  // A base at or below zero makes a percentage change meaningless: a swing from
  // a loss to a profit is not "+140% growth".
  if (prior <= 0) return null;
  return ((recent - prior) / prior) * 100;
}

/**
 * Compound annual growth over `years`, from the newest period back. Null when
 * either end is missing or the base is not positive — a CAGR off a loss-making
 * year is not a growth rate.
 */
export function performanceCagr(
  points: readonly PeriodPoint[],
  measure: PerformanceMeasure,
  years: number,
): number | null {
  return cagr(
    points.map(p => p[measure]),
    years,
  );
}

/** Period-on-period change for the value the chart's readout is showing. */
export function changeVsPrior(
  points: readonly PeriodPoint[],
  index: number,
  measure: PerformanceMeasure,
): number | null {
  if (index <= 0) return null;
  const now = points[index]?.[measure];
  const prev = points[index - 1]?.[measure];
  if (now == null || prev == null || prev <= 0) return null;
  return ((now - prev) / prev) * 100;
}

// YYYYMM -> "Jun '26". The chart's axis says which quarter or year ended, and
// the vendor's period is always a month-end.
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function periodLabel(period: number): string {
  const s = String(period);
  if (s.length !== 6) return s;
  const month = MONTHS[Number(s.slice(4, 6)) - 1] ?? '';
  return `${month} '${s.slice(2, 4)}`;
}

/**
 * Axis ticks a reader recognises: 0, 100k, 200k … rather than 0, 87,431 …
 *
 * Both ends are rounded outward to a whole step, so the range the chart scales
 * against always contains the data. Stopping at the last step below the maximum
 * made the top bar taller than the plot: a ₹1,80,062 Cr quarter drew off a
 * 1,50,000 span and ran up over the readout above it.
 */
export function niceTicks(max: number, min: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const lo = Math.min(0, min);
  const rawStep = (max - lo) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step =
    [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= rawStep) ??
    magnitude * 10;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.001; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return ticks;
}

/** What a chart of revenue and profit is drawn against. */
export interface PerformanceScale {
  /** Gridline values, lowest first. */
  ticks: number[];
  /** The value at the plot's top edge; zero sits `top / span` of the way down. */
  top: number;
  /** Top edge less bottom edge, never zero: a bar is `|value| / span` of the plot. */
  span: number;
}

/**
 * One axis for both measures, so a sliver of profit under a tall revenue bar is
 * the true shape of a thin margin rather than an artefact of a second scale.
 */
export function performanceScale(
  points: readonly PeriodPoint[],
): PerformanceScale {
  const values = points
    .flatMap(p => [p.revenue, p.profit])
    .filter((v): v is number => v != null);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const ticks = niceTicks(max, min);
  // niceTicks only builds a scale above zero, so an all-loss or all-zero series
  // comes back as the single tick [0]. Measuring against that tick alone drew a
  // -5 Cr bar against a span of 1, far taller than the plot and through
  // everything under it — so the edges fall back to the data's own extent, and
  // a flat series keeps a real span.
  const top = Math.max(ticks.at(-1) ?? max, max);
  const bottom = Math.min(ticks[0] ?? min, min);
  return {ticks, top, span: top - bottom || 1};
}

// One decimal at most, and none when it would be a trailing zero: the ticks
// are nice numbers, so 37500 has to read "37.5k" rather than round to "38k" and
// disagree with the gridline it labels.
const short = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

// Lakh above a lakh crore, the way the figure is said in this market — a bank's
// axis topping out at "2L" rather than "200k".
export function compactCrore(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100000) return `${short(value / 100000)}L`;
  if (abs >= 1000) return `${short(value / 1000)}k`;
  return String(Math.round(value));
}
