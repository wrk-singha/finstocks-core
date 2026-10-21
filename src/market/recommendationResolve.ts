import type {RecommendationOutcome} from '../types/market.ts';

/**
 * Live outcome of one recommendation, from its zones and the 1m candles since it was published: a
 * port of web's `utils/market/recommendationResolve.ts` (main f72ddef6, the same on dev). The
 * dashboard's "Finalize day" implements the SAME rules in Python, and
 * `__tests__/recommendationResolve.test.ts` carries web's shared vectors
 * (`scripts/recommendationResolve.test.mjs`) unchanged: change a rule here only with web and the
 * dashboard.
 *
 * The rules, in order: a pick fills on the first bar from its publication minute to its
 * valid_until that reaches its entry zone, at that bar's open held inside the zone. From the bar
 * AFTER the fill, a bar that reaches the stop exits at the stop's edge nearest the entry, else one
 * that reaches the target exits at the target's edge nearest the entry; a bar reaching both is a
 * stop. Never filled, it is `waiting` while valid and `not_triggered` once over; filled and still
 * inside its plan once over, it is `expired` at the last close at or before valid_until. Target 2
 * is a flag (`t2At`), never an exit.
 *
 * Bars are taken as given: `liveResolution` (recommendationView.ts) is what drops the ones that
 * cannot be read before they get here.
 */

/** One minute bar. */
export interface RecommendationCandle {
  /** Candle open, epoch seconds. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/** A zone, low edge first. */
export type RecommendationZone = readonly [number, number];

export interface ResolveRecommendationInput {
  direction: 'long' | 'short' | 'neutral';
  kind: 'equity' | 'commodity';
  entry: RecommendationZone;
  stop: RecommendationZone;
  target: RecommendationZone;
  /** Optional stretch level; never changes the exit or P&L, only `t2At`. */
  target2?: RecommendationZone | undefined;
  /** Epoch seconds. */
  publishedAt: number;
  validUntil: number;
  now: number;
  /** Ascending by t. */
  candles: readonly RecommendationCandle[];
}

export interface RecommendationResolution {
  outcome: RecommendationOutcome;
  fillPrice?: number;
  fillAt?: number;
  /** First bar after the fill that touched target 2, before any stop breach. */
  t2At?: number;
  exitPrice?: number;
  exitAt?: number;
  /** Rupees on a fixed ₹10,000 position (1 lot for commodities); only once exited. */
  pnl?: number;
  returnPct?: number;
}

export const POSITION_RUPEES = 10_000;

/** Shares in the fixed ₹10,000 position (1 unit for commodities). Shown only, never an order's size. */
export const positionQty = (kind: string, fill: number): number =>
  kind === 'commodity' ? 1 : Math.floor(POSITION_RUPEES / fill);

const round = (n: number, dp: number): number =>
  Math.round(n * 10 ** dp) / 10 ** dp;

type Filled = {fillPrice: number; fillAt: number; t2At?: number};

export function resolveRecommendation(
  i: ResolveRecommendationInput,
): RecommendationResolution {
  if (i.direction === 'neutral') return {outcome: 'waiting'};
  const sign = i.direction === 'long' ? 1 : -1;
  const firstMinute = Math.floor(i.publishedAt / 60) * 60;
  const bars = i.candles.filter(c => c.t >= firstMinute && c.t <= i.validUntil);
  const finished = i.now > i.validUntil;

  const fillIdx = bars.findIndex(c => c.l <= i.entry[1] && c.h >= i.entry[0]);
  const fillBar = bars[fillIdx];
  if (fillIdx < 0 || fillBar === undefined)
    return {outcome: finished ? 'not_triggered' : 'waiting'};

  const fillPrice = Math.min(i.entry[1], Math.max(i.entry[0], fillBar.o));
  const t2At = touchedTarget2(i, bars, fillIdx, sign);
  const base: Filled =
    t2At === undefined
      ? {fillPrice, fillAt: fillBar.t}
      : {fillPrice, fillAt: fillBar.t, t2At};

  // Stop wins a same-candle clash; checks start on the candle AFTER the fill.
  const hitStop = (c: RecommendationCandle) =>
    sign === 1 ? c.l <= i.stop[1] : c.h >= i.stop[0];
  const hitTarget = (c: RecommendationCandle) =>
    sign === 1 ? c.h >= i.target[0] : c.l <= i.target[1];
  const stopPx = sign === 1 ? i.stop[1] : i.stop[0];
  const targetPx = sign === 1 ? i.target[0] : i.target[1];

  for (const c of bars.slice(fillIdx + 1)) {
    if (hitStop(c)) return exited(i, base, 'stop', stopPx, c.t, sign);
    if (hitTarget(c)) return exited(i, base, 'target', targetPx, c.t, sign);
  }
  const last = bars[bars.length - 1];
  if (!finished || last === undefined) return {outcome: 'open', ...base};
  return exited(i, base, 'expired', last.c, last.t, sign);
}

function touchedTarget2(
  i: ResolveRecommendationInput,
  bars: readonly RecommendationCandle[],
  fillIdx: number,
  sign: 1 | -1,
): number | undefined {
  if (!i.target2) return undefined;
  for (const c of bars.slice(fillIdx + 1)) {
    if (sign === 1 ? c.l <= i.stop[1] : c.h >= i.stop[0]) return undefined; // stop first: the scan ends
    if (sign === 1 ? c.h >= i.target2[0] : c.l <= i.target2[1]) return c.t;
  }
  return undefined;
}

function exited(
  i: ResolveRecommendationInput,
  base: Filled,
  outcome: 'target' | 'stop' | 'expired',
  exitPrice: number,
  exitAt: number,
  sign: 1 | -1,
): RecommendationResolution {
  const qty = positionQty(i.kind, base.fillPrice);
  const move = (exitPrice - base.fillPrice) * sign;
  return {
    outcome,
    ...base,
    exitPrice,
    exitAt,
    pnl: round(move * qty, 2),
    returnPct: round((move / base.fillPrice) * 100, 3),
  };
}
