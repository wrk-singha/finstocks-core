import {formatNumber} from '../format/number.ts';
import type {PeerColumn, PeerColumnUnit} from '../types/industries.ts';

/** One peer-table figure. A figure the company does not file reads as a dash, never 0. */
export const formatPeerValue = (
  value: number | null | undefined,
  unit: PeerColumnUnit,
): string => {
  if (value == null || !Number.isFinite(value)) return '—';
  switch (unit) {
    case 'crore':
      return formatNumber(value, Math.abs(value) >= 1000 ? 0 : 2);
    case 'pct':
      return formatNumber(value, 1);
    case 'days':
    case 'count':
    case 'score':
      return formatNumber(value, 0);
    default:
      return formatNumber(value, 2);
  }
};

export type MedianTone = 'better' | 'worse' | null;

/**
 * Where a figure sits against its industry's median, in the direction the column says is
 * favourable. Columns with no favourable direction — price, market cap, sales — are never judged,
 * and neither is a figure level with the median.
 */
export const medianTone = (
  value: number | null | undefined,
  median: number | null | undefined,
  column: Pick<PeerColumn, 'better'>,
): MedianTone => {
  if (value == null || median == null) return null;
  if (column.better === 0 || value === median) return null;
  const isAbove = value > median;
  return isAbove === column.better > 0 ? 'better' : 'worse';
};
