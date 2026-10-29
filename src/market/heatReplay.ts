import {prevCloseFor} from '../screener/screener.ts';
import type {StockGraphData} from '../types/graphData.ts';
import {formatSessionDate} from './marketHours.ts';
import {
  weightedReturn,
  type HeatModel,
  type HeatSector,
  type HeatStock,
} from './sectorHeatmap.ts';

// Replaying the market map: every stock's bars on one shared clock, and the map's model with the
// day's change set from one step of them. Ported from web dev's `utils/market/heatReplay.ts`
// (596de0ec). Bar stamps are IST wall-clock strings and are only ever compared and sliced as
// strings, so the device's time zone never moves a step.

/** One replay's bars on a shared clock: every stock's close at every step, carried forward where it did not trade. */
export interface ReplayFrames {
  /** "2026-10-16 09:15:00", IST wall clock, one per step, ascending. Daily bars may carry the date alone. */
  times: readonly string[];
  /** Upper-cased symbol to its close at each step; NaN before the stock's first bar. */
  closes: ReadonlyMap<string, Float32Array>;
  /** Upper-cased symbol to the close its change is measured from. */
  base: ReadonlyMap<string, number>;
}

export type ReplayInterval = '1m' | '5m' | '15m' | '1h' | '1d';

export interface ReplayIntervalSpec {
  key: ReplayInterval;
  label: string;
  /** The most sessions one read may span at this bar size. */
  maxSessions: number;
  /** False for daily bars, which carry no time of day. */
  intraday: boolean;
}

const FIVE_MINUTES: ReplayIntervalSpec = {
  key: '5m',
  label: '5m',
  maxSessions: 10,
  intraday: true,
};

/**
 * What a replay can step by. 500 stocks of one-minute bars are about 190k points a session, so the
 * finer the bar the fewer sessions one read may span.
 */
export const REPLAY_INTERVALS: readonly ReplayIntervalSpec[] = [
  {key: '1m', label: '1m', maxSessions: 2, intraday: true},
  FIVE_MINUTES,
  {key: '15m', label: '15m', maxSessions: 20, intraday: true},
  {key: '1h', label: '1h', maxSessions: 60, intraday: true},
  {key: '1d', label: 'Daily', maxSessions: 250, intraday: false},
];

export const DEFAULT_REPLAY_INTERVAL: ReplayInterval = '5m';

/**
 * A narrower day picker: some bar sizes only, and no day before `earliest`. The F&O heatmap's
 * replay plays the contracts on the board today, and a month is about as far back as those were
 * the ones traded (web's `ReplayCalendarLimits`).
 */
export interface ReplayCalendarLimits {
  intervals?: readonly ReplayInterval[];
  /** The first day that can be picked, `YYYY-MM-DD`. */
  earliest?: string;
}

/** An interval's spec; anything unknown reads as 5m. */
export const replayIntervalOf = (key: ReplayInterval): ReplayIntervalSpec =>
  REPLAY_INTERVALS.find(i => i.key === key) ?? FIVE_MINUTES;

/**
 * Every stock's bars on the union of their stamps, each close carried forward over the steps it
 * did not trade. A stock's change is measured from its previous close (`prevCloses`, any key case)
 * when that is a positive number, else from its own first bar; a stock with neither is left out.
 * Null when fewer than two stamps or no stock is left.
 */
export function buildReplay(
  series: StockGraphData,
  prevCloses: Readonly<Record<string, number>> | undefined,
): ReplayFrames | null {
  const stamps = new Set<string>();
  for (const points of Object.values(series)) {
    for (const p of points) if (p.time) stamps.add(p.time);
  }
  if (stamps.size < 2) return null;
  const times = [...stamps].sort();
  const at = new Map(times.map((t, i) => [t, i]));
  const closes = new Map<string, Float32Array>();
  const base = new Map<string, number>();
  for (const [symbol, points] of Object.entries(series)) {
    if (points.length === 0) continue;
    const row = new Float32Array(times.length).fill(Number.NaN);
    for (const p of points) {
      const i = at.get(p.time);
      if (i !== undefined && Number.isFinite(p.close) && p.close > 0) {
        row[i] = p.close;
      }
    }
    let last = Number.NaN;
    for (let i = 0; i < row.length; i++) {
      const v = row[i] ?? Number.NaN;
      if (Number.isNaN(v)) row[i] = last;
      else last = v;
    }
    const prev = prevCloseFor(prevCloses, symbol);
    const first = row.find(v => !Number.isNaN(v));
    // Web anchors on any previous close the server sent, so a zero one dropped the stock: it falls
    // back to the first bar here.
    const anchor = prev != null && prev > 0 ? prev : first;
    if (anchor === undefined || !(anchor > 0)) continue;
    closes.set(symbol.toUpperCase(), row);
    base.set(symbol.toUpperCase(), anchor);
  }
  return closes.size > 0 ? {times, closes, base} : null;
}

