import {istDayKey} from '../format/date.ts';
import type {TradeData} from '../types/user.ts';
import type {PriceSeriesBySymbol} from './holdingsPricing.ts';

export interface SymbolContribution {
  symbol: string;
  /** Cost basis of the quantity still held. */
  invested: number;
  /** Market value of the quantity still held. */
  current: number;
  realised: number;
  unrealised: number;
  /** realised + unrealised — how much this symbol moved your money overall. */
  pnl: number;
  openQuantity: number;
}

export interface NetWorthTotals {
  /** Market value of open holdings. This is the net worth number. */
  current: number;
  /** Cost basis of open holdings. */
  invested: number;
  unrealised: number;
  realised: number;
  /** unrealised / invested, as a percentage. */
  returnPct: number;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface NetWorthSeries {
  /** Market value of everything held on each date, including positions later sold. */
  value: SeriesPoint[];
  /** Cost basis of everything held on each date. */
  invested: SeriesPoint[];
}

export interface CashFlow {
  /** Epoch milliseconds. */
  time: number;
  /** Negative when money went in, positive when it came back out. */
  amount: number;
}

/** IST calendar day of a timestamp.
 *
 *  This used to slice a UTC ISO string, on the reasoning that Indian market
 *  hours never straddle UTC midnight so the two boundaries agree. That holds
 *  for price bars — and every bar call site below is unaffected by this change
 *  — but the function is also given trade.buy_time / sell_time, which are
 *  instants that can land at any hour. An after-market or AMO fill stamped
 *  between 00:00 and 05:29 IST is before UTC midnight, so it filed under the
 *  previous day and moved when a holding entered or left the value curve.
 *  drift resolved 2026-09-13: mobile still sliced the UTC string; web won. */
export const dayKey = (
  input: string | number | Date | null | undefined,
): string => {
  if (input === null || input === undefined) return '';
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? '' : istDayKey(d);
};

/** Latest close per symbol, used to mark open positions to market. */
export function latestCloseBySymbol(
  series: PriceSeriesBySymbol | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!series) return out;

  for (const [symbol, points] of Object.entries(series)) {
    let bestTime = -Infinity;
    let bestClose: number | undefined;
    for (const point of points ?? []) {
      const t = new Date(point.time).getTime();
      if (!Number.isNaN(t) && t > bestTime && Number.isFinite(point.close)) {
        bestTime = t;
        bestClose = point.close;
      }
    }
    if (bestClose !== undefined) out[symbol] = bestClose;
  }
  return out;
}

const buyValue = (trade: TradeData): number =>
  (trade.quantity || 0) * (trade.buy_price ?? 0);

/**
 * Per-symbol profit attribution. Deliberately reports *contribution* in rupees
 * rather than portfolio weight: weight says what you own, contribution says
 * what actually happened to your money, and only the second one explains the
 * number at the top of the page.
 */
export function contributionBySymbol(
  trades: TradeData[] | undefined,
  latest: Record<string, number>,
): SymbolContribution[] {
  const bySymbol = new Map<string, SymbolContribution>();
  if (!trades) return [];

  for (const trade of trades) {
    const quantity = trade.quantity || 0;
    const buyPrice = trade.buy_price ?? 0;
    if (!quantity || !buyPrice) continue;

    const symbol = trade.stock_symbol;
    const entry = bySymbol.get(symbol) ?? {
      symbol,
      invested: 0,
      current: 0,
      realised: 0,
      unrealised: 0,
      pnl: 0,
      openQuantity: 0,
    };

    if (trade.sell_price !== null && trade.sell_price !== undefined) {
      entry.realised += quantity * (trade.sell_price - buyPrice);
    } else {
      // No price history for a symbol (F&O legs, freshly listed names) means we
      // carry it at cost rather than inventing a mark.
      const mark = latest[symbol] ?? buyPrice;
      entry.invested += quantity * buyPrice;
      entry.current += quantity * mark;
      entry.unrealised += quantity * (mark - buyPrice);
      entry.openQuantity += quantity;
    }

    entry.pnl = entry.realised + entry.unrealised;
    bySymbol.set(symbol, entry);
  }

  return [...bySymbol.values()].sort((a, b) => b.pnl - a.pnl);
}

export function totalsFrom(
  contributions: SymbolContribution[],
): NetWorthTotals {
  const totals = contributions.reduce(
    (acc, c) => ({
      current: acc.current + c.current,
      invested: acc.invested + c.invested,
      unrealised: acc.unrealised + c.unrealised,
      realised: acc.realised + c.realised,
    }),
    {current: 0, invested: 0, unrealised: 0, realised: 0},
  );

  return {
    ...totals,
    returnPct:
      totals.invested > 0 ? (totals.unrealised / totals.invested) * 100 : 0,
  };
}

