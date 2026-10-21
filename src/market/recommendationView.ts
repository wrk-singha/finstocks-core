import {parseTimestamp} from '../format/date.ts';
import type {Recommendation, RecommendationOutcome} from '../types/market.ts';
import {
  positionQty,
  type RecommendationCandle,
  type RecommendationResolution,
  resolveRecommendation,
} from './recommendationResolve.ts';

/**
 * How a live resolution combines with a pick as the reader read it: web's
 * `utils/market/recommendationView.ts` (`toRecommendation`, main f72ddef6), over core's
 * `Recommendation` rather than the raw row. While the server has the row open its call record (the
 * fill, the exit, the target 2 touch, the outcome) comes from the candles; once it is closed, from
 * what the server stored, and the candles are not read.
 *
 * Unlike web it never touches `status` or `cmp`: `status` stays the server's, so what the app
 * gates on the server's word (`isPickExpired`) reads exactly as without candles, and the price a
 * pick is bought at stays the app's own live quote. A live close is said by `outcome`
 * (`liveClosedOutcome`).
 */

/** The outcomes that close a call: no longer a trade to take. */
export type ClosedOutcome = Extract<
  RecommendationOutcome,
  'target' | 'stop' | 'expired' | 'not_triggered'
>;

const CLOSED: ReadonlySet<RecommendationOutcome> = new Set<ClosedOutcome>([
  'target',
  'stop',
  'expired',
  'not_triggered',
]);

const isClosedOutcome = (
  outcome: RecommendationOutcome | undefined,
): outcome is ClosedOutcome => outcome !== undefined && CLOSED.has(outcome);

const isPrice = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Whether a bar can be read at all: a time and four positive prices, its low no higher than its
 * high. A bar that cannot (a gap filled with zeros, a NaN from a broken row) is not a price that
 * traded: a 0 low would read as every long's stop hit.
 */
export const isUsableCandle = (c: RecommendationCandle): boolean =>
  Number.isFinite(c.t) &&
  isPrice(c.o) &&
  isPrice(c.h) &&
  isPrice(c.l) &&
  isPrice(c.c) &&
  c.l <= c.h;

declare const readOnce: unique symbol;

/**
 * Minute bars as the live resolution reads them: usable ones only (`isUsableCandle`), one per
 * minute, ascending. Made by `resolverCandles` and kept so by `resolverCandlesFrom` and
 * `mergeResolverCandles`, so a caller holding a long series reads and sorts it once per answer,
 * and `liveResolutionOver` then walks only a pick's own window of it, however often it is asked.
 */
export type ResolverCandles = readonly RecommendationCandle[] & {
  readonly [readOnce]: true;
};

const asRead = (bars: readonly RecommendationCandle[]): ResolverCandles =>
  bars as ResolverCandles;

/**
 * `candles` (any order) as the live resolution reads them: a bar that cannot be read dropped, and
 * one bar per minute, its last usable copy given. Read twice, a fill bar that dipped to the stop
 * would be its own next bar and close the call on itself.
 */
export function resolverCandles(
  candles: readonly RecommendationCandle[],
): ResolverCandles {
  const byMinute = new Map<number, RecommendationCandle>();
  for (const c of candles) if (isUsableCandle(c)) byMinute.set(c.t, c);
  return asRead([...byMinute.values()].sort((a, b) => a.t - b.t));
}

