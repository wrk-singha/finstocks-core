import assert from 'node:assert/strict';
import {test} from 'node:test';

import {mulberry32, percentileSorted} from '../sampling.ts';

/** The basket backtest's own PRNG as it was written before it moved here, unsigned throughout. */
function basketRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('mulberry32 is the stream the basket backtest drew, for any seed, in [0, 1)', () => {
  for (const seed of [0, 7, 20260929, -5, 2 ** 31 + 9, 2 ** 32 - 1]) {
    const shared = mulberry32(seed);
    const basket = basketRandom(seed);
    const draws = Array.from({length: 5000}, () => shared());
    assert.deepEqual(
      draws,
      Array.from({length: 5000}, () => basket()),
    );
    assert.ok(draws.every(v => v >= 0 && v < 1));
  }
  assert.notEqual(mulberry32(8)(), mulberry32(7)());
});

test('percentiles interpolate between neighbours, as numpy does', () => {
  const sorted = [10, 20, 30, 40];
  assert.equal(percentileSorted(sorted, 0), 10);
  assert.equal(percentileSorted(sorted, 1), 40);
  assert.equal(percentileSorted(sorted, 0.5), 25);
  assert.equal(percentileSorted(Float64Array.from([5]), 0.95), 5);
  assert.ok(Number.isNaN(percentileSorted([], 0.5)));
});