/**
 * Every cash movement the portfolio has seen: money out on each buy, money back
 * on each sell, plus today's market value as the closing flow.
 */
export function buildCashFlows(
  trades: TradeData[] | undefined,
  latest: Record<string, number>,
  now: number,
): CashFlow[] {
  const flows: CashFlow[] = [];
  if (!trades) return flows;

  let openValue = 0;

  for (const trade of trades) {
    const quantity = trade.quantity || 0;
    const buyPrice = trade.buy_price ?? 0;
    if (!quantity || !buyPrice) continue;

    const boughtAt = new Date(trade.buy_time ?? trade.timestamp).getTime();
    if (Number.isNaN(boughtAt)) continue;
    flows.push({time: boughtAt, amount: -buyValue(trade)});

    if (trade.sell_price !== null && trade.sell_price !== undefined) {
      const soldAt = new Date(trade.sell_time ?? trade.timestamp).getTime();
      flows.push({
        time: Number.isNaN(soldAt) ? now : soldAt,
        amount: quantity * trade.sell_price,
      });
    } else {
      openValue += quantity * (latest[trade.stock_symbol] ?? buyPrice);
    }
  }

  if (openValue > 0) flows.push({time: now, amount: openValue});
  return flows.sort((a, b) => a.time - b.time);
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const npv = (flows: CashFlow[], rate: number, start: number): number =>
  flows.reduce(
    (sum, f) => sum + f.amount / Math.pow(1 + rate, (f.time - start) / YEAR_MS),
    0,
  );

/**
 * Annualised money-weighted return (XIRR), as a percentage.
 *
 * The headline "you're up 9.58%" is an absolute figure that silently assumes
 * every rupee was invested for the same length of time. It never is — someone
 * who averaged down over a year has a very different real return. Solved by
 * bisection rather than Newton-Raphson: slower, but it cannot diverge on the
 * lumpy, sign-flipping flows a real trading history produces.
 */
export function xirr(flows: CashFlow[]): number | null {
  const first = flows[0];
  const last = flows[flows.length - 1];
  if (flows.length < 2 || !first || !last) return null;
  if (!flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0))
    return null;

  const start = first.time;
  if (last.time - start < 24 * 60 * 60 * 1000) return null;

  let low = -0.9999;
  let high = 10;
  let lowValue = npv(flows, low, start);
  let highValue = npv(flows, high, start);
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue)) return null;
  if (lowValue * highValue > 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    const midValue = npv(flows, mid, start);
    if (!Number.isFinite(midValue)) return null;
    if (Math.abs(midValue) < 1e-7) return mid * 100;
    if (lowValue * midValue < 0) {
      high = mid;
      highValue = midValue;
    } else {
      low = mid;
      lowValue = midValue;
    }
  }

  return ((low + high) / 2) * 100;
}

/** Forward-filled close for every symbol across a shared date axis, so a
 *  symbol that didn't trade on some date holds its last known price instead of
 *  dropping the whole portfolio's value for that day. */
function alignCloses(
  series: PriceSeriesBySymbol,
  dates: string[],
): Record<string, (number | undefined)[]> {
  const aligned: Record<string, (number | undefined)[]> = {};

  for (const [symbol, points] of Object.entries(series)) {
    const closeByDate = new Map<string, number>();
    for (const point of points ?? []) {
      const key = dayKey(point.time);
      if (key && Number.isFinite(point.close))
        closeByDate.set(key, point.close);
    }

    const filled: (number | undefined)[] = new Array<number | undefined>(
      dates.length,
    );
    let carried: number | undefined;
    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      carried =
        (date === undefined ? undefined : closeByDate.get(date)) ?? carried;
      filled[i] = carried;
    }
    aligned[symbol] = filled;
  }

  return aligned;
}

/**
 * Portfolio value on every date in the price window, including positions that
 * were later sold.
 *
 * This is the part most trackers get wrong: charting only what you *currently*
 * hold means every sale quietly rewrites your past, so the curve you look at is
 * not the one you lived through. Holding is decided per date from buy/sell
 * timestamps, so a position that existed in March still shows up in March.
 */
