/**
 * Strategy-card derivation. Joins a strategy to the user's trades and computes realized P&L,
 * win rate, avg hold, max drawdown and open positions for the Active Strategies carousel, the
 * strategy drawer and the console.
 *
 * drift resolved 2026-09-13: mobile won `hasRealCapital`'s case-insensitive mode check
 * (`mode?.toUpperCase()`; the web compared the raw string) and the placement of the equity-path
 * builders in backtestStats (the web keeps buildBacktestEquity here). Web won the exported
 * shape of `buildEquityPath` (startY/endY, which the mobile copy had dropped from its 380x110
 * twin). Everything else was byte-identical.
 */
import {priceSymbolFor} from '../market/livePrice.ts';
import {
  calculatePNL,
  getExecutionStrategyDisplay,
  getStrategyIdForDisplay,
  getTradeEntryPrice,
  isFnOStrategy,
} from '../portfolio/portfolio.ts';
import type {Strategy} from '../types/trade.ts';
import type {TradeData} from '../types/user.ts';
import {
  buildEquityPath,
  calculateBacktestSummary,
  type EquityPath,
} from './backtestStats.ts';
import {budgetHasRealCapital, budgetMode, budgetVal} from './strategyBudget.ts';
import {tickersOf} from './strategySetupConfig.ts';
import {isAwaitingStart, isInProgress, isPaused} from './strategyStatus.ts';

export interface StrategyPosition {
  id: string | number;
  symbol: string;
  shares: number;
  /** cost basis for open positions (buy_price * qty) */
  value: number;
  /** Null when no live price backs the row - never 0, which is a real flat P&L. */
  pnl: number | null;
  isOpen: boolean;
  buyPrice: number;
  buyTime: string | null;
  sellPrice: number | null;
  sellTime: string | null;
  /** The row's source trade, so tapping it can open the holding drawer. */
  trade: TradeData;
}

export type StrategyStatusLabel = 'Active' | 'Pending' | 'Paused' | 'Ended';

export interface StrategyCardData {
  strategy: Strategy;
  id: string;
  name: string;
  /** "Intraday" | "F&O" | "Swing" */
  category: string;
  statusLabel: StrategyStatusLabel;
  paused: boolean;
  /** The row's size in its mode's unit (`budgetVal`): rupees, a count, or a percent. */
  allocated: number;
  /**
   * budget_config.mode: "AMOUNT" (₹) | "QTY" (lots in F&O, shares in equity) | "PERCENT" |
   * "RISK_PERCENT", as the row wrote it, or "QTY" for a script budget sized by quantity (its
   * `allocated` is then the count). Undefined on a row with neither, which sizes by AMOUNT - a
   * script strategy's, whose `allocated` is then its total capital.
   */
  allocationMode?: string;
  /**
   * Whether `allocated` is real rupee capital (`budgetHasRealCapital`). False for QTY, PERCENT and
   * RISK_PERCENT: `pnlPct` is then 0 and `maxDrawdownPct` null, placeholders no surface should
   * show as a return - only the rupee `pnl` is measured.
   */
  hasRealCapital: boolean;
  /** allocated, or DEFAULT_START_CAPITAL - the baseline the KPIs used */
  startCapital: number;
  /** realized total P&L across the strategy's CLOSED trades */
  pnl: number;
  /** pnl / allocated * 100; 0 without real capital (`hasRealCapital`), which is no return. */
  pnlPct: number;
  /** Mark-to-market P&L on the open book; covers `pricedOpenCount` rows only. */
  unrealizedPnl: number;
  /** Open rows an honest live price backed. 0 means the unrealised figure is meaningless. */
  pricedOpenCount: number;
  /** False until a first exit - realized stats below are placeholders until then. */
  hasClosedTrades: boolean;
  winRate: number;
  /** "74%", or "—" before any trade has closed. */
  winRatePct: string;
  /** "3.2d", or "—" before any trade has closed. */
  avgHold: string;
  /** null when there's no real allocated capital to draw it down from */
  maxDrawdownPct: number | null;
  openPositionsCount: number;
  /** e.g. "30 Jun 2026" */
  startedLabel: string;
  /** open positions (for the drawer list) */
  positions: StrategyPosition[];
  /** exited positions, realized P&L, newest exit first */
  closedPositions: StrategyPosition[];
  /** Chronological realized P&L per closed trade - the source for both series below. */
  closedPnls: number[];
  /**
   * Running realized P&L from 0 (buildPnlSeries(closedPnls)) - the card-tile sparkline's
   * series, anchored at 0 so its last point is the card's own `pnl` figure; [] until a first
   * close. The drawer's curve below is anchored at startCapital instead.
   */
  pnlSeries: number[];
  /** Drawer equity curve in a 380x110 box. Empty paths without real capital. */
  equity: EquityPath;
}

