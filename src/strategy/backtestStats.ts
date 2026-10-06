/**
 * Pure backtest maths: calculateBacktestSummary with its Sharpe/drawdown helpers, the
 * equity-curve path builder, and the 5-item stat grid the backtest cards share.
 *
 * drift resolved 2026-09-13: merged. Web (2026-09-12, "Show real rupee results for QTY sizing")
 * won the QTY-aware core: `startingCapital` may be null (no pool), and `maxDrawdownAmount` reports a
 * rupee drawdown that needs no baseline. Mobile won the input contract (`BacktestTradeInput`, so
 * closed TradeData rows need no cast), `periodDays`, `computeTradeReturnPct`, and the placement
 * of buildEquityPath/buildBacktestEquity here (the web keeps them in activeStrategies, where the
 * mobile copy had grown a second, narrower buildEquityPath - one version now).
 */
import {signedCurrency, signedPct} from '../format/index.ts';
import {IST_OFFSET_MS} from '../market/marketHours.ts';
import type {BacktestTradeInput, TradeSummary} from '../types/backtest.ts';

export const DEFAULT_STARTING_CAPITAL = 100000;

const DAY_MS = 86400000;

const exitTime = (t: BacktestTradeInput): number =>
  new Date(t.sell_time ?? '').getTime();

export const computeSharpeEstimate = (
  trades: BacktestTradeInput[],
  startingCapital = DEFAULT_STARTING_CAPITAL,
): {value: number | null; tradingDays: number} => {
  if (trades.length < 2) return {value: null, tradingDays: 0};

  const dailyPnL = new Map<number, number>();
  trades.forEach(t => {
    if (t.sell_time && t.pnl !== undefined) {
      const sellDay =
        Math.floor((new Date(t.sell_time).getTime() + IST_OFFSET_MS) / DAY_MS) *
        DAY_MS;
      dailyPnL.set(sellDay, (dailyPnL.get(sellDay) ?? 0) + t.pnl);
    }
  });

  // Only days where trades actually occurred.
  const tradingDays = Array.from(dailyPnL.keys()).sort((a, b) => a - b);
  const n = tradingDays.length;
  if (n < 2) return {value: null, tradingDays: n};

  let equity = startingCapital;
  const returns: number[] = [];

  for (const day of tradingDays) {
    const prevEquity = equity;
    equity += dailyPnL.get(day) ?? 0;
    returns.push((equity - prevEquity) / prevEquity);
  }

  const meanReturn = returns.reduce((s, r) => s + r, 0) / n;

  // Sample variance (n-1).
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / (n - 1);

  const std = Math.sqrt(variance);
  if (std < 1e-8) return {value: null, tradingDays: n};

  return {value: (meanReturn / std) * Math.sqrt(252), tradingDays: n};
};

