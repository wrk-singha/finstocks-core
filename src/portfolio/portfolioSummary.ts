import {istDayKey} from '../format/date.ts';
import {isAwaitingStart, isInProgress} from '../strategy/strategyStatus.ts';
import type {BudgetConfig} from '../types/trade.ts';
import type {TradeData} from '../types/user.ts';
import {
  calculatePNL,
  getTradeEntryPrice,
  isFnOStrategy,
  isFnOTrade,
  matchesSegment,
  type PortfolioSegment,
} from './portfolio.ts';

// A holding row priced for "today" — the subset of `HoldingRow` (types/user)
// that drives the day and marked totals below. Structural, so the web's full
// HoldingRow and mobile's leaner row both satisfy it.
export interface DayPricedRow {
  current: number;
  invested: number;
  pnl: number | null;
  oneDayChange: number;
  shares: number;
  hasDayChange: boolean;
  hasSoldTrades: boolean;
  hasLivePrice: boolean;
}

// TODO(core-types): unify with types/trade (Strategy, useTradeStatusResponse)
export interface InvestableStrategy {
  status?: string | null;
  is_mock?: boolean;
  is_fno?: boolean;
  is_backtest?: boolean;
  symbol?: string;
  stock_symbol?: string;
  budget_config?: BudgetConfig | null;
}

// TODO(core-types): unify with types/trade (useTradeStatusResponse)
export interface AutopilotStatus {
  is_mock?: boolean;
  investment_amount?: number;
  strategies?: InvestableStrategy[] | null;
}

// Only strategies actually running (or paused mid-run) tie up capital.
// PENDING/WAITING ones never placed a trade and ARCHIVED/COMPLETED ones no
// longer hold one, so neither counts — without that gate every budget the user
// ever configured accumulates into one nonsense total.
// TODO(core-strategy): replace with `isInProgress(s) && !isAwaitingStart(s)`
// from ../strategy once the status helpers are extracted there.
/** Running, paused or backtesting: the strategy's allocation is committed, not free cash. */
const tiesUpCapital = (s: InvestableStrategy): boolean =>
  isInProgress(s) && !isAwaitingStart(s);

export interface InvestedValue {
  totalInvested: number;
  strategyInvested: number;
  autopilotInvested: number;
  /** Open-book cost basis of the segment's trades, at the honest entry price. */
  costBasis: number;
}

/**
 * Invested capital for one asset-class segment. Strategy budgets count only in
 * AMOUNT mode (QTY `val` is a share count, not rupees, and PERCENT/RISK_PERCENT
 * `val` is a ratio against `total`), and only when the row says AMOUNT: a
 * budget naming no mode - a script strategy's - does not count, as on the web;
 * autopilot funds equity only.
 *
 * drift resolved 2026-09-13: web took `(strategies, tradeStatus: any, mode: 'mock' | 'live', …)`
 * and unwrapped a legacy `tradeStatus[0]` array shape; mobile took a typed status object and
 * `isMock: boolean`. Mobile won — same arithmetic, typed input, and the array shape has no
 * caller left. Web's PortfolioPage passes `isMockEnabled` instead of `isMockEnabled ? 'mock' : 'live'`.
 */
export function calculateInvestedValue(
  strategies: InvestableStrategy[] | null | undefined,
  tradeStatus: AutopilotStatus | null | undefined,
  isMock: boolean,
  segment: PortfolioSegment,
  trades: TradeData[] = [],
): InvestedValue {
  const isEquity = segment === 'equity';

  const strategyInvested = (strategies ?? [])
    .filter(
      s =>
        s.is_mock === isMock &&
        matchesSegment(segment, isFnOStrategy(s)) &&
        tiesUpCapital(s) &&
        s.is_backtest !== true,
    )
    .reduce(
      (sum, s) =>
        s.budget_config?.mode === 'AMOUNT'
          ? sum + (s.budget_config.val ?? 0)
          : sum,
      0,
    );

  let autopilotInvested = 0;
  if (
    isEquity &&
    tradeStatus?.is_mock === isMock &&
    tradeStatus.investment_amount !== undefined
  ) {
    autopilotInvested = tradeStatus.investment_amount || 0;
  }

  // getTradeEntryPrice, not raw buy_price: a manual F&O order is written with
  // the underlying's level in buy_price, which marks a ₹54 leg at ₹24,132.
  const costBasis = trades
    .filter(t => {
      const segmentMatch = matchesSegment(segment, isFnOTrade(t));
      const modeMatch = isMock
        ? t.status === 'SIMULATION'
        : t.status === 'LIVE';
      return (
        segmentMatch &&
        modeMatch &&
        (t.sell_price === null ||
          t.sell_price === undefined ||
          t.sell_price === 0)
      );
    })
    .reduce((sum, t) => sum + getTradeEntryPrice(t) * (t.quantity || 0), 0);

  return {
    totalInvested: strategyInvested + autopilotInvested,
    strategyInvested,
    autopilotInvested,
    costBasis,
  };
}

export interface PortfolioMetrics extends Omit<InvestedValue, 'totalInvested'> {
  invested: number;
  current: number;
  /** Realised P&L of the segment's closed trades. */
  pnl: number;
}