/**
 * Baseline for return/drawdown when a group has no budget of its own. Every equity curve must
 * be drawn against the same capital its KPIs were computed from, so cards expose the resolved
 * `startCapital` rather than let callers re-derive it.
 */
export const DEFAULT_START_CAPITAL = 100000;

/**
 * Running realized P&L after each close, anchored at 0 - the scalar series the sparkline
 * expects, whose last point is the card's own P&L figure. Distinct from buildEquityPath: that
 * one needs a start capital to plot against, so it can't draw a strategy running on a
 * share-count budget. Empty in, empty out - a single point is not a curve, and callers gate on
 * the length.
 */
export function buildPnlSeries(pnls: number[]): number[] {
  if (pnls.length === 0) return [];
  let sum = 0;
  return [0, ...pnls.map(p => (sum += p))];
}

const startedFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatStarted(created_at?: string): string {
  if (!created_at) return '—';
  const d = new Date(created_at);
  if (isNaN(d.getTime())) return '—';
  return startedFormatter.format(d);
}

const tsOf = (v?: string | null): number => {
  if (!v) return 0;
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? 0 : n;
};

/**
 * Newest-exit-first comparator for the closed list. A basket exits on one tick,
 * so `sell_time` ties across the whole basket routinely; on a tie the primary
 * key decides nothing and the order falls through to array position, which is
 * why web and the app listed the same rows in different orders. Entry time
 * breaks it first (a position opened later is the more recent one), then `id` -
 * a string compare, since ids are opaque and `Number()` on a uuid yields NaN,
 * whose comparison leaves the pair unordered again.
 */
const byExitRecency = (a: TradeData, b: TradeData): number => {
  const byExit = tsOf(b.sell_time) - tsOf(a.sell_time);
  if (byExit) return byExit;
  const byEntry = tsOf(b.buy_time) - tsOf(a.buy_time);
  if (byEntry) return byEntry;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
};

/**
 * Map a trade to a drawer position row (cost basis as `value`, so pnl/value is the return %).
 * `live` marks an open position; without it an open row has no honest P&L and reports null
 * rather than a zero that reads as "flat".
 */
function toPosition(
  t: TradeData,
  isOpen: boolean,
  live?: number | null,
): StrategyPosition {
  const qty = t.quantity || 0;
  // Not `buy_price` directly: a manual F&O leg stores the underlying's spot there, which would
  // price a ₹54 option off a ₹24,000 index and blow out both the cost basis and the Return %
  // denominator.
  const buy = getTradeEntryPrice(t, live ?? null);
  return {
    id: t.id,
    symbol: t.stock_symbol,
    shares: qty,
    value: buy * qty,
    pnl: calculatePNL(t, live),
    isOpen,
    buyPrice: buy,
    buyTime: t.buy_time,
    sellPrice: t.sell_price,
    sellTime: t.sell_time,
    trade: t,
  };
}

/**
 * The per-group maths shared by strategy cards and the autopilot card.
 *
 * Win rate, avg hold and drawdown are REALIZED metrics: computed from closed trades alone.
 * Feeding open positions in counted them as zero-P&L losses and as zero-length holds, so a
 * strategy holding ten open lots and one 3-day win reported a ~9% win rate and an avg hold of
 * 3d/11.
 *
 * `livePrices` marks the open book. A symbol missing from it leaves that row's P&L null, and the
 * unrealised total then covers only the rows that are priced.
 */