/** Peak-to-trough drawdown of equity from `startingCapital`, as a fraction (0.25 = 25%). */
export const computeMaxRealizedDrawdown = (
  trades: BacktestTradeInput[],
  startingCapital = DEFAULT_STARTING_CAPITAL,
): number => {
  if (trades.length === 0) return 0;

  const sorted = [...trades].sort((a, b) => exitTime(a) - exitTime(b));

  let equity = startingCapital;
  let peak = startingCapital;
  let maxDD = 0;

  for (const t of sorted) {
    equity += t.pnl ?? 0;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  return maxDD;
};

/**
 * QTY sizing has no fixed capital pool - "5 shares" costs a different amount each trade as price
 * moves, so there is no one true starting balance to measure a PERCENTAGE drawdown against. This
 * needs none: it tracks the peak and trough of cumulative rupee P&L directly, which is real
 * regardless of sizing mode, and is what the no-baseline card falls back to instead of inventing
 * a percentage against a number that doesn't exist. Rupees, not a fraction.
 */
export const computeMaxDrawdownAmount = (
  trades: BacktestTradeInput[],
): number => {
  if (trades.length === 0) return 0;

  const sorted = [...trades].sort((a, b) => exitTime(a) - exitTime(b));

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;

  for (const t of sorted) {
    cumulative += t.pnl ?? 0;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }

  return maxDD;
};

/**
 * `startingCapital` is `null` for a sizing mode with no fixed capital pool (QTY): percentage
 * metrics need a real number to divide by and must not silently borrow the default meant for
 * when a caller simply omits it for AMOUNT mode. Null rather than undefined because an explicit
 * `undefined` argument takes a default parameter's value - the web copy declared
 * `number | undefined = 100000` and its no-baseline branch was therefore unreachable.
 */
export const calculateBacktestSummary = (
  trades: BacktestTradeInput[],
  startingCapital: number | null = DEFAULT_STARTING_CAPITAL,
): TradeSummary => {
  let totalPnL = 0;
  let winningTrades = 0;
  let totalWinAmount = 0;
  let totalLossAmount = 0;
  let totalHoldTimeMs = 0;

  trades.forEach(trade => {
    const pnl = trade.pnl ?? 0;
    totalPnL += pnl;

    if (pnl > 0) {
      winningTrades++;
      totalWinAmount += pnl;
    } else if (pnl < 0) {
      totalLossAmount += Math.abs(pnl);
    }

    if (trade.buy_time && trade.sell_time) {
      totalHoldTimeMs +=
        new Date(trade.sell_time).getTime() -
        new Date(trade.buy_time).getTime();
    }
  });

  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const avgProfit = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
  const avgLoss =
    totalTrades - winningTrades > 0
      ? totalLossAmount / (totalTrades - winningTrades)
      : 0;

  let avgHoldTime = '0min';
  if (totalTrades > 0) {
    const avgMs = totalHoldTimeMs / totalTrades;
    const avgHours = avgMs / (1000 * 60 * 60);
    const avgDays = avgMs / (1000 * 60 * 60 * 24);

    if (avgDays >= 1) {
      avgHoldTime = `${avgDays.toFixed(1)}d`;
    } else if (avgHours >= 1) {
      avgHoldTime = `${avgHours.toFixed(1)}h`;
    } else {
      avgHoldTime = `${(avgMs / (1000 * 60)).toFixed(0)}min`;
    }
  }

  const sharpeRatio =
    startingCapital !== null
      ? computeSharpeEstimate(trades, startingCapital)
      : {value: null, tradingDays: 0};
  const maxDrawdown =
    startingCapital !== null
      ? computeMaxRealizedDrawdown(trades, startingCapital)
      : 0;
  const maxDrawdownAmount = computeMaxDrawdownAmount(trades);

  let minBuy = Infinity;
  let maxSell = -Infinity;
  trades.forEach(t => {
    const b = new Date(t.buy_time ?? '').getTime();
    const s = exitTime(t);
    if (!Number.isNaN(b)) minBuy = Math.min(minBuy, b);
    if (!Number.isNaN(s)) maxSell = Math.max(maxSell, s);
  });
  const periodDays =
    minBuy !== Infinity && maxSell > minBuy ? (maxSell - minBuy) / DAY_MS : 0;

  return {
    totalPnL,
    totalTrades,
    winRate,
    avgProfit,
    avgLoss,
    avgHoldTime,
    sharpeRatio,
    maxDrawdown,
    maxDrawdownAmount,
    periodDays,
  };
};

/** Per-trade return on cost (buy_price x quantity), or null when the cost is unknown. */
export const computeTradeReturnPct = (
  trade: BacktestTradeInput,
): number | null => {
  const cost = (trade.buy_price ?? 0) * (trade.quantity ?? 0);
  if (!(cost > 0)) return null;
  return ((trade.pnl ?? 0) / cost) * 100;
};

/** The strategy-card drawer's equity box. */
export const EQUITY_CHART_W = 380;
export const EQUITY_CHART_H = 110;
/** The backtest result card's equity box. */
export const BACKTEST_CHART_W = 720;
export const BACKTEST_CHART_H = 210;

export interface EquityPath {
  line: string;
  area: string;
  startY: number;
  endY: number;
}

/**
 * Equity-curve SVG paths (line + filled area) from a chronological list of trade P&Ls starting
 * at `startCapital`, for a `viewBox="0 0 w h"`. Empty paths when there is nothing to draw.
 */
export function buildEquityPath(
  pnls: number[],
  startCapital: number,
  w = EQUITY_CHART_W,
  h = EQUITY_CHART_H,
): EquityPath {
  if (pnls.length < 1) return {line: '', area: '', startY: h / 2, endY: h / 2};
  let equity = startCapital;
  const pts: number[] = [equity];
  pnls.forEach(p => {
    equity += p;
    pts.push(equity);
  });
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 6;
  const n = pts.length;
  const ys = pts.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const coords = ys.map((y, i) => {
    const x = n === 1 ? 0 : (i / (n - 1)) * w;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  return {line, area, startY: ys[0] ?? h / 2, endY: ys[ys.length - 1] ?? h / 2};
}

/** Sort trades by exit time and draw their cumulative equity from initialBalance. */
export const buildBacktestEquity = (
  trades: BacktestTradeInput[],
  initialBalance: number,
): EquityPath => {
  const t = (sellTime?: string) => {
    const n = new Date(sellTime ?? '').getTime();
    return Number.isNaN(n) ? 0 : n;
  };
  const pnls = [...trades]
    .sort((a, b) => t(a.sell_time) - t(b.sell_time))
    .map(tr => tr.pnl ?? 0);
  return buildEquityPath(
    pnls,
    initialBalance,
    BACKTEST_CHART_W,
    BACKTEST_CHART_H,
  );
};

/**
 * How a stat cell is tinted. The apps map it onto their theme: `profit`/`loss` to the P&L pair,
 * `secondary`/`muted` to the matching text colours, absent to the default ink.
 */
export type StatTone = 'profit' | 'loss' | 'secondary' | 'muted';

export interface BacktestStatItem {
  k: string;
  v: string;
  tone?: StatTone;
}

const plTone = (n: number): StatTone => (n >= 0 ? 'profit' : 'loss');

/**
 * The 5-item backtest stat grid (Earnings, Total return, Max drawdown, # Trades, Win rate)
 * shared by the result card and the logs drawer. Total return and a percentage drawdown both
 * need a real starting balance to divide by - QTY sizing has none, so those two rows fall back
 * to "—" and a rupee drawdown instead of inventing a percentage against a number that isn't real.
 */
export const buildBacktestStatItems = (
  summary: TradeSummary,
  initialBalance: number | undefined,
  finalBalance: number | undefined,
): BacktestStatItem[] => {
  const hasBaseline =
    initialBalance !== undefined && finalBalance !== undefined;
  const earnings = hasBaseline
    ? finalBalance - initialBalance
    : summary.totalPnL;
  const returnPct =
    hasBaseline && initialBalance > 0
      ? (earnings / initialBalance) * 100
      : null;

  return [
    {k: 'Earnings', v: signedCurrency(earnings), tone: plTone(earnings)},
    {
      k: 'Total return',
      v: returnPct === null ? '—' : signedPct(returnPct),
      tone: returnPct === null ? 'muted' : plTone(returnPct),
    },
    hasBaseline
      ? {
          k: 'Max drawdown',
          v: `${(summary.maxDrawdown * 100).toFixed(1)}%`,
          tone: 'secondary',
        }
      : {
          k: 'Max drawdown (₹)',
          v: signedCurrency(-summary.maxDrawdownAmount),
          tone: 'secondary',
        },
    {k: '# Trades', v: String(summary.totalTrades)},
    {k: 'Win rate', v: `${summary.winRate.toFixed(1)}%`},
  ];
};
