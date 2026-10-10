import type {
  EsfBacktestDay,
  EsfBacktestMonth,
  EsfBacktestPick,
} from '../types/esf.ts';
import {mulberry32, percentileSorted} from './sampling.ts';

/**
 * What a basket's backtest log turns into on the page, as the web works it out
 * (frontend dev 2226a1e1, `utils/market/basketBacktest.ts`): the equity and drawdown curves,
 * the returns by year and by month, the summary figures and the Monte Carlo band.
 */

export interface CurvePoint {
  date: string;
  basket: number;
  benchmark: number | null;
  /** Below the running peak, as a fraction (−0.12 is 12% under). */
  drawdown: number;
}

export interface PeriodReturn {
  label: string;
  basket: number;
}

export interface MonthCell {
  year: number;
  month: number;
  basket: number;
}

export interface MonteCarloBand {
  step: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface BacktestSummary {
  finalMultiple: number;
  /** Null under a year of history, where annualising would overstate. */
  annualReturn: number | null;
  maxDrawdown: number;
  maxDrawdownDate: string;
  sharpe: number | null;
  winRate: number;
}

export const TRADING_DAYS_PER_YEAR = 252;
const DAYS_PER_YEAR = 365.25;
const MS_PER_DAY = 86_400_000;

export function equityCurve(daily: readonly EsfBacktestDay[]): CurvePoint[] {
  let peak = 0;
  return daily.map(d => {
    peak = Math.max(peak, d.nav);
    return {
      date: d.date,
      basket: d.nav,
      benchmark: d.benchmark,
      drawdown: d.nav / peak - 1,
    };
  });
}

export const dailyReturns = (daily: readonly EsfBacktestDay[]): number[] =>
  daily.slice(1).map((d, i) => d.nav / (daily[i]?.nav ?? d.nav) - 1);

export function picksByReview(
  picks: EsfBacktestPick[],
): Map<string, EsfBacktestPick[]> {
  const byReview = new Map<string, EsfBacktestPick[]>();
  for (const p of picks) {
    byReview.set(p.as_of, [...(byReview.get(p.as_of) ?? []), p]);
  }
  return byReview;
}

/** Calendar years between two YYYY-MM-DD dates, fractional. */
export const yearsBetween = (from: string, to: string): number =>
  (new Date(to).getTime() - new Date(from).getTime()) /
  MS_PER_DAY /
  DAYS_PER_YEAR;

function returnsByPeriod(
  daily: readonly EsfBacktestDay[],
  key: (date: string) => string,
): [string, number][] {
  const closing = new Map<string, number>();
  for (const d of daily) closing.set(key(d.date), d.nav);
  let previous = daily[0]?.nav ?? 1;
  return [...closing].map(([k, nav]) => {
    const change = nav / previous - 1;
    previous = nav;
    return [k, change];
  });
}

export const yearlyReturns = (
  daily: readonly EsfBacktestDay[],
): PeriodReturn[] =>
  returnsByPeriod(daily, date => date.slice(0, 4)).map(([label, basket]) => ({
    label,
    basket,
  }));

export const monthlyReturns = (daily: readonly EsfBacktestDay[]): MonthCell[] =>
  returnsByPeriod(daily, date => date.slice(0, 7)).map(([ym, basket]) => ({
    year: Number(ym.slice(0, 4)),
    month: Number(ym.slice(5, 7)),
    basket,
  }));

/** The yearly rate a multiple compounds at over `years`; null under a year, where it would overstate. */
export const annualisedReturn = (
  multiple: number,
  years: number,
): number | null => (years >= 1 ? multiple ** (1 / years) - 1 : null);

/** Annualised, at a 0% risk-free rate; null with under two returns or no variance. */
function sharpeRatio(returns: number[], years: number): number | null {
  if (returns.length < 2 || years <= 0) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  if (variance === 0) return null;
  return (mean / Math.sqrt(variance)) * Math.sqrt(returns.length / years);
}

export function summarize(
  daily: readonly EsfBacktestDay[],
  /** The periods the win rate counts, each by its net return: positive is a win. */
  periods: readonly Pick<EsfBacktestMonth, 'net'>[],
): BacktestSummary | null {
  const first = daily[0];
  const last = daily[daily.length - 1];
  if (first === undefined || last === undefined || daily.length < 2) {
    return null;
  }
  const [head, ...rest] = equityCurve(daily);
  if (head === undefined) return null;
  const trough = rest.reduce(
    (worst, p) => (p.drawdown < worst.drawdown ? p : worst),
    head,
  );
  const finalMultiple = last.nav / first.nav;
  const years = yearsBetween(first.date, last.date);
  return {
    finalMultiple,
    annualReturn: annualisedReturn(finalMultiple, years),
    maxDrawdown: trough.drawdown,
    maxDrawdownDate: trough.date,
    sharpe: sharpeRatio(dailyReturns(daily), years),
    winRate:
      periods.length === 0
        ? 0
        : periods.filter(p => p.net > 0).length / periods.length,
  };
}

/**
 * Resamples the daily returns into `paths` forward paths of `steps` days from `capital`, and
 * reads the percentiles at each step.
 */
export function monteCarlo(
  returns: number[],
  steps: number,
  capital: number,
  paths = 1000,
  seed = 7,
): MonteCarloBand[] {
  if (returns.length === 0 || steps === 0) return [];
  // The same seed gives the same paths, so the band does not jump between renders.
  const random = mulberry32(seed);
  const values = Array.from({length: paths}, () => capital);
  const bands: MonteCarloBand[] = [];
  const record = (step: number) => {
    const sorted = [...values].sort((a, b) => a - b);
    bands.push({
      step,
      p5: percentileSorted(sorted, 0.05),
      p10: percentileSorted(sorted, 0.1),
      p25: percentileSorted(sorted, 0.25),
      p50: percentileSorted(sorted, 0.5),
      p75: percentileSorted(sorted, 0.75),
      p90: percentileSorted(sorted, 0.9),
      p95: percentileSorted(sorted, 0.95),
    });
  };
  record(0);
  for (let step = 1; step <= steps; step++) {
    for (let i = 0; i < paths; i++) {
      const draw = returns[Math.floor(random() * returns.length)] ?? 0;
      values[i] = (values[i] ?? capital) * (1 + draw);
    }
    record(step);
  }
  return bands;
}
