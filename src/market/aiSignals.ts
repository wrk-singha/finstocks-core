import type {
  AISignal,
  AISignalsRequestBar,
  AISignalsResponse,
} from '../types/aiSignals.ts';
import type {ComputedBar} from '../types/chartPlan.ts';
import type {OrderSide} from '../types/trade.ts';
import {isMarketOpen} from './marketHours.ts';

const DAY = 86_400;

/** The pivot overlays the Signals panel toggles, in the order its chips list them. */
export type AIPivotLayer =
  'structural' | 'classical' | 'fibonacci' | 'camarilla';

export const AI_PIVOT_LAYERS: readonly AIPivotLayer[] = [
  'structural',
  'classical',
  'fibonacci',
  'camarilla',
];

/**
 * The most bars the engine reads: its replay window plus the largest profile buffer
 * (`maxReplayBars` + `BufferBars` in backend-go/aisignals). Older bars change nothing, so sending
 * them only costs upload on every closed candle.
 */
export const AI_SIGNALS_MAX_BARS = 1750;

/** The confidence floor a response is read against when it names none of its own. */
export const AI_SIGNALS_MIN_CONFIDENCE = 0.6;

export type AISignalTone = 'wait' | 'live' | 'win' | 'loss' | 'muted';

/** What a signal's status pill says, as a key each app words for itself. */
export type AISignalStatusKey =
  | 'watching'
  | 'live'
  | 'target1'
  | 'target2'
  | 'stopped'
  | 'stoppedAfterT1'
  | 'closed'
  | 'lapsed'
  | 'invalidated'
  | 'belowThreshold';

export interface AISignalStatus {
  key: AISignalStatusKey;
  tone: AISignalTone;
}

/**
 * Where a signal stands. An armed setup is "watching" — formed, waiting for a candle to close
 * through its entry; a triggered one reads by its outcome, a stop taken after target 1 apart from
 * one taken before it.
 */
export function signalStatusOf(signal: AISignal): AISignalStatus {
  switch (signal.state) {
    case 'armed':
      return {key: 'watching', tone: 'wait'};
    case 'triggered': {
      const outcome = signal.outcome;
      if (outcome?.hit_stop) {
        return {
          key: outcome.hit_t1 ? 'stoppedAfterT1' : 'stopped',
          tone: 'loss',
        };
      }
      if (outcome?.hit_t2) return {key: 'target2', tone: 'win'};
      if (outcome?.hit_t1) return {key: 'target1', tone: 'win'};
      if (outcome?.closed) return {key: 'closed', tone: 'muted'};
      return {key: 'live', tone: 'live'};
    }
    case 'expired':
      return {key: 'lapsed', tone: 'muted'};
    case 'invalidated':
      return {key: 'invalidated', tone: 'muted'};
    default:
      return {key: 'belowThreshold', tone: 'muted'};
  }
}

export const tradeSideOf = (signal: AISignal): OrderSide =>
  signal.direction === 'long' ? 'BUY' : 'SELL';

/** Broke out and still running: no stop, final target or horizon has closed it yet. */
export const isLiveTrade = (signal: AISignal): boolean =>
  signal.state === 'triggered' && signal.outcome?.closed !== true;

/** A setup worth acting on now: confident enough, and either waiting for its entry or live. */
export function isActionable(signal: AISignal, minConfidence: number): boolean {
  if (signal.confidence < minConfidence) return false;
  return signal.state === 'armed' || isLiveTrade(signal);
}

export interface AISignalTrackRecord {
  /** Setups that broke out and carry an outcome to judge. */
  triggered: number;
  reachedT1: number;
  /** Stopped out before target 1; a stop after it is a partial win, not a loss. */
  stopped: number;
  /** The mean R of the closed ones; null until one has closed. */
  avgR: number | null;
}

/** How the setups on one chart fared once they broke out. */
export function trackRecord(signals: readonly AISignal[]): AISignalTrackRecord {
  let triggered = 0;
  let reachedT1 = 0;
  let stopped = 0;
  let closed = 0;
  let totalR = 0;
  for (const signal of signals) {
    const outcome = signal.outcome;
    if (signal.state !== 'triggered' || outcome === undefined) continue;
    triggered += 1;
    if (outcome.hit_t1) reachedT1 += 1;
    if (outcome.hit_stop && !outcome.hit_t1) stopped += 1;
    if (outcome.closed) {
      closed += 1;
      totalR += outcome.r_multiple;
    }
  }
  return {
    triggered,
    reachedT1,
    stopped,
    avgR: closed > 0 ? totalR / closed : null,
  };
}

export interface AISignalLists {
  active: AISignal[];
  history: AISignal[];
}

/**
 * What the Signals panel lists, each newest first: the setups worth acting on, then the ones that
 * ran their course. A shape below the threshold is in neither — it never passed every check.
 */
