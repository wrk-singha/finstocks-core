import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  positionQty,
  type RecommendationCandle,
  type ResolveRecommendationInput,
  resolveRecommendation,
} from '../recommendationResolve.ts';

// Web's shared vectors (frontend f72ddef6 `scripts/recommendationResolve.test.mjs`), unchanged: the
// dashboard's "Finalize day" (Python) must reproduce every expectation in this first block.

const T0 = 1_792_400_000 - (1_792_400_000 % 60); // a minute boundary
const bar = (
  min: number,
  o: number,
  h: number,
  l: number,
  c: number,
): RecommendationCandle => ({t: T0 + min * 60, o, h, l, c});
const base = {
  kind: 'equity',
  publishedAt: T0,
  validUntil: T0 + 3600,
  now: T0 + 7200,
} as const;
const LONG = {
  ...base,
  direction: 'long',
  entry: [100, 101],
  stop: [95, 96],
  target: [110, 112],
} as const;
const SHORT = {
  ...base,
  direction: 'short',
  entry: [100, 101],
  stop: [106, 107],
  target: [90, 92],
} as const;
const r = (i: ResolveRecommendationInput) => resolveRecommendation(i);

test('long: target hit, fill clamped into the zone', () => {
  const x = r({
    ...LONG,
    candles: [bar(0, 103, 104, 100.5, 101), bar(1, 101, 111, 100, 110)],
  });
  assert.equal(x.outcome, 'target');
  assert.equal(x.fillPrice, 101); // open 103 above zone -> entry_max
  assert.equal(x.exitPrice, 110); // target_min
  assert.equal(x.pnl, 891); // floor(10000/101)=99 * 9
  assert.equal(x.returnPct, 8.911);
});

test('long: stop hit', () => {
  const x = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(1, 100, 100, 94, 95)],
  });
  assert.equal(x.outcome, 'stop');
  assert.equal(x.exitPrice, 96); // stop_loss_max
  assert.equal(x.pnl, -400); // 100 * -4
});

test('stop wins when one candle hits both', () => {
  const x = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(1, 100, 115, 94, 100)],
  });
  assert.equal(x.outcome, 'stop');
});

test('no stop/target check on the fill candle itself', () => {
  const x = r({...LONG, candles: [bar(0, 100, 120, 90, 100)], now: T0 + 60});
  assert.equal(x.outcome, 'open');
});

test('expired exits at the last close at or before valid_until', () => {
  const x = r({
    ...LONG,
    candles: [
      bar(0, 100, 101, 100, 100.5),
      bar(30, 102, 103, 101.5, 102),
      bar(61, 150, 150, 150, 150),
    ],
  });
  assert.equal(x.outcome, 'expired');
  assert.equal(x.exitPrice, 102);
});

test('never filled: waiting while valid, not_triggered once over', () => {
  const candles = [bar(0, 120, 121, 119, 120)];
  assert.equal(r({...LONG, candles, now: T0 + 600}).outcome, 'waiting');
  assert.equal(r({...LONG, candles}).outcome, 'not_triggered');
});

test('short mirrors: stop at stop_loss_min, target at target_max', () => {
  const t = r({
    ...SHORT,
    candles: [bar(0, 100, 101, 100, 100), bar(1, 99, 99, 89, 90)],
  });
  assert.equal(t.outcome, 'target');
  assert.equal(t.exitPrice, 92);
  assert.equal(t.pnl, 800); // fill 100, qty 100, +8
  const s = r({
    ...SHORT,
    candles: [bar(0, 100, 101, 100, 100), bar(1, 100, 107, 100, 106)],
  });
  assert.equal(s.outcome, 'stop');
  assert.equal(s.exitPrice, 106);
  assert.equal(s.pnl, -600);
});

test('commodity trades one lot', () => {
  const x = r({
    ...LONG,
    kind: 'commodity',
    candles: [bar(0, 100, 101, 100, 100), bar(1, 100, 111, 100, 110)],
  });
  assert.equal(x.pnl, 10);
});

test('candles before publication are ignored', () => {
  const x = r({
    ...LONG,
    publishedAt: T0 + 600,
    candles: [bar(0, 100, 101, 99, 100), bar(1, 100, 111, 94, 100)],
    now: T0 + 700,
  });
  assert.equal(x.outcome, 'waiting');
});

test('target 2 is a flag, not an exit; a stop ends the scan', () => {
  const L2 = {...LONG, target2: [120, 125]} as const;
  let x = r({
    ...L2,
    candles: [
      bar(0, 100.5, 102, 100, 101),
      bar(1, 101, 111, 100.5, 110),
      bar(2, 110, 121, 109, 120),
    ],
  });
  assert.equal(x.outcome, 'target');
  assert.equal(x.exitPrice, 110); // exit stays at target 1
  assert.equal(x.fillAt, T0);
  assert.equal(x.t2At, T0 + 120);
  x = r({
    ...L2,
    candles: [
      bar(0, 100.5, 102, 100, 101),
      bar(1, 100, 101, 95, 96),
      bar(2, 96, 130, 96, 125),
    ],
  });
  assert.equal(x.outcome, 'stop');
  assert.equal(x.t2At, undefined);
  x = r({
    ...LONG,
    candles: [bar(0, 100.5, 102, 100, 101), bar(1, 101, 130, 100.5, 125)],
  });
  assert.equal(x.t2At, undefined); // call has no target 2
  const S2 = {...SHORT, target2: [80, 85]} as const;
  x = r({
    ...S2,
    candles: [
      bar(0, 100.5, 102, 100, 101),
      bar(1, 100, 101, 91, 91),
      bar(2, 91, 91, 84, 85),
    ],
  });
  assert.equal(x.outcome, 'target');
  assert.equal(x.t2At, T0 + 120);
});

