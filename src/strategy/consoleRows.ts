/**
 * The pre-formatted rows the Strategy Console renders: positions, closed positions, the
 * activity timeline and the meta chips. Web-only today; the mobile drawer can adopt them.
 */
import {
  formatCurrency,
  formatShortDateTime,
  signedCurrency,
  signedPct,
} from '../format/index.ts';
import type {ConsoleActivityRow, ConsolePosition} from '../types/console.ts';
import type {StrategyLog} from '../types/strategyLogs.ts';
import type {TradeData} from '../types/user.ts';
import type {StrategyPosition} from './activeStrategies.ts';

const positionSub = (shares: number, value: number): string =>
  `${shares} sh · avg ${formatCurrency(shares ? value / shares : 0, 2)}`;

export const toConsolePosition = (p: StrategyPosition): ConsolePosition => {
  // A null P&L is an unpriced row, not a flat one - both show "—", but only a priced row may
  // render a figure at all.
  const pnl = p.pnl;
  const hasPl = pnl !== null && Math.abs(pnl) > 0.005;
  const plp = p.value && pnl !== null ? (pnl / p.value) * 100 : 0;
  return {
    sym: p.symbol,
    sub: positionSub(p.shares, p.value),
    val: formatCurrency(p.value, 0),
    pl: hasPl ? signedCurrency(pnl) : '—',
    plp: hasPl ? signedPct(plp) : '—',
    plpPositive: hasPl ? pnl >= 0 : null,
  };
};

// Closed positions show realized P&L as the primary value; % return is against the exited cost
// basis. Newest exit first (ordering comes from the card). Dated with the year: a strategy's
// ledger runs across years, and a bare "Jul 5" does not say which July it exited.
const closedPositionSub = (p: StrategyPosition): string => {
  const buy = `Buy ${formatCurrency(p.buyPrice, 2)} · ${formatShortDateTime(p.buyTime, true)}`;
  const sell = `Sell ${p.sellPrice !== null ? formatCurrency(p.sellPrice, 2) : '—'} · ${formatShortDateTime(p.sellTime, true)}`;
  return `${buy}  →  ${sell}`;
};

export const toClosedConsolePosition = (
  p: StrategyPosition,
): ConsolePosition => {
  // An exit carries a sell price, so a closed row is always priced; the ?? 0 only satisfies the
  // shared nullable type.
  const pnl = p.pnl ?? 0;
  const plp = p.value ? (pnl / p.value) * 100 : 0;
  return {
    sym: p.symbol,
    sub: closedPositionSub(p),
    val: signedCurrency(pnl),
    pl: '',
    plp: signedPct(plp),
    plpPositive: pnl >= 0,
    closed: true,
  };
};

/**
 * The symbol the detail chart leads with, taken from the same rows the Positions list renders:
 * an open holding first, else the most recent exit.
 *
 * Not from `toActivityRows`, which is a display list for the timeline panel and orders itself
 * for that job - it merges alert logs in among the fills (whose `sym` can be the literal
 * "System"), caps at 8 rows, and dates a trade by its sell time when closed but its buy time
 * when open. That mixed key sorts differently from the positions list's `byExitRecency`, so
 * reading its head charted one stock while the list directly underneath led with another.
 */
export const chartSymbolFor = (
  positions: ConsolePosition[],
  closedPositions: ConsolePosition[],
): string => (positions[0]?.sym ?? '') || (closedPositions[0]?.sym ?? '');

// strategy_logs levels that represent runtime problems worth surfacing in the console timeline
// (normal fills / info lines are left to the trade rows).
const ALERT_LEVELS = new Set(['WARNING', 'ERROR', 'EXECUTION_ERROR']);

interface DatedActivity {
  ts?: string | null;
  row: ConsoleActivityRow;
}

const tradeToDatedActivity = (t: TradeData): DatedActivity => {
  const isSell = t.sell_price != null && t.sell_time != null;
  const ts = isSell ? t.sell_time : (t.buy_time ?? '') || t.timestamp;
  return {
    ts,
    row: {
      side: isSell ? 'SELL' : 'BUY',
      sidePositive: !isSell,
      sym: t.stock_symbol,
      detail: `${t.quantity} @ ${formatCurrency((isSell ? t.sell_price : t.buy_price) ?? 0, 2)}`,
      t: formatShortDateTime(ts, true),
    },
  };
};

const alertToDatedActivity = (l: StrategyLog): DatedActivity => {
  const level: 'warning' | 'error' =
    l.log_level.toUpperCase() === 'WARNING' ? 'warning' : 'error';
  return {
    ts: l.created_at,
    row: {
      side: level === 'warning' ? 'WARN' : 'ERR',
      sidePositive: false,
      level,
      sym: (l.symbol ?? '') || 'System',
      detail:
        (l.message ?? '') ||
        (l.payload?.error ?? '') ||
        (l.payload?.message ?? '') ||
        '—',
      t: formatShortDateTime(l.created_at),
    },
  };
};

/**
 * Recent per-strategy timeline: executed fills merged with warning/error logs from
 * strategy_logs, newest first, capped for the summary panel.
 */
export const toActivityRows = (
  groupTrades: TradeData[],
  alertLogs: StrategyLog[] = [],
): ConsoleActivityRow[] =>
  [
    ...groupTrades.map(tradeToDatedActivity),
    ...alertLogs
      .filter(l => ALERT_LEVELS.has(l.log_level.toUpperCase()))
      .map(alertToDatedActivity),
  ]
    .sort(
      (a, b) => new Date(b.ts ?? 0).getTime() - new Date(a.ts ?? 0).getTime(),
    )
    .slice(0, 8)
    .map(x => x.row);

/** "LOOP · Intraday · 5M" - the chips under the console's strategy name. */
export const strategyMeta = (s: {
  execution_mode?: string;
  is_intraday?: boolean;
  timeframe?: string;
}): string[] =>
  [
    s.execution_mode?.toUpperCase(),
    s.is_intraday === undefined
      ? undefined
      : s.is_intraday
        ? 'Intraday'
        : 'Positional',
    s.timeframe?.toUpperCase(),
  ].filter((chip): chip is string => Boolean(chip));
