import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {Recommendation} from '../../types/market.ts';
import {
  type RecommendationCandle,
  type RecommendationResolution,
  resolveRecommendation,
} from '../recommendationResolve.ts';
import {
  isUsableCandle,
  liveClosedOutcome,
  liveResolution,
  liveResolutionOver,
  mergeResolverCandles,
  outcomeOf,
  resolverCandles,
  resolverCandlesFrom,
  withLiveResolution,
} from '../recommendationView.ts';

// 2026-10-21 06:00Z (11:30 AM IST), a minute boundary: the pick is published then, valid an hour.
const T0 = Date.UTC(2026, 9, 21, 6, 0) / 1000;
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();
const bar = (
  min: number,
  o: number,
  h: number,
  l: number,
  c: number,
): RecommendationCandle => ({t: T0 + min * 60, o, h, l, c});

/** RELIANCE long: entry 100–101, stop 95–96, target 110–112, target 2 120–125; as the reader reads it. */
const pick = (fields: Partial<Recommendation> = {}): Recommendation => ({
  id: 1,
  stock_symbol: 'RELIANCE',
  market: 'IN',
  kind: 'equity',
  horizon: 'intraday',
  direction: 'long',
  verdict: 'Buy',
  tone: 'pos',
  remark: null,
  rationale: '',
  entry_min: 100,
  entry_max: 101,
  stop_loss: 96,
  stop_loss_zone: [95, 96],
  target_price: 110,
  target_zone: [110, 112],
  cmp: null,
  ref_price: 100.5,
  ref_basis: 'entry_mid',
  upside_pct: ((110 - 100.5) / 100.5) * 100,
  risk_reward: 9.5 / 4.5,
  hold_label: 'Same day',
  status: 'active',
  published_at: iso(T0),
  valid_until: iso(T0 + 3600),
  modify_zone: null,
  modify_note: null,
  target2_zone: [120, 125],
  target2_price: 120,
  ...fields,
});

const NOW = (T0 + 600) * 1000;
const filled = bar(0, 100.5, 102, 100, 101);

test('an open pick reads its fill, exit and target 2 touch live, as web’s view does', () => {
  const rec = pick();
  const candles = [
    filled,
    bar(1, 101, 111, 100.5, 110),
    bar(2, 110, 121, 109, 120),
  ];
  const live = liveResolution(rec, candles, NOW);
  assert.equal(live?.outcome, 'target');
  const view = withLiveResolution(rec, live);
  assert.equal(view.outcome, 'target');
  assert.equal(view.entered_at, iso(T0));
  assert.equal(view.entry_price, 100.5);
  assert.equal(view.position_qty, 99);
  assert.equal(view.exited_at, iso(T0 + 60));
  assert.equal(view.resolved_price, 110);
  assert.equal(view.realized_pnl, 940.5);
  assert.equal(view.target2_hit_at, iso(T0 + 120));
  // The exit is the price its figures are read at, as a closed row's is.
  assert.equal(view.ref_price, 110);
  assert.equal(view.ref_basis, 'exit');
  assert.equal(view.upside_pct, 0);
  // Never the server's status, the plan, the deadline or a price an order would use.
  for (const key of [
    'status',
    'cmp',
    'direction',
    'entry_min',
    'entry_max',
    'stop_loss',
    'target_price',
    'stop_loss_zone',
    'target_zone',
    'target2_price',
    'valid_until',
    'published_at',
  ] as const) {
    assert.deepEqual(view[key], rec[key], key);
  }
  // The row it was read from is left as it was.
  assert.equal(rec.outcome, undefined);
  assert.equal(rec.entered_at, undefined);
});

test('while open the stored entry gives way to the live one, and a pick not yet filled has none', () => {
  const stored = pick({entered_at: iso(T0 - 86_400), entry_price: 99});
  const waiting = withLiveResolution(
    stored,
    liveResolution(stored, [bar(0, 105, 106, 104, 105)], NOW),
  );
  assert.equal(waiting.outcome, 'waiting');
  assert.equal(waiting.entered_at, undefined);
  assert.equal(waiting.entry_price, undefined);
  assert.equal(waiting.position_qty, undefined);
  assert.equal(waiting.ref_basis, 'entry_mid');
  const open = withLiveResolution(
    stored,
    liveResolution(stored, [filled], NOW),
  );
  assert.equal(open.outcome, 'open');
  assert.equal(open.entered_at, iso(T0));
  assert.equal(open.entry_price, 100.5);
  assert.equal(open.exited_at, undefined);
  assert.equal(open.target2_hit_at, undefined);
});

