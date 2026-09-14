import type {CreateBacktestRequest} from '../api/trading.ts';
import type {BacktestSweep} from '../types/backtest.ts';
import type {ExecutionLogEntry} from '../types/strategyLogs.ts';
import {extractSetupConfig} from './strategySetupConfig.ts';

export interface SweepSeries {
  readonly key: string;
  readonly trades: readonly ExecutionLogEntry[];
  readonly initialBalance: number;
  readonly isWinner: boolean;
}

export interface SweepCurve {
  readonly key: string;
  readonly points: readonly {readonly x: number; readonly y: number}[];
  readonly isWinner: boolean;
}

/**
 * Every variant's equity curve on ONE shared y-scale, in a 0..1 box.
 *
 * Deliberately not a per-variant equity path: that scales each curve to its own min and max, so a
 * variant that lost 11% and one that gained 17% would be drawn as the same shape in the same box.
 * The whole point of overlaying them is that the reader can see one pulling away from the others,
 * and that only means something if they share an axis.
 */
export function buildSweepCurves(series: readonly SweepSeries[]): {
  readonly curves: readonly SweepCurve[];
  readonly baseline: number;
} {
  const equities = series.map(entry => {
    const sorted = [...entry.trades].sort(
      (a, b) => (Date.parse(a.sell_time) || 0) - (Date.parse(b.sell_time) || 0),
    );
    let equity = entry.initialBalance;
    const points = [equity];
    for (const trade of sorted) {
      equity += trade.pnl;
      points.push(equity);
    }
    return points;
  });
  const all = equities.flat();
  if (all.length === 0) return {curves: [], baseline: 0.5};
  // The starting capital is always in range, so a flat line and the zero-return reference are
  // never off-chart.
  const starts = series.map(entry => entry.initialBalance);
  const min = Math.min(...all, ...starts);
  const max = Math.max(...all, ...starts);
  const range = max - min || 1;
  const toY = (value: number) => (value - min) / range;
  // Longest series sets the x-axis so variants with different trade counts stay comparable in time
  // rather than being stretched to equal width.
  const longest = Math.max(...equities.map(points => points.length));
  const curves = series.map((entry, index) => ({
    key: entry.key,
    isWinner: entry.isWinner,
    points: (equities[index] ?? []).map((value, step) => ({
      x: longest === 1 ? 0 : step / (longest - 1),
      y: toY(value),
    })),
  }));
  // Winner drawn last so it sits above the muted lines rather than under them.
  curves.sort((a, b) => Number(a.isWinner) - Number(b.isWinner));
  return {curves, baseline: toY(starts[0] ?? min)};
}

export interface PreparedVariant {
  readonly label: string;
  readonly request: CreateBacktestRequest | null;
}

/** Today as the backend's `YYYY-MM-DD` (UTC, as the backtest end date has always been sent). */
const todayIso = (now = new Date()): string =>
  now.toISOString().split('T')[0] ?? '';

/** A sweep's create-backtest bodies; a variant missing a symbol or period prepares as null. */
export function prepareSweep(
  sweep: BacktestSweep,
  fallbackName: string,
  today = todayIso(),
): PreparedVariant[] {
  return sweep.variants.map(variant => {
    const config = extractSetupConfig(variant.rows);
    if (config.symbol === undefined || config.start_date === undefined) {
      return {label: variant.label, request: null};
    }
    return {
      label: variant.label,
      request: {
        symbol: config.symbol,
        strategy_hname: `${config.strategy_hname ?? fallbackName} — ${variant.label}`,
        timeframe: config.timeframe ?? '1d',
        is_intraday: config.is_intraday ?? false,
        execution_mode: config.execution_mode ?? 'LOOP',
        original_query: config.original_query ?? variant.label,
        allocated_amount: config.allocated_amount ?? 100_000,
        ...(config.sizing_mode === undefined
          ? {}
          : {sizing_mode: config.sizing_mode}),
        ...(config.total_capital === undefined
          ? {}
          : {total_capital: config.total_capital}),
        start_date: config.start_date,
        end_date: config.end_date ?? today,
      },
    };
  });
}