/** Whether the frames span more than one session. */
export const spansDays = (frames: Pick<ReplayFrames, 'times'>): boolean =>
  frames.times[0]?.slice(0, 10) !==
  frames.times[frames.times.length - 1]?.slice(0, 10);

/**
 * The replay clock at a step: "10:11" from the bar's IST stamp; "16 Oct · 10:11" when the replay
 * spans several sessions; and "16 Oct" alone for daily bars (whose first two stamps share a time
 * of day). `now` only decides whether the year is printed. Any frames on a shared clock (the
 * market map's, the F&O heatmap's) read it: only the stamps are looked at.
 */
export function replayClock(
  frames: Pick<ReplayFrames, 'times'>,
  step: number,
  now: Date = new Date(),
): string {
  const stamp =
    frames.times[Math.min(Math.max(0, step), frames.times.length - 1)];
  if (!stamp) return '';
  if (frames.times[0]?.slice(11, 16) === frames.times[1]?.slice(11, 16)) {
    return formatSessionDate(stamp, now);
  }
  return spansDays(frames)
    ? `${formatSessionDate(stamp, now)} · ${stamp.slice(11, 16)}`
    : stamp.slice(11, 16);
}

/**
 * The bars from `from` to `to`, inclusive IST stamps, each bound compared at its own length (daily
 * bars may be stamped with or without a time of day). With `fromOpen` the change stays measured
 * from the previous close; without it (a window that starts after the open, or spans days), from
 * each stock's first close in the window. Null when the window holds fewer than two bars.
 */
export function sliceReplay(
  frames: ReplayFrames,
  from: string,
  to: string,
  fromOpen: boolean,
): ReplayFrames | null {
  const first = frames.times.findIndex(t => t.slice(0, from.length) >= from);
  let end = -1;
  frames.times.forEach((t, i) => {
    if (t.slice(0, to.length) <= to) end = i;
  });
  if (first < 0 || end - first < 1) return null;
  if (first === 0 && end === frames.times.length - 1 && fromOpen) return frames;
  const closes = new Map<string, Float32Array>();
  const base = new Map<string, number>();
  for (const [symbol, row] of frames.closes) {
    const part = row.slice(first, end + 1);
    const anchor = fromOpen
      ? frames.base.get(symbol)
      : part.find(v => !Number.isNaN(v));
    if (anchor === undefined || !(anchor > 0)) continue;
    closes.set(symbol, part);
    base.set(symbol, anchor);
  }
  return closes.size > 0
    ? {times: frames.times.slice(first, end + 1), closes, base}
    : null;
}

/** Each stock's change as of one step, in percent, keyed by upper-cased symbol; null before its first bar. */
export function replayReturns(
  frames: ReplayFrames,
  step: number,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const i = Math.min(Math.max(0, step), frames.times.length - 1);
  for (const [symbol, row] of frames.closes) {
    const close = row[i] ?? Number.NaN;
    const base = frames.base.get(symbol);
    out.set(
      symbol,
      base && !Number.isNaN(close) ? (close / base - 1) * 100 : null,
    );
  }
  return out;
}

/**
 * The map's model with the day's change set from a replay step, and each sector's day recomputed
 * by market cap. Everything else (sizes, membership, the longer periods, the signature) is the live
 * model's, so the layout holds still while the colours move. A stock the replay did not read turns
 * grey (null).
 */
export function withReplayReturns(
  model: HeatModel,
  returns: ReadonlyMap<string, number | null>,
): HeatModel {
  const stockBySymbol = new Map<string, HeatStock>();
  const sectorById = new Map<string, HeatSector>();
  const sectors = model.sectors.map(sector => {
    const stocks = sector.stocks.map(stock => {
      const day = returns.get(stock.symbol.toUpperCase());
      const next: HeatStock = {
        ...stock,
        returns: {...stock.returns, '1d': day ?? null},
      };
      stockBySymbol.set(next.symbol, next);
      return next;
    });
    const next: HeatSector = {
      ...sector,
      stocks,
      returns: {...sector.returns, '1d': weightedReturn(stocks, '1d')},
    };
    sectorById.set(next.id, next);
    return next;
  });
  return {sectors, stockBySymbol, sectorById, signature: model.signature};
}