test('a closed row keeps what the server stored, and no resolution leaves a row as read', () => {
  const closed = pick({
    status: 'hit_target',
    entered_at: iso(T0),
    entry_price: 100.2,
    exited_at: iso(T0 + 600),
    resolved_price: 110,
    ref_price: 110,
    ref_basis: 'exit',
  });
  assert.equal(
    liveResolution(closed, [filled, bar(1, 101, 101, 94, 95)], NOW),
    null,
  );
  const stop = liveResolution(pick(), [filled, bar(1, 101, 101, 94, 95)], NOW);
  assert.equal(stop?.outcome, 'stop');
  assert.equal(withLiveResolution(closed, stop), closed);
  const rec = pick({entered_at: iso(T0), entry_price: 100.4});
  assert.equal(withLiveResolution(rec, null), rec);
});

test('no bar between publication and valid_until says nothing: null, never waiting', () => {
  const rec = pick();
  assert.equal(liveResolution(rec, [], NOW), null);
  // Only bars before its publication minute, or after its valid_until.
  assert.equal(
    liveResolution(
      rec,
      [bar(-1, 100, 101, 94, 95), bar(61, 100, 101, 94, 95)],
      NOW,
    ),
    null,
  );
  // Past valid_until with no bar at all is still unknown, not "not triggered".
  assert.equal(liveResolution(rec, [], (T0 + 7200) * 1000), null);
  // A stamp that cannot be read resolves nothing.
  assert.equal(
    liveResolution(pick({published_at: 'soon'}), [filled], NOW),
    null,
  );
  assert.equal(liveResolution(pick({valid_until: ''}), [filled], NOW), null);
});

test('bars that cannot be read are dropped: a 0 or NaN low is no stop, and order does not matter', () => {
  assert.equal(isUsableCandle(filled), true);
  assert.equal(isUsableCandle(bar(1, 100, 101, 0, 100)), false);
  assert.equal(isUsableCandle(bar(1, 100, 101, Number.NaN, 100)), false);
  assert.equal(isUsableCandle(bar(1, Number.NaN, 101, 99, 100)), false);
  assert.equal(isUsableCandle(bar(1, 100, 99, 101, 100)), false);
  assert.equal(isUsableCandle({...filled, t: Number.NaN}), false);
  assert.equal(isUsableCandle(bar(1, -1, 101, 99, 100)), false);
  const rec = pick();
  const live = liveResolution(
    rec,
    [bar(2, 100, 101, 0, 100), bar(3, 100, 101, Number.NaN, 100), filled],
    NOW,
  );
  assert.equal(live?.outcome, 'open');
  assert.equal(live?.fillPrice, 100.5);
  // Given newest first, read oldest first.
  const stop = liveResolution(rec, [bar(1, 101, 101, 94, 95), filled], NOW);
  assert.equal(stop?.outcome, 'stop');
  // Only unreadable bars in the window: nothing is known.
  assert.equal(liveResolution(rec, [bar(1, 0, 0, 0, 0)], NOW), null);
});

test('a minute given twice is one bar, its last usable copy: a fill bar that dipped to the stop does not close the call on itself', () => {
  const rec = pick();
  // The review's probe: the fill bar also reaches the stop (95.5 ≤ 96). Read once it is only the
  // fill, as the rules say; read twice its second copy would be the bar after the fill, a stop.
  const fillTouchingStop = bar(0, 100.5, 101, 95.5, 100.8);
  assert.equal(liveResolution(rec, [fillTouchingStop], NOW)?.outcome, 'open');
  const duplicated = liveResolution(
    rec,
    [fillTouchingStop, {...fillTouchingStop}],
    NOW,
  );
  assert.equal(duplicated?.outcome, 'open');
  assert.equal(duplicated?.fillAt, T0);
  assert.equal(duplicated?.exitAt, undefined);
  // Two different copies of one minute: the last one given is the minute.
  const quiet = bar(1, 101, 102, 100.5, 101.5);
  const dipped = bar(1, 101, 102, 95, 96);
  assert.equal(
    liveResolution(rec, [filled, dipped, quiet], NOW)?.outcome,
    'open',
  );
  assert.equal(
    liveResolution(rec, [filled, quiet, dipped], NOW)?.outcome,
    'stop',
  );
  // A copy that cannot be read is no copy: the readable one stands.
  assert.equal(
    liveResolution(rec, [filled, dipped, bar(1, 0, 0, 0, 0)], NOW)?.outcome,
    'stop',
  );
});

test('a short and a commodity resolve on their own rules', () => {
  const short = pick({
    direction: 'short',
    verdict: 'Sell',
    tone: 'cau',
    stop_loss: 106,
    stop_loss_zone: [106, 107],
    target_price: 92,
    target_zone: [90, 92],
    target2_zone: [80, 85],
    target2_price: 85,
  });
  const view = withLiveResolution(
    short,
    liveResolution(
      short,
      [bar(0, 100, 101, 100, 100), bar(1, 99, 99, 89, 90)],
      NOW,
    ),
  );
  assert.equal(view.outcome, 'target');
  assert.equal(view.resolved_price, 92);
  assert.equal(view.upside_pct, 0);
  const commodity = pick({kind: 'commodity'});
  const lot = withLiveResolution(
    commodity,
    liveResolution(commodity, [filled, bar(1, 101, 111, 100.5, 110)], NOW),
  );
  assert.equal(lot.position_qty, 1);
  assert.equal(lot.realized_pnl, 9.5);
});

