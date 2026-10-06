import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  type ExcursionBar,
  tradeExcursion,
  tripExcursions,
} from '../tradeExcursion.ts';

const MIN = 60_000;
const T0 = Date.parse('2026-09-01T03:45:00Z');

/** Minute candles from T0, each [low, high]. */
const minutes = (ranges: readonly [number, number][]): ExcursionBar[] =>
  ranges.map(([low, high], i) => ({time: T0 + i * MIN, low, high}));

const bars = minutes([
  [99, 101],
  [97, 102],
  [98, 106],
  [103, 105],
]);

test('a long reads how far it went against and for it, the best exit and where it exited', () => {
  const result = tradeExcursion(
    {
      side: 'long',
      qty: 10,
      entryMs: T0 + 30_000,
      entryPrice: 100,
      exitMs: T0 + 3 * MIN + 30_000,
      exitPrice: 104,
    },
    bars,
    MIN,
  );
  assert.ok(result.ok);
  const x = result.excursion;
  assert.equal(x.maePerUnit, 3);
  assert.equal(x.mfePerUnit, 6);
  assert.equal(x.mae, 30);
  assert.equal(x.mfe, 60);
  assert.equal(x.maePct, 3);
  assert.equal(x.bestExitPrice, 106);
  assert.equal(x.bestExitMs, T0 + 2 * MIN);
  assert.equal(x.worstPrice, 97);
  assert.equal(x.efficiencyPct, ((104 - 97) / 9) * 100);
  assert.equal(x.bars, 4);
  assert.equal(x.open, false);
});

test('a short reads the same candles the other way up', () => {
  const result = tradeExcursion(
    {
      side: 'short',
      qty: 2,
      entryMs: T0 + 30_000,
      entryPrice: 100,
      exitMs: T0 + MIN + 30_000,
      exitPrice: 98,
    },
    bars,
    MIN,
  );
  assert.ok(result.ok);
  assert.equal(result.excursion.mfePerUnit, 3);
  assert.equal(result.excursion.maePerUnit, 2);
  assert.equal(result.excursion.bestExitPrice, 97);
  assert.equal(result.excursion.efficiencyPct, ((102 - 98) / 5) * 100);
});

test('an open trade runs to the last candle and has no efficiency', () => {
  const result = tradeExcursion(
    {
      side: 'long',
      qty: 1,
      entryMs: T0 + 30_000,
      entryPrice: 100,
      exitMs: null,
      exitPrice: null,
    },
    bars,
    MIN,
  );
  assert.ok(result.ok);
  assert.equal(result.excursion.open, true);
  assert.equal(result.excursion.bars, 4);
  assert.equal(result.excursion.efficiencyPct, null);
});

test('a price its candle never traded is refused, not measured', () => {
  const entry = tradeExcursion(
    {
      side: 'long',
      qty: 1,
      entryMs: T0 + 30_000,
      entryPrice: 120,
      exitMs: T0 + MIN,
      exitPrice: 100,
    },
    bars,
    MIN,
  );
  assert.deepEqual(entry, {
    ok: false,
    reason: 'entry-off-candles',
    detail: {price: 120, low: 99, high: 101},
  });
  const exit = tradeExcursion(
    {
      side: 'long',
      qty: 1,
      entryMs: T0 + 30_000,
      entryPrice: 100,
      exitMs: T0 + MIN + 30_000,
      exitPrice: 90,
    },
    bars,
    MIN,
  );
  assert.equal(exit.ok, false);
  assert.equal(!exit.ok && exit.reason, 'exit-off-candles');
});

test('a trade before the first candle, or with none, has no candles to read', () => {
  const trip = {
    side: 'long',
    qty: 1,
    entryMs: T0 - MIN,
    entryPrice: 100,
    exitMs: T0 + MIN,
    exitPrice: 100,
  } as const;
  assert.deepEqual(tradeExcursion(trip, bars, MIN), {
    ok: false,
    reason: 'no-candles',
  });
  assert.deepEqual(tradeExcursion(trip, [], MIN), {
    ok: false,
    reason: 'no-candles',
  });
});

test('minute candles where they reach the entry, else daily; a trade neither reaches is left out', () => {
  const day = 86_400_000;
  const daily = [
    {time: T0 - 10 * day, low: 90, high: 110},
    {time: T0 - 9 * day, low: 90, high: 110},
  ];
  const base = {
    side: 'long',
    qty: 1,
    entryPrice: 100,
    exitMs: null,
    exitPrice: null,
  } as const;
  const out = tripExcursions(
    [
      {...base, id: 'recent', entryMs: T0 + 30_000},
      {...base, id: 'older', entryMs: T0 - 10 * day + 1000},
      {...base, id: 'ancient', entryMs: T0 - 100 * day},
    ],
    bars,
    daily,
  );
  assert.equal(out.get('recent')?.basis, '1m');
  assert.equal(out.get('older')?.basis, '1d');
  assert.equal(out.has('ancient'), false);
});
