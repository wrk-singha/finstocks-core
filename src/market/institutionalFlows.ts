import {formatCroreCompact} from '../format/index.ts';
import type {InstitutionalFlowRow} from '../types/market.ts';

const FLOW_SOURCES = {fii: 'nse_fii', dii: 'nse_dii'} as const;

/**
 * Shared so every consumer requests the same window and hits one cache entry —
 * a different `days` is a different query key, which would fetch twice.
 */
export const FLOW_WINDOW_DAYS = 30;

export interface FlowSide {
  label: string;
  net: number;
  date: string;
  streak: number;
  /** The streak filled the window, so the real run may start before it. */
  streakAtWindowEdge: boolean;
  series: number[];
  cumulative: number;
}

export const isBuying = (net: number): boolean => net >= 0;

export const flowVerb = (net: number): string =>
  isBuying(net) ? 'bought' : 'sold';

export const flowDirection = (net: number): string =>
  isBuying(net) ? 'buying' : 'selling';

export const signedCrore = (value: number): string =>
  `${isBuying(value) ? '+' : '−'}${formatCroreCompact(Math.abs(value))}`;

/** Sessions the side has held its current direction, latest included. */
const runLength = (nets: number[]): number => {
  const first = nets[0];
  if (first === undefined) return 0;

  const index = nets.findIndex(net => isBuying(net) !== isBuying(first));
  return index === -1 ? nets.length : index;
};

interface NetRow {
  date: string;
  eq_net: number;
}

const netsFor = (rows: InstitutionalFlowRow[], source: string): NetRow[] =>
  rows
    .flatMap(row =>
      row.source === source && row.eq_net != null
        ? [{date: row.date, eq_net: row.eq_net}]
        : [],
    )
    .sort((a, b) => b.date.localeCompare(a.date));

const buildSide = (
  label: string,
  rows: InstitutionalFlowRow[],
  source: string,
): FlowSide | null => {
  const sorted = netsFor(rows, source);
  const latest = sorted[0];
  if (latest === undefined) return null;

  const values = sorted.map(row => row.eq_net);
  const streak = runLength(values);

  return {
    label,
    net: latest.eq_net,
    date: latest.date,
    streak,
    streakAtWindowEdge: streak === values.length,
    series: [...values].reverse(),
    cumulative: values.reduce((sum, value) => sum + value, 0),
  };
};

/** Foreign and domestic together, or nothing — the pair is the unit of meaning. */
export const buildFlowPair = (rows: InstitutionalFlowRow[]): FlowSide[] => {
  const sides = [
    buildSide('FII', rows, FLOW_SOURCES.fii),
    buildSide('DII', rows, FLOW_SOURCES.dii),
  ].filter((side): side is FlowSide => side !== null);

  return sides.length === 2 ? sides : [];
};
