import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  type AnalyticLeg,
  basketIv,
  black76Price,
  hasModel,
  hasNakedShort,
  type Market,
  netGreeks,
  niceTicks,
  oneSigmaRange,
  pnlAt,
  probabilityOfProfit,
} from '../basketAnalytics.ts';
import {payoffAt} from '../optionStructures.ts';

const leg = (
  action: 'buy' | 'sell',
  right: 'CE' | 'PE',
  strike: number,
  premium: number,
  iv: number | null,
  lots = 1,
): AnalyticLeg => ({action, right, strike, premium, lots, iv});
const LOT = 75;
const MARKET: Market = {spot: 24_400, forward: 24_460, years: 5 / 365};
const BULL_CALL = [
  leg('buy', 'CE', 24_400, 140, 0.13),
  leg('sell', 'CE', 24_600, 55, 0.12),
];
const near = (a: number, b: number, tolerance = 1e-6) => {
  assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);
};

test('black76Price satisfies put-call parity and falls to intrinsic without time or vol', () => {
  const years = 30 / 365;
  const call = black76Price(24_460, 24_400, years, 0.15, 'CE');
  const put = black76Price(24_460, 24_400, years, 0.15, 'PE');
  near(call - put, Math.exp(-0.065 * years) * (24_460 - 24_400));
  assert.equal(black76Price(24_460, 24_400, 0, 0.15, 'CE'), 60);
  assert.equal(black76Price(24_460, 24_400, years, 0, 'PE'), 0);
  assert.equal(black76Price(24_460, 24_400, Number.NaN, 0.15, 'CE'), 60);
});

test("pnlAt today reads the chain's basis, and at the close is the expiry payoff on spot", () => {
  // Today: the forward sits the chain's 60 points over spot.
  const forward = 24_460;
  const today =
    (black76Price(forward, 24_400, MARKET.years, 0.13, 'CE') - 140) * LOT -
    (black76Price(forward, 24_600, MARKET.years, 0.12, 'CE') - 55) * LOT;
  near(pnlAt(BULL_CALL, 24_400, LOT, MARKET), today);
  // The basis is carry over the time left, so it is gone at the close: the
  // scenario lands on the expiry line, not 60 points (₹4,500 here) above it.
  for (const spot of [23_800, 24_400, 24_520, 25_000]) {
    const expiry = payoffAt(BULL_CALL, spot, LOT);
    near(pnlAt(BULL_CALL, spot, LOT, MARKET, {days: 5, ivShift: 0}), expiry);
    near(pnlAt(BULL_CALL, spot, LOT, MARKET, {days: 9, ivShift: 3}), expiry);
    near(pnlAt(BULL_CALL, spot, LOT, {...MARKET, years: 0}), expiry);
  }
  assert.equal(
    pnlAt(BULL_CALL, 24_400, LOT, MARKET, {days: 5, ivShift: 0}),
    -6_375,
  );
  // Partway, the basis has decayed in proportion: two of five days gone leaves 3/5 of its log.
  const partway = pnlAt(BULL_CALL, 24_400, LOT, MARKET, {days: 2, ivShift: 0});
  const years = MARKET.years - 2 / 365;
  const decayed = 24_400 * Math.pow(24_460 / 24_400, years / MARKET.years);
  near(
    partway,
    (black76Price(decayed, 24_400, years, 0.13, 'CE') - 140) * LOT -
      (black76Price(decayed, 24_600, years, 0.12, 'CE') - 55) * LOT,
  );
});

test("netGreeks takes the chain's quoted greeks where given and says where each net came from", () => {
  const model = netGreeks(BULL_CALL, LOT, MARKET);
  assert.ok(model !== null);
  assert.deepEqual(model.sources, {
    delta: 'model',
    gamma: 'model',
    theta: 'model',
  });
  const quoted = [
    {
      ...leg('buy', 'CE', 24_400, 140, 0.13),
      quoted: {delta: 0.55, gamma: 0.0004, theta: -12},
    },
    {
      ...leg('sell', 'CE', 24_600, 55, 0.12),
      quoted: {delta: 0.2, gamma: null, theta: null},
    },
  ];
  const mixed = netGreeks(quoted, LOT, MARKET);
  assert.ok(mixed !== null);
  near(mixed.delta, (0.55 - 0.2) * LOT);
  assert.deepEqual(mixed.sources, {
    delta: 'feed',
    gamma: 'mixed',
    theta: 'mixed',
  });
  assert.equal(mixed.vega, model.vega);
  assert.equal(
    netGreeks([...BULL_CALL, leg('buy', 'PE', 24_000, 20, null)], LOT, MARKET),
    null,
  );
  assert.equal(netGreeks(BULL_CALL, LOT, {...MARKET, years: 0}), null);
});

test('hasModel, basketIv and oneSigmaRange read only quoted IVs', () => {
  const unquoted = [
    leg('buy', 'PE', 24_000, 20, null),
    leg('buy', 'PE', 23_900, 15, 0),
  ];
  assert.equal(hasModel([]), false);
  assert.equal(hasModel([...BULL_CALL, ...unquoted]), false);
  near(basketIv([...BULL_CALL, ...unquoted]) ?? 0, 0.125);
  assert.equal(basketIv(unquoted), null);
  const range = oneSigmaRange({...MARKET, years: 2}, 2);
  assert.equal(range.lo, 0);
});

test('probabilityOfProfit sits between 0 and 1 and is 0 without vol or time', () => {
  const strangle = [
    leg('sell', 'PE', 24_100, 60, 0.14, 2),
    leg('sell', 'CE', 24_700, 45, 0.12, 2),
  ];
  const pop = probabilityOfProfit(strangle, LOT, MARKET, 0.13);
  assert.ok(pop > 0.5 && pop < 1);
  assert.equal(probabilityOfProfit(BULL_CALL, LOT, MARKET, 0), 0);
  assert.equal(
    probabilityOfProfit(BULL_CALL, LOT, {...MARKET, years: 0}, 0.13),
    0,
  );
});

test('hasNakedShort counts call lots only', () => {
  assert.equal(hasNakedShort(BULL_CALL), false);
  assert.equal(hasNakedShort([leg('sell', 'PE', 24_000, 30, 0.14)]), false);
  assert.equal(
    hasNakedShort([
      leg('sell', 'CE', 24_600, 50, 0.12, 2),
      leg('buy', 'CE', 24_800, 14, 0.11),
    ]),
    true,
  );
});

test('niceTicks steps by 1, 2 or 5 of a power of ten, and an empty span is its start', () => {
  assert.deepEqual(niceTicks(23_800, 25_000), [24_000, 24_500, 25_000]);
  assert.deepEqual(niceTicks(-12_345, 8_765, 4), [-10_000, -5_000, 0, 5_000]);
  assert.deepEqual(niceTicks(5, 5), [5]);
  assert.deepEqual(niceTicks(10, 2), [10]);
});
