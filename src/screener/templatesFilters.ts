import type {ScreenerStrategy} from '../types/screener.ts';
import {type RiskTone, strategyRiskTier} from './screenerUtils.ts';

/** Panel filter state for the Strategy Templates screener (client-side only). */
export interface TemplateFilterState {
  /** empty = any risk tier */
  risk: RiskTone[];
  /** 0 = any (avg_pnl %) */
  minReturn: number;
  /** 0 = any (avg_winrate, compared as %) */
  minWinRate: number;
  /** DRAWDOWN_CEIL = any (max_drawdown_pct) */
  maxDrawdown: number;
}

/** Slider max for drawdown; a value here means "don't constrain drawdown". */
export const DRAWDOWN_CEIL = 30;

export const DEFAULT_TEMPLATE_FILTERS: TemplateFilterState = {
  risk: [],
  minReturn: 0,
  minWinRate: 0,
  maxDrawdown: DRAWDOWN_CEIL,
};

/** Risk chips reuse the card's tone taxonomy so labels never drift. */
export const TEMPLATE_RISK_OPTIONS: {tone: RiskTone; label: string}[] = [
  {tone: 'low', label: 'Low risk'},
  {tone: 'med', label: 'Medium risk'},
  {tone: 'high', label: 'High risk'},
];

/**
 * Keep only strategies matching every active filter. Strategies missing the
 * relevant metric (e.g. static long-term templates with no P&L) fall out as soon
 * as that metric is constrained, and stay visible while it isn't.
 */
export function applyTemplateFilters(
  list: ScreenerStrategy[],
  f: TemplateFilterState,
): ScreenerStrategy[] {
  return list.filter(s => {
    if (f.risk.length) {
      const tone = strategyRiskTier(s)?.tone;
      if (!tone || !f.risk.includes(tone)) return false;
    }
    if (f.minReturn > 0 && (s.avg_pnl ?? -Infinity) < f.minReturn) return false;
    if (f.minWinRate > 0 && (s.avg_winrate ?? 0) < f.minWinRate) return false;
    if (
      f.maxDrawdown < DRAWDOWN_CEIL &&
      (s.max_drawdown_pct ?? Infinity) > f.maxDrawdown
    )
      return false;
    return true;
  });
}

/**
 * Compare two optional metrics, sinking missing ones to the bottom in both
 * directions. A missing metric means "never backtested", not "scored zero" -
 * coercing it to 0 ranks it above every losing strategy.
 */
export function compareMetric(
  a: number | null | undefined,
  b: number | null | undefined,
  order: 'asc' | 'desc',
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return order === 'desc' ? b - a : a - b;
}

/** Shared count label: "1 strategy" / "6 strategies". */
export function strategyCount(n: number): string {
  return `${n} ${n === 1 ? 'strategy' : 'strategies'}`;
}

/** Number of active filters, for the "Filters" button badge. */
export function countActiveTemplateFilters(f: TemplateFilterState): number {
  return (
    (f.risk.length ? 1 : 0) +
    (f.minReturn > 0 ? 1 : 0) +
    (f.minWinRate > 0 ? 1 : 0) +
    (f.maxDrawdown < DRAWDOWN_CEIL ? 1 : 0)
  );
}