test('target 2 is flagged only on a call that has one', () => {
  const none: Recommendation = pick();
  delete none.target2_zone;
  delete none.target2_price;
  const view = withLiveResolution(
    none,
    liveResolution(none, [filled, bar(1, 101, 130, 100.5, 125)], NOW),
  );
  assert.equal(view.outcome, 'target');
  assert.equal(view.target2_hit_at, undefined);
  // A stored touch on an open row gives way to the live reading too.
  const stored = pick({target2_hit_at: iso(T0 - 60)});
  assert.equal(
    withLiveResolution(stored, liveResolution(stored, [filled], NOW))
      .target2_hit_at,
    undefined,
  );
});

test('the outcomes that close a pick, live, and a closed row’s as web reads it', () => {
  const at = (outcome: NonNullable<Recommendation['outcome']>) =>
    liveClosedOutcome(pick({outcome}));
  assert.equal(liveClosedOutcome(pick()), null);
  assert.equal(at('waiting'), null);
  assert.equal(at('open'), null);
  assert.equal(at('target'), 'target');
  assert.equal(at('stop'), 'stop');
  assert.equal(at('expired'), 'expired');
  assert.equal(at('not_triggered'), 'not_triggered');
  // A row the server has closed is not closed "live": its status speaks for it.
  assert.equal(
    liveClosedOutcome(pick({status: 'hit_stop', outcome: 'stop'})),
    null,
  );

  assert.equal(outcomeOf(pick()), null);
  assert.equal(outcomeOf(pick({outcome: 'open'})), 'open');
  assert.equal(outcomeOf(pick({status: 'hit_target'})), 'target');
  assert.equal(outcomeOf(pick({status: 'hit_stop'})), 'stop');
  assert.equal(
    outcomeOf(pick({status: 'expired', resolved_price: 104})),
    'expired',
  );
  assert.equal(outcomeOf(pick({status: 'expired'})), 'not_triggered');
});

test('past valid_until a filled pick expires at its last close, and an unfilled one never triggered', () => {
  const after = (T0 + 3601) * 1000;
  const rec = pick();
  const expired = withLiveResolution(
    rec,
    liveResolution(rec, [filled, bar(30, 102, 103, 101.5, 102)], after),
  );
  assert.equal(expired.outcome, 'expired');
  assert.equal(expired.resolved_price, 102);
  assert.equal(expired.exited_at, iso(T0 + 1800));
  assert.equal(liveClosedOutcome(expired), 'expired');
  const never = withLiveResolution(
    rec,
    liveResolution(rec, [bar(0, 120, 121, 119, 120)], after),
  );
  assert.equal(never.outcome, 'not_triggered');
  assert.equal(never.exited_at, undefined);
  assert.equal(never.ref_basis, 'entry_mid');
  assert.equal(liveClosedOutcome(never), 'not_triggered');
});

test('bars read once: the unreadable dropped, one per minute (its last copy given), oldest first', () => {
  const read = resolverCandles([
    bar(3, 101, 102, 100, 101),
    bar(1, 100, 101, 0, 100),
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 101, 99.5, 100.5),
    bar(1, 100, 103, 98, 102),
  ]);
  assert.deepEqual(read, [
    bar(1, 100, 103, 98, 102),
    bar(2, 100, 101, 99.5, 100.5),
    bar(3, 101, 102, 100, 101),
  ]);
  assert.deepEqual(resolverCandles([]), []);
});