// Edges beyond the shared vectors: what the rules above already imply, pinned so a port that
// drifts from them fails here. None of them is a new rule.

test('a gap in the bars: the next bar after it is judged, and the fill keeps its own time', () => {
  // No bars for minutes 2–40, then one that takes the stop.
  const x = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(41, 97, 97, 95.5, 96)],
  });
  assert.equal(x.outcome, 'stop');
  assert.equal(x.fillAt, T0);
  assert.equal(x.exitAt, T0 + 41 * 60);
  // A gap over valid_until: the exit is the last close before it, not the first bar after.
  const y = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(20, 104, 105, 103, 104.5)],
  });
  assert.equal(y.outcome, 'expired');
  assert.equal(y.exitPrice, 104.5);
  assert.equal(y.exitAt, T0 + 20 * 60);
});

test('a short bar reaching both its stop and its target exits at the stop', () => {
  const x = r({
    ...SHORT,
    candles: [bar(0, 100, 101, 100, 100), bar(1, 100, 108, 88, 95)],
  });
  assert.equal(x.outcome, 'stop');
  assert.equal(x.exitPrice, 106);
  assert.equal(x.pnl, -600);
});

test('a short fills at its open held inside the zone, and gains as price falls', () => {
  // Opens below the zone: held up to entry_min.
  const x = r({
    ...SHORT,
    candles: [bar(0, 99, 100.5, 98, 99.5), bar(1, 99, 99, 91, 91.5)],
  });
  assert.equal(x.fillPrice, 100);
  assert.equal(x.outcome, 'target');
  assert.equal(x.exitPrice, 92);
  assert.equal(x.returnPct, 8);
});

test('commodity and equity sizes: one unit, or the shares ₹10,000 buys at the fill', () => {
  assert.equal(positionQty('commodity', 5_480), 1);
  assert.equal(positionQty('equity', 101), 99);
  assert.equal(positionQty('equity', 12_000), 0);
  // A commodity stop is one unit's move.
  const x = r({
    ...LONG,
    kind: 'commodity',
    candles: [bar(0, 100, 101, 100, 100), bar(1, 100, 100, 94, 95)],
  });
  assert.equal(x.outcome, 'stop');
  assert.equal(x.pnl, -4);
});

test('the publication minute’s own bar counts; the one before it does not', () => {
  // Published 30 s into minute 5: minute 5's bar is the first that counts.
  const at = {...LONG, publishedAt: T0 + 5 * 60 + 30, now: T0 + 7 * 60};
  assert.equal(
    r({...at, candles: [bar(4, 100, 100.5, 99.5, 100)]}).outcome,
    'waiting',
  );
  const x = r({...at, candles: [bar(5, 100, 100.5, 99.5, 100)]});
  assert.equal(x.outcome, 'open');
  assert.equal(x.fillAt, T0 + 5 * 60);
  // A stop touched before publication is not this call's.
  const y = r({
    ...at,
    candles: [bar(4, 96, 96, 94, 95), bar(5, 100, 100.5, 99.5, 100)],
  });
  assert.equal(y.outcome, 'open');
});

test('no candles: waiting while valid, not triggered once over', () => {
  assert.equal(r({...LONG, candles: [], now: T0 + 60}).outcome, 'waiting');
  assert.deepEqual(r({...LONG, candles: []}), {outcome: 'not_triggered'});
});

test('bars after valid_until are not read: a stop or a fill there is not the call’s', () => {
  const stopAfter = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(61, 96, 96, 90, 91)],
  });
  assert.equal(stopAfter.outcome, 'expired');
  assert.equal(stopAfter.exitPrice, 100);
  // valid_until's own minute is read; the one after is not.
  const atUntil = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(60, 96, 96, 90, 91)],
  });
  assert.equal(atUntil.outcome, 'stop');
  const fillAfter = r({...LONG, candles: [bar(61, 100, 100.5, 99.5, 100)]});
  assert.equal(fillAfter.outcome, 'not_triggered');
  // Still valid at `now`: open, whatever later bars there are.
  assert.equal(
    r({...LONG, candles: [bar(0, 100, 100.5, 99.5, 100)], now: T0 + 3600})
      .outcome,
    'open',
  );
});

test('NaN prices fill nothing and close nothing: every comparison with one is false', () => {
  const nan = Number.NaN;
  const x = r({
    ...LONG,
    candles: [bar(0, nan, nan, nan, nan), bar(1, 100, 100.5, 99.5, 100)],
    now: T0 + 120,
  });
  assert.equal(x.outcome, 'open');
  assert.equal(x.fillAt, T0 + 60);
  const y = r({
    ...LONG,
    candles: [bar(0, 100, 100.5, 99.5, 100), bar(1, nan, nan, nan, nan)],
    now: T0 + 120,
  });
  assert.equal(y.outcome, 'open');
});

test('target 2 is flagged on a bar after the exit too, as long as no stop came first', () => {
  // The scan for target 2 runs past the target's exit (web's rule): only a stop ends it.
  const x = r({
    ...LONG,
    target2: [120, 125],
    candles: [
      bar(0, 100.5, 102, 100, 101),
      bar(1, 101, 111, 100.5, 110),
      bar(2, 110, 112, 109, 111),
      bar(3, 111, 121, 110, 120),
    ],
  });
  assert.equal(x.outcome, 'target');
  assert.equal(x.exitAt, T0 + 60);
  assert.equal(x.t2At, T0 + 180);
});

test('a neutral call is only ever waiting', () => {
  assert.deepEqual(
    r({
      ...LONG,
      direction: 'neutral',
      candles: [bar(0, 100, 100.5, 99.5, 100), bar(1, 100, 100, 94, 95)],
    }),
    {outcome: 'waiting'},
  );
});