export function portfolioSeries(
  trades: TradeData[] | undefined,
  series: PriceSeriesBySymbol | undefined,
): NetWorthSeries {
  if (!trades?.length || !series) return {value: [], invested: []};

  const dateSet = new Set<string>();
  for (const points of Object.values(series)) {
    for (const point of points ?? []) {
      const key = dayKey(point.time);
      if (key) dateSet.add(key);
    }
  }

  const dates = [...dateSet].sort();
  if (!dates.length) return {value: [], invested: []};

  const aligned = alignCloses(series, dates);

  const holdings = trades
    .map(trade => ({
      symbol: trade.stock_symbol,
      quantity: trade.quantity || 0,
      buyPrice: trade.buy_price ?? 0,
      from: dayKey(trade.buy_time ?? trade.timestamp),
      until:
        trade.sell_price !== null && trade.sell_price !== undefined
          ? dayKey(trade.sell_time ?? trade.timestamp)
          : null,
    }))
    .filter(h => h.quantity > 0 && h.buyPrice > 0 && h.from);

  const value: SeriesPoint[] = [];
  const invested: SeriesPoint[] = [];

  dates.forEach((date, i) => {
    let dayValue = 0;
    let dayInvested = 0;

    for (const holding of holdings) {
      if (holding.from > date) continue;
      if (holding.until && holding.until <= date) continue;
      const mark = aligned[holding.symbol]?.[i] ?? holding.buyPrice;
      dayValue += holding.quantity * mark;
      dayInvested += holding.quantity * holding.buyPrice;
    }

    value.push({date, value: dayValue});
    invested.push({date, value: dayInvested});
  });

  return {value, invested};
}

const NAV_BASE = 1000;

/**
 * Portfolio value restated as a unit NAV, the way a fund quotes one.
 *
 * Plotting raw value against an index is the mistake that makes every tracker
 * flatter itself: adding ₹50,000 lifts the curve without a single stock having
 * moved. Here new capital mints units at the prevailing NAV and withdrawals
 * redeem them, so the line reflects only what the holdings did — which is the
 * one thing that can honestly be compared to NIFTY. Same mechanism a broker's
 * performance curve uses.
 */
export function unitisedNavSeries(
  value: SeriesPoint[],
  invested: SeriesPoint[],
): SeriesPoint[] {
  const start = value.findIndex(p => p.value > 0);
  const first = value[start];
  if (start === -1 || !first) return [];

  let units = first.value / NAV_BASE;
  let lastNav = NAV_BASE;
  const out: SeriesPoint[] = [{date: first.date, value: NAV_BASE}];

  for (let i = start + 1; i < value.length; i++) {
    const point = value[i];
    if (!point) continue;
    const marketValue = point.value;

    // Flat out of the market — the fund is fully redeemed, so its units go with
    // it. Carrying them across the gap would dilute the NAV the moment the
    // account buys back in and drop a cliff into the curve that no holding ever
    // caused. This is what made the line look like a staircase.
    if (marketValue <= 0) {
      units = 0;
      out.push({date: point.date, value: lastNav});
      continue;
    }

    // Re-entering after such a gap: mint units at the carried NAV so the line
    // resumes from where it paused instead of stepping.
    if (units <= 0) {
      units = marketValue / lastNav;
      out.push({date: point.date, value: lastNav});
      continue;
    }

    // Change in cost basis is net capital deployed: buying adds it, selling
    // releases it. Price moves never touch it, which is what makes it usable
    // as the flow term.
    const flow = (invested[i]?.value ?? 0) - (invested[i - 1]?.value ?? 0);
    const preFlowValue = marketValue - flow;
    const navBefore = preFlowValue > 0 ? preFlowValue / units : lastNav;
    if (flow !== 0 && navBefore > 0) units += flow / navBefore;

    const nav = units > 0 ? marketValue / units : lastNav;
    if (Number.isFinite(nav) && nav > 0) lastNav = nav;
    out.push({date: point.date, value: lastNav});
  }

  return out;
}

/** Rebase a series to percentage change from its first non-zero point, so a
 *  portfolio worth lakhs and an index at 24,000 can share one axis. */
export function toPercentSeries(points: SeriesPoint[]): SeriesPoint[] {
  const firstIndex = points.findIndex(p => p.value > 0);
  const first = points[firstIndex];
  if (firstIndex === -1 || !first) return [];
  const base = first.value;
  return points
    .slice(firstIndex)
    .map(p => ({date: p.date, value: (p.value / base - 1) * 100}));
}

/** A symbol's closes on the shared date axis, as a plain series. */
export function symbolSeries(
  series: PriceSeriesBySymbol | undefined,
  symbol: string,
): SeriesPoint[] {
  const points = series?.[symbol];
  if (!points?.length) return [];

  const byDate = new Map<string, number>();
  for (const point of points) {
    const key = dayKey(point.time);
    if (key && Number.isFinite(point.close)) byDate.set(key, point.close);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, value]) => ({date, value}));
}

/** Restrict a benchmark series to the dates the portfolio series covers, so
 *  both curves start from the same day before either is rebased. */
export function clipToRange(
  points: SeriesPoint[],
  from: string,
  to: string,
): SeriesPoint[] {
  return points.filter(p => p.date >= from && p.date <= to);
}