test('a series kept from a minute on, and two series as one, the later one taking a minute both carry', () => {
  const series = resolverCandles(
    [0, 1, 2, 3, 5].map(m => bar(m, 100, 101, 99, 100)),
  );
  // From before the first bar: the same series, not a copy.
  assert.equal(resolverCandlesFrom(series, T0 - 600), series);
  assert.deepEqual(
    resolverCandlesFrom(series, T0 + 120).map(c => c.t),
    [T0 + 120, T0 + 180, T0 + 300],
  );
  // Between two bars: from the next one.
  assert.deepEqual(
    resolverCandlesFrom(series, T0 + 240).map(c => c.t),
    [T0 + 300],
  );
  assert.deepEqual(resolverCandlesFrom(series, T0 + 301), []);

  // The days before (asked once) under today's session (polled): a minute both carry is today's.
  const earlier = resolverCandles([
    bar(0, 100, 101, 99, 100),
    bar(1, 100, 101, 99, 100),
    bar(2, 100, 101, 99, 100.2),
    bar(4, 100, 101, 99, 100),
  ]);
  const later = resolverCandles([
    bar(2, 100, 101.5, 98, 101),
    bar(3, 101, 102, 100, 101.5),
    bar(6, 101, 102, 100, 101.5),
  ]);
  const merged = mergeResolverCandles(earlier, later);
  assert.deepEqual(merged, resolverCandles([...earlier, ...later]));
  assert.deepEqual(
    merged.map(c => c.t),
    [0, 1, 2, 3, 4, 6].map(m => T0 + m * 60),
  );
  assert.equal(merged[2]?.c, 101);
  // Either side empty: the other, as it is.
  const none = resolverCandles([]);
  assert.equal(mergeResolverCandles(earlier, none), earlier);
  assert.equal(mergeResolverCandles(none, later), later);
  // Wholly before, or wholly after.
  assert.deepEqual(
    mergeResolverCandles(
      resolverCandlesFrom(earlier, T0),
      resolverCandles([bar(9, 100, 101, 99, 100)]),
    ).map(c => c.t),
    [0, 1, 2, 4, 9].map(m => T0 + m * 60),
  );
  assert.deepEqual(
    mergeResolverCandles(
      resolverCandles([bar(9, 100, 101, 99, 100)]),
      earlier,
    ).map(c => c.t),
    [0, 1, 2, 4, 9].map(m => T0 + m * 60),
  );
});

/**
 * The live resolution as it read its bars before they could be read once: every bar given, the
 * unreadable dropped, one per minute (its last copy), sorted, and the whole run handed to the
 * resolver, which keeps only the pick's window itself.
 */
function resolvedFromAllBars(
  rec: Recommendation,
  candles: readonly RecommendationCandle[],
  now: number,
): RecommendationResolution | null {
  if (rec.status !== 'active') return null;
  const publishedAt = Date.parse(rec.published_at) / 1000;
  const validUntil = Date.parse(rec.valid_until) / 1000;
  const byMinute = new Map<number, RecommendationCandle>();
  for (const c of candles) if (isUsableCandle(c)) byMinute.set(c.t, c);
  const bars = [...byMinute.values()].sort((a, b) => a.t - b.t);
  const firstMinute = Math.floor(publishedAt / 60) * 60;
  if (!bars.some(c => c.t >= firstMinute && c.t <= validUntil)) return null;
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
    candles: bars,
  });
}

test('over bars read once, kept from the publication minute and merged, every pick resolves as from all its bars', () => {
  // A seeded walk: the same 400 cases on every run.
  let seed = 7;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const outcomes = new Set<string>();
  for (let n = 0; n < 400; n += 1) {
    const raw: RecommendationCandle[] = [];
    let price = 100;
    for (let m = -30; m < 150; m += 1) {
      if (random() < 0.15) continue; // a gap
      price += (random() - 0.5) * 3;
      const high = price + random() * 2;
      const low = price - random() * 2;
      raw.push(bar(m, price, high, low, price + (random() - 0.5)));
      // Now and then a minute sent twice, or a broken bar.
      if (random() < 0.05) raw.push(bar(m, price, high + 1, low - 1, price));
      if (random() < 0.03) raw.push(bar(m, 0, 0, 0, 0));
    }
    const isShort = random() < 0.4;
    const rec = pick({
      direction: isShort ? 'short' : 'long',
      // Now and then published after the last bar: nothing is known.
      published_at: iso(
        T0 + (random() < 0.05 ? 160 : Math.floor(random() * 40)) * 60 + 17,
      ),
      valid_until: iso(T0 + 3600 + Math.floor(random() * 2400)),
      ...(isShort
        ? {
            stop_loss_zone: [105, 106],
            target_zone: [90, 92],
            target2_zone: [84, 86],
          }
        : {}),
    });
    const now = (T0 + Math.floor(random() * 9000)) * 1000;
    const cut = Math.floor(random() * raw.length);
    const earlier = resolverCandles(raw.slice(0, cut));
    const later = resolverCandles(raw.slice(cut));
    const firstMinute = Math.floor(Date.parse(rec.published_at) / 60_000) * 60;
    const kept = mergeResolverCandles(
      resolverCandlesFrom(earlier, firstMinute - Math.floor(random() * 5) * 60),
      later,
    );
    const expected = resolvedFromAllBars(rec, raw, now);
    assert.deepEqual(liveResolutionOver(rec, kept, now), expected);
    assert.deepEqual(liveResolution(rec, raw, now), expected);
    outcomes.add(expected?.outcome ?? 'unknown');
  }
  // The walk reaches every outcome, so the sameness is not of one kind of case only.
  assert.deepEqual([...outcomes].sort(), [
    'expired',
    'not_triggered',
    'open',
    'stop',
    'target',
    'unknown',
    'waiting',
  ]);
});
