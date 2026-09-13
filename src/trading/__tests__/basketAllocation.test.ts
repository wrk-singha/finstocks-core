import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  allocateBasket,
  seedCustomAmounts,
  sweepRemainder,
} from '../basketAllocation.ts';

const recos = [
  {stock_symbol: 'INFY', direction: 'long', cmp: 1500, note: 'kept'},
  {stock_symbol: 'MRF', direction: 'long', cmp: 120000},
  {stock_symbol: 'TCS', direction: 'short', cmp: 4000},
  {stock_symbol: 'NEW', direction: 'long', cmp: 0},
];

test('equal mode never rounds a row up to one share and reports the leftover', () => {
  const basket = allocateBasket({
    recos,
    amount: 40000,
    mode: 'equal',
    overrides: {},
    targetPct: 5,
    stopPct: 2,
  });
  const [infy, mrf, tcs, unpriced] = basket.rows;
  assert.equal(infy?.qty, 6);
  assert.equal(infy?.orderValue, 9000);
  assert.equal(infy?.reco.note, 'kept');
  assert.equal(mrf?.block, 'underfunded');
  assert.equal(mrf?.qty, null);
  assert.equal(unpriced?.block, 'unpriced');
  assert.equal(tcs?.side, 'SELL');
  assert.equal(tcs?.qty, 2);
  assert.equal(basket.total, 9000 + 8000);
  assert.equal(basket.remainder, 40000 - 17000);
  assert.equal(basket.placeableCount, 2);
  assert.equal(basket.blockedCount, 2);
});

test('exits resolve per row as prices, only on placeable longs, and null clears a leg', () => {
  const basket = allocateBasket({
    recos,
    amount: 40000,
    mode: 'equal',
    overrides: {INFY: {targetPct: null}},
    targetPct: 5,
    stopPct: 2,
  });
  const [infy, , tcs] = basket.rows;
  assert.equal(infy?.targetPct, null);
  assert.equal(infy?.targetPrice, null);
  assert.equal(infy?.stopPct, 2);
  assert.equal(infy?.stopPrice, 1470);
  assert.equal(infy?.overridden, true);
  assert.equal(tcs?.targetPrice, null);
  assert.equal(tcs?.stopPrice, null);
});

test('custom mode honours amounts; seed and sweep edit the override map', () => {
  const equal = allocateBasket({
    recos,
    amount: 40000,
    mode: 'equal',
    overrides: {},
    targetPct: null,
    stopPct: null,
  });
  const seeded = seedCustomAmounts(equal.rows, {INFY: {targetPct: 3}});
  assert.deepEqual(seeded.INFY, {targetPct: 3, amount: 10000});
  assert.equal(seeded.MRF?.amount, 10000);

  const swept = sweepRemainder(equal.rows, equal.remainder, seeded);
  // Cheapest row whose price fits the remainder gets it.
  assert.equal(swept.INFY?.amount, 10000 + equal.remainder);
  assert.equal(sweepRemainder(equal.rows, 100, seeded), seeded);

  const custom = allocateBasket({
    recos,
    amount: 40000,
    mode: 'custom',
    overrides: swept,
    targetPct: null,
    stopPct: null,
  });
  assert.equal(
    custom.rows[0]?.qty,
    Math.floor((10000 + equal.remainder) / 1500),
  );
});
