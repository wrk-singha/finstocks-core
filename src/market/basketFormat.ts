import {
  formatCurrency,
  formatShortDateIST,
  signedPct,
} from '../format/index.ts';
import type {
  EsfBacktestMetrics,
  EsfBacktestRun,
  EsfBasketBase,
  EsfMember,
  EsfMode,
  EsfNavPoint,
  EsfOrderStatus,
  EsfRebalance,
  EsfSubscription,
} from '../types/esf.ts';
import {yearsBetween} from './basketBacktest.ts';
import {MARKET_LABELS} from './esfScore.ts';

/**
 * How a rule-based basket reads on a card and its page, as the web words it
 * (frontend dev 2226a1e1, `components/pages/markets/baskets/basketFormat.ts`). Copy lives here so
 * the two clients name a cadence, a review day and a minimum the same way.
 */

export const BENCHMARK_LABEL = 'NIFTY 500';

export const stockCountLabel = (count: number, slots: number): string =>
  count < slots
    ? `${String(count)} of ${String(slots)} · rest in cash`
    : `${String(count)} · equal weight`;

const CADENCES: Record<
  string,
  {label: string; period: string; periods: string; day?: string}
> = {
  weekly: {label: 'Weekly', period: 'week', periods: 'weeks'},
  monthly: {label: 'Monthly', period: 'month', periods: 'months'},
  quarterly: {label: 'Quarterly', period: 'quarter', periods: 'quarters'},
  'first-monday': {
    label: 'Monthly',
    period: 'month',
    periods: 'months',
    day: 'the first Monday of the month',
  },
  'results-quarterly': {
    label: 'Quarterly',
    period: 'quarter',
    periods: 'quarters',
    day: 'the last trading day of February, May, August and November',
  },
};

export const cadenceLabel = (rebalance: string): string =>
  CADENCES[rebalance]?.label ?? rebalance;

// Web names these `periodsLabel` / `periodLabel`; core already exports a `periodLabel` for a
// filed statement's period (fundamentals), so the basket pair carries its noun.

export const reviewPeriodsLabel = (rebalance: string): string =>
  CADENCES[rebalance]?.periods ?? 'reviews';

export const reviewPeriodLabel = (rebalance: string): string =>
  CADENCES[rebalance]?.period ?? 'review';

/** Against the benchmark's own volatility: up to it is low, up to 1.4× medium, beyond high. */
export const volatilityLabel = (
  basketVol: number,
  benchmarkVol: number,
): string => {
  const ratio = basketVol / benchmarkVol;
  if (ratio <= 1) return 'Low';
  if (ratio <= 1.4) return 'Medium';
  return 'High';
};

export const reviewDayLabel = (rebalance: string): string => {
  const cadence = CADENCES[rebalance];
  if (!cadence) return 'each review day';
  return cadence.day ?? `the last trading day of the ${cadence.period}`;
};

export const DEFAULT_CAPITAL = 500000;

/** The arithmetic behind a basket's minimum, from the numbers the backend used to set it. */
export const minAmountHint = ({
  size,
  min_capital_basis: basis,
}: Pick<EsfBasketBase, 'size' | 'min_capital_basis'>): string => {
  const rule = `Enough for an equal split to buy at least one share of all ${String(size)} stocks.`;
  if (!basis) return rule;
  const need = size * basis.price * (1 + basis.margin);
  const sum = `${String(size)} × ${formatCurrency(basis.price)} (${basis.symbol}, the dearest share) + ${String(Math.round(basis.margin * 100))}% for price moves = ${formatCurrency(need, 0)}`;
  if (need <= basis.floor) {
    return `${rule} ${sum}, so this basket's floor of ${formatCurrency(basis.floor, 0)} applies.`;
  }
  return `${rule} ${sum}, rounded up to the next ${formatCurrency(basis.step, 0)}.`;
};

export const MODE_LABEL: Record<EsfMode, string> = {
  mock: 'Paper money',
  live: 'Real money',
};

export const awaitingFirstOrders = (sub: EsfSubscription): boolean =>
  sub.positions.length === 0 && sub.status === 'active';

/** One line on where an investment stands: when it starts, how it is doing, or that it is paused. */
export const subscriptionStatusLabel = (sub: EsfSubscription): string => {
  if (sub.status !== 'active') return `${MODE_LABEL[sub.mode]} · paused`;
  if (awaitingFirstOrders(sub)) {
    return `${MODE_LABEL[sub.mode]} · first orders ${formatShortDateIST(sub.next_orders_on)}`;
  }
  return `${MODE_LABEL[sub.mode]} · ${signedPct(sub.pnl_pct)}`;
};

export const weightLabel = (weight: number): string =>
  `${(weight * 100).toFixed(0)}%`;

export type EsfOrderTone = 'ok' | 'wait' | 'alert' | 'muted';

/** What each order status says to the investor, and how urgently. */
export const ORDER_STATUS: Record<
  EsfOrderStatus,
  {text: string; tone: EsfOrderTone}
