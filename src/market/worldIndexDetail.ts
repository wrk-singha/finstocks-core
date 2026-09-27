import type {WorldIndexRow} from '../api/market.ts';
import {
  buildWorldMarkets,
  byRowDate,
  type WorldMarketRow,
} from './worldIndices.ts';

export const INDEX_WINDOWS = [
  {value: '1m', label: '1M', days: 30},
  {value: '3m', label: '3M', days: 92},
  {value: '6m', label: '6M', days: 183},
  {value: '1y', label: '1Y', days: 365},
] as const;

export type IndexWindow = (typeof INDEX_WINDOWS)[number]['value'];

export interface IndexBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface WindowChange {
  change: number;
  changePct: number | null;
}

export interface WindowRange {
  high: number;
  low: number;
}

export interface WindowAdvances {
  up: number;
  sessions: number;
}

export const windowDays = (value: IndexWindow): number =>
  INDEX_WINDOWS.find(w => w.value === value)?.days ?? 30;

const positiveOr = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

// A vendor row can carry a real close with a zero or absent OHLC, so an unguarded open draws a bar
// plunging to zero rather than a doji.
export const barsForIndex = (
  rows: readonly WorldIndexRow[],
  indexId: number,
): IndexBar[] =>
  rows
    .filter(
      row =>
        row.index_id === indexId && Number.isFinite(row.close) && row.close > 0,
    )
    .sort(byRowDate)
    .map(row => ({
      date: row.date,
      open: positiveOr(row.open, row.close),
      high: positiveOr(row.high, row.close),
      low: positiveOr(row.low, row.close),
      close: row.close,
    }));

export const marketForIndex = (
  rows: readonly WorldIndexRow[],
  indexId: number,
): WorldMarketRow | null =>
  buildWorldMarkets(rows).find(row => row.indexId === indexId) ?? null;

export const windowChange = (bars: readonly IndexBar[]): WindowChange => {
  const first = bars[0];
  const last = bars.at(-1);
  if (bars.length < 2 || first === undefined || last === undefined) {
    return {change: 0, changePct: null};
  }
  const change = last.close - first.close;
  return {change, changePct: first.close ? (change / first.close) * 100 : null};
};

export const windowRange = (bars: readonly IndexBar[]): WindowRange | null => {
  if (bars.length === 0) return null;
  return {
    high: Math.max(...bars.map(bar => bar.high)),
    low: Math.min(...bars.map(bar => bar.low)),
  };
};

/** Sessions in the window that closed above the one before. The feed is daily closes, so this is
 *  the only breadth reading it can support. */
export const windowAdvances = (
  bars: readonly IndexBar[],
): WindowAdvances | null => {
  if (bars.length < 2) return null;
  let up = 0;
  for (let i = 1; i < bars.length; i++) {
    const today = bars[i];
    const before = bars[i - 1];
    if (today && before && today.close > before.close) up += 1;
  }
  return {up, sessions: bars.length - 1};
};
