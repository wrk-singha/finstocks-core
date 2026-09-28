import type {IPODetail, IPORow} from '../api/market.ts';
import type {
  FinancialPeriodRow,
  FundamentalsDirector,
} from '../types/fundamentals.ts';
import {
  addMarketDays,
  isTradingDay,
  marketDateString,
  marketToday,
} from './marketHours.ts';

/**
 * What an IPO board and an issue's page work out from the vendor's rows.
 *
 * None of it is fetched: SEBI fixes the category ceilings, the T+3 timeline dates everything after
 * the book closes, and the rest falls out of the issue's own lot size and price band, both of which
 * the list row already carries. Labels are left to the apps; this returns keys.
 */

export type IPOCategory = 'regular' | 'hni';

/** The two categories an individual applies in, in the order a form lists them. */
export const IPO_CATEGORIES: readonly IPOCategory[] = ['regular', 'hni'];

/**
 * The per-PAN application ceilings a FinStocks form accepts.
 *
 * ₹2L is SEBI's retail boundary, and the S-NII bucket does begin immediately above it — but it runs
 * to ₹10L, not ₹5L. ₹5L is the UPI mandate limit: the most a single ASBA-over-UPI block can carry,
 * which is the rail every retail and small-HNI application on a platform like this one goes
 * through. Above it an applicant needs bank ASBA, which FinStocks has no path to, so the number is
 * the ceiling of what can actually be submitted rather than the top of the regulatory band.
 */
export const IPO_CATEGORY_CAPS: Readonly<
  Record<IPOCategory, {readonly min: number; readonly max: number}>
> = {
  regular: {min: 0, max: 200_000},
  hni: {min: 200_000, max: 500_000},
};

/**
 * Shares per lot.
 *
 * NOT `market_lot`, which the vendor sets to 1 on every row in the table. The real figure rides in
 * `min_application` — which the API in turn exposes under the name `min_investment`, as though it
 * were a rupee amount. It isn't: across the 16 issues with a published band,
 * `min_application x band floor` lands between Rs 13,910 and Rs 14,245 on fifteen of them, which is
 * SEBI's minimum application value window. A count of shares, priced at the floor.
 *
 * Both spellings are read so that a row where the vendor eventually populates `market_lot`
 * properly still resolves, and neither is trusted at 1.
 */
export const ipoLotSize = (ipo: {
  readonly market_lot?: number | null | undefined;
  readonly min_investment?: number | null | undefined;
}): number | undefined =>
  [ipo.min_investment, ipo.market_lot].find(
    (value): value is number => value != null && value > 1,
  );

/**
 * What one lot costs at the floor of the band — the "minimum investment" every IPO page leads
 * with, and the number the vendor does not store.
 */
export const ipoMinInvestment = (lotSize: number, priceMin: number): number =>
  lotSize * priceMin;

/** An issue can only be bid on if we know the lot size and the top of the band. */
export const isBiddable = (
  lotSize?: number | null,
  priceMax?: number | null,
): boolean =>
  lotSize != null && lotSize > 0 && priceMax != null && priceMax > 0;

/**
 * The issue in crore, or null when it cannot be priced.
 *
 * `issue_size` is a share count, not a rupee figure: it is a whole number on every row, and pricing
 * it lands the issue between ₹23 Cr and ₹1,063 Cr across the table, where reading it as rupees
 * would claim ₹0.25-12.7 Cr for issues that size. Priced at the band's top while the book is open,
 * or at the struck price once a closed issue no longer carries a band.
 */
export const ipoIssueSizeCrore = (
  ipo: Pick<IPODetail, 'issue_size' | 'price_max' | 'issue_price'>,
): number | null => {
  const price =
    ipo.price_max != null && ipo.price_max > 0
      ? ipo.price_max
      : ipo.issue_price;
  return ipo.issue_size != null &&
    ipo.issue_size > 0 &&
    price != null &&
    price > 0
    ? (ipo.issue_size * price) / 1e7
    : null;
};

export type IPOScheduleStepKey =
  'open' | 'close' | 'allotment' | 'unblock' | 'listing';

export type IPOStepState = 'done' | 'current' | 'future';

export interface IPOScheduleStep {
  key: IPOScheduleStepKey;
  /** YYYY-MM-DD, an IST calendar day. */
  date: string;
  state: IPOStepState;
  /**
   * Computed from the close date rather than published by the vendor. The UI marks these, because
   * a date we worked out is not a date we were told. On `listing` it is also what makes the date
   * tentative rather than published.
   */
  derived: boolean;
}