> = {
  filled: {text: 'Filled', tone: 'ok'},
  submitted: {text: 'Sent to broker', tone: 'ok'},
  pending: {text: 'Placing', tone: 'wait'},
  unknown: {text: 'Confirming with your broker — not resent', tone: 'alert'},
  failed: {text: 'Refused — retries next session', tone: 'wait'},
  skipped_no_session: {text: 'Waiting for your broker login', tone: 'wait'},
  skipped_no_price: {
    text: 'No price yet — retries next session',
    tone: 'wait',
  },
  skipped_no_cash: {
    text: 'Waiting for sale proceeds — retries next session',
    tone: 'wait',
  },
  skipped_zero_qty: {
    text: 'Skipped — one share costs more than its slice',
    tone: 'muted',
  },
};

/** Change from the first point to the last, as a percentage. */
export const navChange = (
  first: number | null | undefined,
  last: number | null | undefined,
): number | null => (first && last != null ? (last / first - 1) * 100 : null);

export const primaryBacktest = (
  runs: EsfBacktestRun[],
): EsfBacktestRun | undefined => runs.find(r => r.is_primary);

export interface BasketHeadline {
  value: number | null;
  benchmark: number | null;
  caption: string;
  short: string;
}

const LIVE_HEADLINE_YEARS = 1;

/**
 * The number a basket leads with: its live record once that is a year long, else the primary
 * backtest's annual return. Null with neither.
 */
export function basketHeadline(
  launch: EsfNavPoint | null | undefined,
  latest: EsfNavPoint | null | undefined,
  primary: EsfBacktestRun | null | undefined,
): BasketHeadline | null {
  if (
    launch &&
    latest &&
    yearsBetween(launch.trade_date, latest.trade_date) >= LIVE_HEADLINE_YEARS
  ) {
    return {
      value: navChange(launch.nav, latest.nav),
      benchmark: navChange(launch.benchmark, latest.benchmark),
      caption: `since ${formatShortDateIST(launch.trade_date)}`,
      short: `Since ${formatShortDateIST(launch.trade_date)}`,
    };
  }
  if (!primary) return null;
  // The backend stores metrics as JSON and does not coalesce it: a run written before its metrics
  // landed reads as "—" rather than throwing on the card.
  const metrics = primary.metrics as Partial<EsfBacktestMetrics> | null;
  return {
    value: metrics?.strategy_net?.['cagr_%'] ?? null,
    benchmark: metrics?.nifty500?.['cagr_%'] ?? null,
    caption: `a year · backtest since ${formatShortDateIST(primary.window_start)}`,
    short: 'A year · backtest',
  };
}

export interface NavSummary {
  since: string;
  asOf: string;
  basket: number | null;
  benchmark: number | null;
  days: number;
}

export const navSummary = (nav: EsfNavPoint[]): NavSummary | null => {
  const first = nav[0];
  const last = nav[nav.length - 1];
  if (first === undefined || last === undefined) return null;
  const benchmarked = nav.filter(p => p.benchmark != null);
  return {
    since: first.trade_date,
    asOf: last.trade_date,
    basket: navChange(first.nav, last.nav),
    benchmark: navChange(
      benchmarked[0]?.benchmark,
      benchmarked[benchmarked.length - 1]?.benchmark,
    ),
    days: nav.length - 1,
  };
};

/** The day the first review's stocks were bought, which is where the live record begins. */
export const trackingStart = (history: EsfRebalance[]): string | null =>
  history.reduce<string | null>(
    (earliest, r) =>
      earliest && earliest <= r.effective_on ? earliest : r.effective_on,
    null,
  );

export const marketLabel = (label: string | null | undefined): string | null =>
  label ? (MARKET_LABELS[label] ?? label) : null;

export interface BasketBuyLine {
  member: EsfMember;
  price: number | null;
  shares: number;
  amount: number;
}

export interface BasketBuyPlan {
  /** Capital per place, before rounding to whole shares. */
  slot: number;
  lines: BasketBuyLine[];
  invested: number;
  cash: number;
  /** The capital at which the dearest stock's slice buys at least one share. */
  buysEveryStockFrom: number;
}

/**
 * The model portfolio at a capital: each place gets an equal slice, and buys as many whole shares
 * as the slice covers at the live price, or at the review's close when there is none yet.
 */
export const planBasketBuy = (
  members: EsfMember[],
  prices: Record<string, number | null>,
  capital: number,
  slots: number,
): BasketBuyPlan => {
  const slot = capital / slots;
  const lines: BasketBuyLine[] = members.map(member => {
    const price = prices[member.symbol] ?? member.ref_close;
    const shares = price ? Math.floor(slot / price) : 0;
    return {member, price, shares, amount: shares * (price ?? 0)};
  });
  const invested = lines.reduce((sum, l) => sum + l.amount, 0);
  const dearest = Math.max(0, ...lines.map(l => l.price ?? 0));
  return {
    slot,
    lines,
    invested,
    cash: capital - invested,
    buysEveryStockFrom: Math.ceil(dearest * slots),
  };
};