// Canonical portfolio summary for one segment: invested (strategy budgets +
// autopilot amount), realised P&L from closed trades, and current value. The
// single source of truth for both the Portfolio page and the market PortfolioPill.
export function computePortfolioMetrics(
  trades: TradeData[],
  tradeStatus: AutopilotStatus | InvestableStrategy[] | null | undefined,
  isMock: boolean,
  segment: PortfolioSegment,
): PortfolioMetrics {
  const strategies = Array.isArray(tradeStatus)
    ? tradeStatus
    : (tradeStatus?.strategies ?? []);
  const status = Array.isArray(tradeStatus) ? undefined : tradeStatus;
  const segTrades = trades.filter(t => matchesSegment(segment, isFnOTrade(t)));

  const {totalInvested, strategyInvested, autopilotInvested, costBasis} =
    calculateInvestedValue(strategies, status, isMock, segment, segTrades);

  const pnl = segTrades
    .filter(t => t.sell_price !== null || t.sell_time != null)
    .reduce((sum, t) => sum + (calculatePNL(t) ?? 0), 0);

  let current = totalInvested + pnl;
  if (Number.isNaN(current)) current = totalInvested;

  return {
    invested: totalInvested,
    current,
    pnl,
    strategyInvested,
    autopilotInvested,
    costBasis,
  };
}

// `computeSummaryMetrics` is deliberately not carried over (drift resolved
// 2026-09-13: mobile deleted it, web still had it; mobile won). Its `current`
// added an UNFILTERED lifetime P&L — every closed trade, both segments, both
// mock and live — onto a segment-scoped open-book cost basis, so the widget
// reported a since-inception gain stacked on today's deployed capital
// (₹1.19Cr / +898% on a ₹12.0L book, against the card's ₹16.2L / -0.95%).
// Everything on screen values the book through `computeMarkedTotals` over
// priced holding rows, which is the only figure that agrees with the holdings
// list. Anything needing the cost basis alone calls `calculateInvestedValue`.

/**
 * Today's realised P&L: closed lots whose exit landed on the current IST
 * calendar day.
 *
 * The day boundary is IST, not the device's. A viewer in London at 20:00 GMT
 * is already into the next Indian session, and a local-midnight `isSameDay`
 * would file that evening's exits under yesterday. `istDayKey` is the
 * convention the rest of the product compares trading days by.
 *
 * Returns 0, never null, when nothing closed today: a person who exited
 * nothing (or exited flat) has a real answer of zero, and it is not the
 * unpriced-book case that `computeDayUnrealized` guards against.
 */
export function computeDayRealized(
  trades: TradeData[],
  now: Date = new Date(),
): number {
  const todayKey = istDayKey(now);

  return trades.reduce((sum, trade) => {
    if (!trade.sell_time) return sum;
    const exit = new Date(trade.sell_time);
    if (Number.isNaN(exit.getTime())) return sum;
    if (istDayKey(exit) !== todayKey) return sum;
    return sum + (calculatePNL(trade) ?? 0);
  }, 0);
}

/**
 * Today's unrealised P&L across the open book: each holding's per-unit day
 * change times the quantity held.
 *
 * Null — never 0 — when not one row carries a usable day change. An unpriced
 * book sums to a confident zero that reads as "flat today" when the truth is
 * "we could not price this", which is the same gate `usePositions` puts on its
 * `showTotal`. Rows without `hasDayChange` are skipped rather than counted as
 * unchanged, so a partially-priced book still reports the part it can stand behind.
 */
export function computeDayUnrealized(rows: DayPricedRow[]): number | null {
  const priced = rows.filter(row => row.hasDayChange && !row.hasSoldTrades);
  if (priced.length === 0) return null;

  return priced.reduce((sum, row) => sum + row.oneDayChange * row.shares, 0);
}

export interface MarkedTotals {
  current: number;
  invested: number;
  pnl: number;
  /** Rows the mark covers, and rows it could not price. */
  pricedCount: number;
  unpricedCount: number;
}

/**
 * The book valued at what it is worth now, which is what the tables show.
 *
 * The header used to sum closed trades only and add that to invested capital,
 * so it answered "cost plus what I have booked" while every table below
 * answered "what is this worth today". Both were arithmetically right and they
 * disagreed on screen, which reads as broken rather than as two measures.
 *
 * A row with no honest price is excluded from all three figures rather than
 * marked at cost — counting it flat would quietly pad the total with rows we
 * cannot stand behind. `unpricedCount` lets the caller say so.
 */
export function computeMarkedTotals(rows: DayPricedRow[]): MarkedTotals {
  const priced = rows.filter(row => row.hasLivePrice || row.hasSoldTrades);

  const totals = priced.reduce(
    (acc, row) => {
      acc.current += row.current;
      acc.invested += row.invested;
      acc.pnl += row.pnl ?? 0;
      return acc;
    },
    {current: 0, invested: 0, pnl: 0},
  );

  return {
    ...totals,
    pricedCount: priced.length,
    unpricedCount: rows.length - priced.length,
  };
}