function summarizeTradeGroup(
  group: TradeData[],
  startCapital: number,
  livePrices?: Record<string, number | null>,
) {
  // Closed trades ordered chronologically for the equity curve; the list below re-sorts a copy
  // newest-exit-first via `byExitRecency`.
  const closedTrades = group
    .filter(t => t.sell_time)
    .sort((a, b) => tsOf(a.sell_time) - tsOf(b.sell_time));
  const openTrades = group.filter(t => !t.sell_time);

  const enriched = closedTrades.map(t => ({
    pnl: calculatePNL(t) ?? 0,
    buy_time: t.buy_time ?? undefined,
    sell_time: t.sell_time ?? undefined,
    buy_price: t.buy_price ?? undefined,
    quantity: t.quantity,
  }));
  const summary = calculateBacktestSummary(enriched, startCapital);

  const liveFor = (t: TradeData) =>
    livePrices ? (livePrices[priceSymbolFor(t.stock_symbol)] ?? null) : null;
  const positions = openTrades.map(t => toPosition(t, true, liveFor(t)));

  // Gated on how many open rows are actually marked: an unpriced book sums to a confident,
  // meaningless 0, so callers need to know the total is partial.
  const pricedPositions = positions.filter(p => p.pnl !== null);
  const unrealizedPnl = pricedPositions.reduce(
    (sum, p) => sum + (p.pnl ?? 0),
    0,
  );

  return {
    summary,
    closedPnls: enriched.map(t => t.pnl),
    closedPositions: [...closedTrades]
      .sort(byExitRecency)
      .map(t => toPosition(t, false)),
    openTrades,
    positions,
    unrealizedPnl,
    pricedOpenCount: pricedPositions.length,
    hasClosedTrades: closedTrades.length > 0,
  };
}

export interface AutopilotCardData {
  /** the AUTOPILOT-filtered group, for activity + equity curve */
  trades: TradeData[];
  allocated: number;
  /** allocated, or DEFAULT_START_CAPITAL - the baseline the KPIs used */
  startCapital: number;
  pnl: number;
  pnlPct: number;
  /** Mark-to-market P&L on the open book; covers `pricedOpenCount` rows only. */
  unrealizedPnl: number;
  pricedOpenCount: number;
  hasClosedTrades: boolean;
  winRate: number;
  winRatePct: string;
  avgHold: string;
  /** null when there's no real allocated capital to draw it down from */
  maxDrawdownPct: number | null;
  openPositionsCount: number;
  positions: StrategyPosition[];
  closedPositions: StrategyPosition[];
  closedPnls: number[];
}

/**
 * Autopilot's counterpart to `deriveStrategyCards`. Autopilot trades carry no strategy id -
 * they're identified by execution_strategy resolving to AUTOPILOT - so they're grouped by that
 * instead, then run through the same maths.
 */
export function deriveAutopilotCard(
  trades: TradeData[],
  investmentAmount: number | undefined,
  livePrices?: Record<string, number | null>,
): AutopilotCardData {
  const group = trades.filter(
    t => getExecutionStrategyDisplay(t.execution_strategy) === 'AUTOPILOT',
  );
  const allocated = investmentAmount ?? 0;
  const startCapital = allocated > 0 ? allocated : DEFAULT_START_CAPITAL;
  const {
    summary,
    closedPnls,
    closedPositions,
    openTrades,
    positions,
    unrealizedPnl,
    pricedOpenCount,
    hasClosedTrades,
  } = summarizeTradeGroup(group, startCapital, livePrices);
  const pnl = summary.totalPnL;

  return {
    trades: group,
    allocated,
    startCapital,
    pnl,
    pnlPct: allocated > 0 ? (pnl / allocated) * 100 : 0,
    unrealizedPnl,
    pricedOpenCount,
    hasClosedTrades,
    winRate: summary.winRate,
    winRatePct: hasClosedTrades ? `${Math.round(summary.winRate)}%` : '—',
    avgHold: hasClosedTrades ? summary.avgHoldTime : '—',
    maxDrawdownPct:
      allocated > 0 && hasClosedTrades ? summary.maxDrawdown * 100 : null,
    openPositionsCount: openTrades.length,
    positions,
    closedPositions,
    closedPnls,
  };
}

/**
 * The scrip to chart a strategy on. A strategy's own `symbol` may be a universe ("NIFTY100") or
 * a comma-list ("AMBUJACEM, BRITANNIA, DLF") - neither has bars, so what it actually holds wins,
 * newest open position first.
 */
export function resolveStrategyChartSymbol(
  card: StrategyCardData,
): string | null {
  const held =
    (card.positions[0]?.symbol ?? '') ||
    (card.closedPositions[0]?.symbol ?? '');
  if (held) return held;

  const declared = (card.strategy.symbol || '').trim();
  return tickersOf(declared).length === 1 ? declared : null;
}

// A NaN comparator is non-transitive and scrambles the whole array, not just the undated row,
// so an unparseable created_at sinks to the bottom via 0.
const byNewestFirst = (a: StrategyCardData, b: StrategyCardData): number =>
  tsOf(b.strategy.created_at) - tsOf(a.strategy.created_at);