export function listSignals(
  response: Pick<AISignalsResponse, 'signals' | 'min_confidence'>,
): AISignalLists {
  const floor = Number.isFinite(response.min_confidence)
    ? response.min_confidence
    : AI_SIGNALS_MIN_CONFIDENCE;
  const newestFirst = [...response.signals].sort(
    (a, b) => b.end_time - a.end_time,
  );
  return {
    active: newestFirst.filter(signal => isActionable(signal, floor)),
    history: newestFirst.filter(
      signal => signal.state !== 'detected' && !isActionable(signal, floor),
    ),
  };
}

/** Whether any of the signal's span lies inside the visible range. */
export const isSignalInView = (
  signal: AISignal,
  view: {readonly from: number; readonly to: number},
): boolean => signal.end_time >= view.from && signal.start_time <= view.to;

/** What one pivot layer draws: the confirmed swings joined as a line, or a set's named levels. */
export interface AIPivotSource {
  swings?: {time: number; price: number}[];
  levels?: Record<string, number>;
}

export function pivotLayerSource(
  response: Pick<AISignalsResponse, 'pivots' | 'standard_pivots'>,
  layer: AIPivotLayer,
): AIPivotSource {
  if (layer === 'structural') {
    return {
      swings: response.pivots
        .filter(swing => swing.confirmed)
        .map(swing => ({time: swing.time, price: swing.price})),
    };
  }
  return {levels: response.standard_pivots?.[layer] ?? {}};
}

/** Seconds per bar for an interval token ("5m", "2h", "1d", "1w"); 0 when not fixed, as a month. */
export function intervalSeconds(interval: string): number {
  const match = /^(\d+)([mhdwM])$/.exec(interval);
  const count = Number(match?.[1]);
  if (!Number.isFinite(count) || count <= 0) return 0;
  switch (match?.[2]) {
    case 'm':
      return count * 60;
    case 'h':
      return count * 3600;
    case 'd':
      return count * DAY;
    case 'w':
      return count * 7 * DAY;
    default:
      return 0;
  }
}

type TimedBar = Pick<ComputedBar, 'time'>;
type OhlcvBar = Pick<
  ComputedBar,
  'time' | 'open' | 'high' | 'low' | 'close' | 'volume'
>;

/**
 * Whether the newest bar is still trading. The engine reads closed bars only — a pattern drawn on a
 * forming candle repaints — so that bar is left out. An intraday bucket is forming until its
 * interval has elapsed; a daily or longer one while the session that feeds it is open.
 */
export function lastBarForming(
  bars: readonly TimedBar[],
  step: number,
  nowSec: number = Date.now() / 1000,
): boolean {
  const last = bars.at(-1);
  if (last === undefined) return false;
  if (step > 0 && step < DAY) return nowSec < last.time + step;
  return (
    isMarketOpen('IN', new Date(nowSec * 1000)) &&
    nowSec - last.time < (step > 0 ? step : 31 * DAY)
  );
}

/** Names the first `count` bars of a series without holding them: a new closed bar is a new key. */
export function closedBarsKey(
  bars: readonly TimedBar[],
  count: number = bars.length,
): string {
  const first = bars[0];
  const last = bars[count - 1];
  return count <= 0 || first === undefined || last === undefined
    ? ''
    : `${count}:${first.time}:${last.time}`;
}

/** The newest bars, oldest first, up to one request's worth, in the engine's wire shape. */
export function aiSignalsRequestBars(
  bars: readonly OhlcvBar[],
): AISignalsRequestBar[] {
  const out: AISignalsRequestBar[] = [];
  for (
    let i = Math.max(0, bars.length - AI_SIGNALS_MAX_BARS);
    i < bars.length;
    i++
  ) {
    const bar = bars[i];
    if (bar === undefined) continue;
    const wire = {
      t: bar.time,
      o: bar.open,
      h: bar.high,
      l: bar.low,
      c: bar.close,
    };
    // A bar that traded nothing sends no volume rather than a zero the volume gate would read.
    out.push(bar.volume > 0 ? {...wire, v: bar.volume} : wire);
  }
  return out;
}

/** One request's worth of a chart's bars, and the key that says when to ask again. */
export interface AISignalsBars {
  bars: AISignalsRequestBar[];
  lastBarForming: boolean;
  /**
   * The closed bars only: a forming candle moving asks nothing new, and the session's close, which
   * closes today's daily bar without adding one, still asks again with that bar included.
   */
  closedKey: string;
}

export function aiSignalsBars(
  bars: readonly OhlcvBar[],
  step: number,
  nowSec?: number,
): AISignalsBars {
  const forming = lastBarForming(bars, step, nowSec);
  return {
    bars: aiSignalsRequestBars(bars),
    lastBarForming: forming,
    closedKey: closedBarsKey(bars, forming ? bars.length - 1 : bars.length),
  };
}