/** Walks forward `count` sessions, skipping weekends and exchange holidays. */
const addTradingDays = (from: Date, count: number): Date => {
  let day = from;
  for (let moved = 0; moved < count;) {
    day = addMarketDays(day, 1);
    if (isTradingDay(day)) moved += 1;
  }
  return day;
};

/**
 * The five-step issue timeline.
 *
 * Only the first two steps are facts: the vendor publishes `open_date` and `close_date` and nothing
 * else. `list_date` is filled in on 20 of 29 *closed* issues and on none of the open or upcoming
 * ones, which is precisely backwards from where a listing date is worth knowing, and
 * `dp_clear_date` is empty on every row in the table.
 *
 * So allotment, unblock and listing are derived from SEBI's T+3 timeline — allotment and unblock
 * one session after the book closes, listing three — and flagged `derived` so the screen can say
 * which is which. A published `list_date` always wins over the computed one.
 */
export const buildIPOSchedule = (
  ipo: Pick<IPORow, 'open_date' | 'close_date' | 'list_date'>,
  now: Date = new Date(),
): IPOScheduleStep[] => {
  if (!ipo.open_date || !ipo.close_date) return [];

  const close = new Date(`${ipo.close_date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(close.getTime())) return [];

  const allotment = marketDateString(addTradingDays(close, 1));
  const published = ipo.list_date ? ipo.list_date.slice(0, 10) : null;

  const steps: Omit<IPOScheduleStep, 'state'>[] = [
    {key: 'open', date: ipo.open_date.slice(0, 10), derived: false},
    {key: 'close', date: ipo.close_date.slice(0, 10), derived: false},
    {key: 'allotment', date: allotment, derived: true},
    {key: 'unblock', date: allotment, derived: true},
    {
      key: 'listing',
      date: published ?? marketDateString(addTradingDays(close, 3)),
      derived: published === null,
    },
  ];

  // The first step not yet behind us is the one in progress; everything before it has happened
  // and everything after has not.
  const today = marketDateString(marketToday(now));
  const currentIndex = steps.findIndex(step => step.date >= today);

  return steps.map((step, index) => ({
    ...step,
    state:
      currentIndex === -1 || index < currentIndex
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'future',
  }));
};

/** The annual figures an issue's financials chart can plot, in the order it offers them. */
export const FINANCIAL_METRIC_KEYS = [
  'net_sales',
  'total_assets',
  'profit_after_tax',
] as const;

export type FinancialMetric = (typeof FINANCIAL_METRIC_KEYS)[number];

export interface FinancialBar {
  /** The fiscal year the period ends in — the vendor's YYYYMM, read as a year. */
  year: number;
  value: number;
}

/**
 * One metric's last few years, oldest first.
 *
 * `annual_periods` arrives already scaled to crore by the fundamentals endpoint, so nothing is
 * converted here. Standalone and consolidated rows can both be present for a year; consolidated
 * wins where it exists, because that is the basis the prospectus leads with.
 */
export const buildFinancialSeries = (
  periods: readonly FinancialPeriodRow[] | null | undefined,
  metric: FinancialMetric,
  years = 3,
): FinancialBar[] => {
  if (!periods?.length) return [];

  const byYear = new Map<number, FinancialPeriodRow>();
  for (const period of periods) {
    const year = Math.floor(period.period_end / 100);
    const held = byYear.get(year);
    if (!held || (period.consolidated && !held.consolidated))
      byYear.set(year, period);
  }

  return [...byYear.entries()]
    .flatMap(([year, period]) => {
      // Typed as always present; a period the vendor filed without its metric group arrives bare.
      const value = period.metrics?.[metric];
      return typeof value === 'number' && value !== 0 ? [{year, value}] : [];
    })
    .sort((a, b) => a.year - b.year)
    .slice(-years);
};

const designationOf = (director: FundamentalsDirector): string => {
  const raw = director.designation;
  return (typeof raw === 'string' ? raw : (raw?.Value ?? '')).toLowerCase();
};

const LEAD_TITLES = [
  'managing director',
  'chief executive',
  'ceo',
  'chairman',
] as const;

/** The vendor's `directors` list, reduced to the one name a profile block shows. */
export const findManagingDirector = (
  directors: readonly FundamentalsDirector[] | null | undefined,
): string | null => {
  for (const wanted of LEAD_TITLES) {
    const hit = directors?.find(director =>
      designationOf(director).includes(wanted),
    );
    const name = hit?.name?.trim();
    if (name) return name;
  }
  return null;
};