/**
 * Derive display + drawer data for each strategy by joining it to the user's trades (grouped
 * via getStrategyIdForDisplay) and computing realized P&L, win rate, avg hold, max drawdown and
 * open positions. P&L / win-rate are NOT first-class backend fields, so they are derived here
 * the same way the Holdings table derives its per-row badge + P&L.
 *
 * Cards come back newest-first. is-alive has no ORDER BY, so row order is Postgres's scan order
 * - which an UPDATE (pause/archive) reshuffles. Sorted here, not at a call site, so every
 * consumer on both apps agrees.
 */
export function deriveStrategyCards(
  strategies: Strategy[],
  trades: TradeData[],
  livePrices?: Record<string, number | null>,
): StrategyCardData[] {
  // Group once, then look each strategy's bucket up - not a full `trades` scan per strategy.
  // The scan was O(strategies x trades) with a regex (and a JSON.parse of execution_payload)
  // per pair, and it ran on every portfolio poll: measured at 129ms for 68 strategies over
  // 2,452 trades on an iPhone, against 2ms for this, for byte-identical groups.
  const tradesByStrategy = new Map<string, TradeData[]>();
  for (const t of trades) {
    const key = String(getStrategyIdForDisplay(t.execution_strategy));
    const group = tradesByStrategy.get(key);
    if (group) group.push(t);
    else tradesByStrategy.set(key, [t]);
  }

  const cards = strategies.map((s): StrategyCardData => {
    const sid = s.strategy_id;
    const group = tradesByStrategy.get(sid) ?? [];

    // QTY (and PERCENT/RISK_PERCENT) budgets are counts or ratios, not rupees - only AMOUNT (or
    // unset, which defaults to AMOUNT) is real capital. A script budget sized by amount is unset,
    // and its `val` is the strategy's total capital: the base its return is a percentage of. One
    // sized by quantity is QTY: its `val` is a pool the backend fills with 1,00,000 when the run
    // sent none, which no return is measured against.
    const allocated = budgetVal(s.budget_config) ?? 0;
    const hasRealCapital = budgetHasRealCapital(s.budget_config);
    const startCapital = hasRealCapital ? allocated : DEFAULT_START_CAPITAL;
    const {
      summary,
      closedPnls,
      closedPositions,
      openTrades,
      positions,
      unrealizedPnl,
      pricedOpenCount,
      hasClosedTrades,
    } = summarizeTradeGroup(group, startCapital, livePrices);

    const pnl = summary.totalPnL;
    const pnlPct = hasRealCapital ? (pnl / allocated) * 100 : 0;

    const writtenMode =
      typeof s.budget_config?.mode === 'string'
        ? s.budget_config.mode
        : budgetMode(s.budget_config) === 'QTY'
          ? 'QTY'
          : undefined;
    const paused = isPaused(s);
    const category = s.is_intraday
      ? 'Intraday'
      : isFnOStrategy(s)
        ? 'F&O'
        : 'Swing';

    // Four states: finished strategies reach this too (the drawer opens them by id), so "not
    // paused, not pending" cannot default to Active - the drawer gates its Pause/Stop controls
    // on `!== "Ended"`, a gate that never closed while this returned three.
    const statusLabel: StrategyStatusLabel = paused
      ? 'Paused'
      : isAwaitingStart(s)
        ? 'Pending'
        : isInProgress(s)
          ? 'Active'
          : 'Ended';

    return {
      strategy: s,
      id: sid,
      name: (s.strategy_hname ?? '') || s.original_query || 'Strategy',
      category,
      statusLabel,
      paused,
      allocated,
      ...(writtenMode === undefined ? {} : {allocationMode: writtenMode}),
      hasRealCapital,
      startCapital,
      pnl,
      pnlPct,
      unrealizedPnl,
      pricedOpenCount,
      hasClosedTrades,
      winRate: summary.winRate,
      // An exit-less strategy has no win rate and no hold to average. "0%" and "0min" read as
      // measured results; the dash says "nothing has closed yet".
      winRatePct: hasClosedTrades ? `${Math.round(summary.winRate)}%` : '—',
      avgHold: hasClosedTrades ? summary.avgHoldTime : '—',
      maxDrawdownPct:
        hasRealCapital && hasClosedTrades ? summary.maxDrawdown * 100 : null,
      openPositionsCount: openTrades.length,
      startedLabel: formatStarted(s.created_at),
      positions,
      closedPositions,
      closedPnls,
      pnlSeries: buildPnlSeries(closedPnls),
      equity: hasRealCapital
        ? buildEquityPath(closedPnls, startCapital)
        : buildEquityPath([], 0),
    };
  });

  return cards.sort(byNewestFirst);
}
