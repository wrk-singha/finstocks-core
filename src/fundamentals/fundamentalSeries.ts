import type {
  FundamentalCatalog,
  FundamentalGroup,
  FundamentalMetric,
  FundamentalPeriod,
} from '../types/fundamentalSeries.ts';

/** Every period a line can be charted at. */
export const FUNDAMENTAL_PERIODS: readonly FundamentalPeriod[] = [
  'Q',
  'A',
  'TTM',
  'D',
];

export const isFundamentalPeriod = (
  value: unknown,
): value is FundamentalPeriod =>
  typeof value === 'string' &&
  (FUNDAMENTAL_PERIODS as readonly string[]).includes(value);

/**
 * The periods this company has points for, in the order the backend lists them, which is the order
 * a picker offers them. A line without counts says nothing about what was filed, so every period it
 * has is offered.
 */
export function availablePeriods(
  metric: FundamentalMetric,
): FundamentalPeriod[] {
  const {available} = metric;
  if (available === undefined) return [...metric.periods];
  return metric.periods.filter(period => (available[period] ?? 0) > 0);
}

/** Whether the company files this line at any period. */
export const isReported = (metric: FundamentalMetric): boolean =>
  availablePeriods(metric).length > 0;

/** The lines the company files, in the backend's order. */
export const reportedMetrics = (
  catalog: FundamentalCatalog | undefined,
): FundamentalMetric[] => (catalog?.metrics ?? []).filter(isReported);

/**
 * The statements the company files anything in, in the backend's order: a software firm has no
 * Banking statement to browse.
 */
export function reportedGroups(
  catalog: FundamentalCatalog | undefined,
): FundamentalGroup[] {
  const filed = new Set(reportedMetrics(catalog).map(metric => metric.group));
  return (catalog?.groups ?? []).filter(group => filed.has(group.id));
}