/** The index of the first bar at or after `t` (strictly after, with `isAfter`); the length when none is. */
function indexFrom(bars: ResolverCandles, t: number, isAfter = false): number {
  let low = 0;
  let high = bars.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const at = bars[mid]?.t ?? Number.POSITIVE_INFINITY;
    if (isAfter ? at <= t : at < t) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * The bars from `t` (epoch seconds) on: all a caller keeps of a series for picks published from
 * then, since no bar before a pick's publication minute is its. The same array when none is before.
 */
export function resolverCandlesFrom(
  bars: ResolverCandles,
  t: number,
): ResolverCandles {
  const from = indexFrom(bars, t);
  return from === 0 ? bars : asRead(bars.slice(from));
}

/**
 * Two series as one, a minute both carry taking `later`'s bar (a later answer's minute may have
 * moved on since): the days before today, asked once, under today's session, polled. Everything
 * before `later`'s first minute is `earlier`'s alone and copied as it is; nothing is sorted again.
 */
export function mergeResolverCandles(
  earlier: ResolverCandles,
  later: ResolverCandles,
): ResolverCandles {
  const first = later[0];
  if (first === undefined) return earlier;
  if (earlier.length === 0) return later;
  let i = indexFrom(earlier, first.t);
  let j = 0;
  const out = earlier.slice(0, i);
  while (i < earlier.length || j < later.length) {
    const a = earlier[i];
    const b = later[j];
    if (b === undefined || (a !== undefined && a.t < b.t)) {
      if (a !== undefined) out.push(a);
      i += 1;
    } else {
      if (a?.t === b.t) i += 1;
      out.push(b);
      j += 1;
    }
  }
  return asRead(out);
}

/**
 * The live resolution of an open pick from `candles` (any order) at `now` (epoch ms), or null when
 * the candles say nothing about it: the pick is not open on the server, a stamp cannot be read, or
 * no usable bar falls between its publication minute and its valid_until. Null is "unknown", never
 * "waiting": a pick with no candles reads as the reader read it.
 *
 * The caller hands over the bars since the pick was published, all of them: a run missing its
 * start can fill the pick on a later bar than it did. A minute given more than once is read once,
 * as its last usable copy (`resolverCandles`).
 */
export function liveResolution(
  rec: Recommendation,
  candles: readonly RecommendationCandle[],
  now: number,
): RecommendationResolution | null {
  return liveResolutionOver(rec, resolverCandles(candles), now);
}

/**
 * `liveResolution` over bars already read (`resolverCandles`): nothing is filtered or sorted again,
 * and only the bars from the pick's publication minute to its valid_until are walked, which are all
 * the rules read. The same answer as `liveResolution` gives for the same bars.
 */
export function liveResolutionOver(
  rec: Recommendation,
  bars: ResolverCandles,
  now: number,
): RecommendationResolution | null {
  if (rec.status !== 'active') return null;
  const published = parseTimestamp(rec.published_at);
  const until = parseTimestamp(rec.valid_until);
  if (published === null || until === null) return null;
  const publishedAt = published.getTime() / 1000;
  const validUntil = until.getTime() / 1000;
  if (!Number.isFinite(publishedAt) || !Number.isFinite(validUntil))
    return null;
  const firstMinute = Math.floor(publishedAt / 60) * 60;
  const window = bars.slice(
    indexFrom(bars, firstMinute),
    indexFrom(bars, validUntil, true),
  );
  if (window.length === 0) return null;
  return resolveRecommendation({
    direction: rec.direction,
    kind: rec.kind === 'commodity' ? 'commodity' : 'equity',
    entry: [rec.entry_min, rec.entry_max],
    stop: rec.stop_loss_zone,
    target: rec.target_zone,
    target2: rec.target2_zone,
    publishedAt,
    validUntil,
    now: now / 1000,
    candles: window,
  });
}

const isoOf = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toISOString();

/**
 * `rec` with `live` laid over it, as web's `toRecommendation` combines a row and its resolution:
 * while the server has the row open, its fill (`entered_at`, `entry_price`, `position_qty`), exit
 * (`exited_at`, `resolved_price`, `realized_pnl`, and the exit as its `ref_price`), target 2 touch
 * and `outcome` are the live ones, and what the server stored for them is set aside. A closed row,
 * or no resolution, is returned as it is. A new object; `rec` is not changed.
 *
 * The plan, the side, `status`, `valid_until` and `cmp` are never touched: nothing here reaches an
 * order, and nothing here can make a pick the server's word holds back takeable again.
 */
export function withLiveResolution(
  rec: Recommendation,
  live: RecommendationResolution | null,
): Recommendation {
  if (rec.status !== 'active' || live === null) return rec;
  const view: Recommendation = {...rec, outcome: live.outcome};
  delete view.entered_at;
  delete view.entry_price;
  delete view.position_qty;
  delete view.exited_at;
  delete view.resolved_price;
  delete view.realized_pnl;
  delete view.target2_hit_at;
  if (live.fillAt !== undefined && live.fillPrice !== undefined) {
    view.entered_at = isoOf(live.fillAt);
    view.entry_price = live.fillPrice;
    view.position_qty = positionQty(rec.kind, live.fillPrice);
  }
  if (live.exitAt !== undefined && live.exitPrice !== undefined) {
    const exit = live.exitPrice;
    view.exited_at = isoOf(live.exitAt);
    view.resolved_price = exit;
    view.ref_price = exit;
    view.ref_basis = 'exit';
    view.upside_pct =
      ((rec.direction === 'short'
        ? exit - rec.target_price
        : rec.target_price - exit) /
        exit) *
      100;
  }
  if (live.pnl !== undefined) view.realized_pnl = live.pnl;
  if (live.t2At !== undefined && rec.target2_price !== undefined)
    view.target2_hit_at = isoOf(live.t2At);
  return view;
}

/**
 * The outcome that closed a pick the server still has open, by its live resolution; null while it
 * is waiting or in trade, when no resolution is known, and for a row the server has closed (whose
 * own status speaks for it).
 */
export const liveClosedOutcome = (
  rec: Pick<Recommendation, 'status' | 'outcome'>,
): ClosedOutcome | null =>
  rec.status === 'active' && isClosedOutcome(rec.outcome) ? rec.outcome : null;

/**
 * Where a pick stands, for display: its live outcome over an open row, or, for a row the server has
 * closed, its stored one as web reads it (no exit price is `not_triggered`). Null for an open row
 * with no resolution known.
 */
export function outcomeOf(
  rec: Pick<Recommendation, 'status' | 'outcome' | 'resolved_price'>,
): RecommendationOutcome | null {
  if (rec.status === 'active') return rec.outcome ?? null;
  if (rec.status === 'hit_target') return 'target';
  if (rec.status === 'hit_stop') return 'stop';
  return rec.resolved_price === undefined ? 'not_triggered' : 'expired';
}
