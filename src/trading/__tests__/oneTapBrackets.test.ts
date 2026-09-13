import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {OneTapSettings} from '../../types/oneTap.ts';
import {
  bracketLegsForEntry,
  exceedsCeiling,
  limitPriceFor,
  nextTrailingStop,
  oneTapProductFor,
} from '../oneTapBrackets.ts';
import {getProtectionSupport} from '../orderProtection.ts';

const settings = (patch: Partial<OneTapSettings> = {}): OneTapSettings => ({
  enabled: true,
  qtyByUnderlying: {_default: 1},
  product: {equity: 'CNC', futures: 'NRML', options: 'MIS'},
  entryOrderType: 'MARKET',
  exitOrderType: 'MARKET',
  limitPriceSource: 'ltp',
  bracketUnit: 'pts',
  slMode: 'auto',
  slEnabled: true,
  tpEnabled: true,
  slPct: 10,
  tpPct: 20,
  trailPts: 0,
  maxOrderValue: 0,
  ...patch,
});

const mock = getProtectionSupport(null, 'DELIVERY', true);

test('legs sit on the wire in snake_case, ticked to ₹0.05, mirrored for shorts', () => {
  assert.deepEqual(bracketLegsForEntry(100.02, settings(), mock), {
    stop_loss_price: 90,
    take_profit_price: 120,
  });
  assert.deepEqual(bracketLegsForEntry(100, settings(), mock, true), {
    stop_loss_price: 110,
    take_profit_price: 80,
  });
  assert.deepEqual(
    bracketLegsForEntry(200, settings({bracketUnit: 'pct'}), mock),
    {
      stop_loss_price: 180,
      take_profit_price: 240,
    },
  );
});

test('no legs without support, in trailing mode, with toggles off, or off a bad entry', () => {
  assert.deepEqual(
    bracketLegsForEntry(
      100,
      settings(),
      getProtectionSupport('zerodha', 'INTRADAY', false),
    ),
    {},
  );
  assert.deepEqual(
    bracketLegsForEntry(100, settings({slMode: 'trailing'}), mock),
    {},
  );
  assert.deepEqual(
    bracketLegsForEntry(100, settings({slEnabled: false, tpPct: 0}), mock),
    {},
  );
  assert.deepEqual(bracketLegsForEntry(0, settings(), mock), {});
  // A target that cannot beat entry (tiny premium, wide stop) is dropped, not sent inverted.
  assert.deepEqual(
    bracketLegsForEntry(5, settings({slPct: 10, tpPct: 0.01}), mock),
    {},
  );
});

test('oneTapProductFor routes by instrument class', () => {
  const s = settings();
  assert.equal(oneTapProductFor(s, 'INFY', false), 'CNC');
  assert.equal(oneTapProductFor(s, 'NIFTY24JULFUT', true), 'NRML');
  assert.equal(oneTapProductFor(s, 'NIFTY24JUL22000CE', true), 'MIS');
});

test('trailing stop seeds one trail below entry and only ever tightens', () => {
  assert.equal(nextTrailingStop(null, 100, 5, 100), 95);
  assert.equal(nextTrailingStop(95, 110, 5, 100), 105);
  assert.equal(nextTrailingStop(105, 103, 5, 100), 105);
  assert.equal(nextTrailingStop(null, 100, 5, 100, true), 105);
  assert.equal(nextTrailingStop(105, 90, 5, 100, true), 95);
  assert.equal(nextTrailingStop(95, 0, 5, 100), 95);
  assert.equal(nextTrailingStop(95, 100, 0, 100), 95);
});

test('limitPriceFor prices off the chosen source and returns null with no book', () => {
  assert.equal(limitPriceFor('ltp', 'BUY', 100.02), 100);
  assert.equal(limitPriceFor('ltp', 'BUY', 0), null);
  assert.equal(
    limitPriceFor('bbo', 'BUY', 100, {bid: 99.9, ask: 100.1}),
    100.1,
  );
  assert.equal(
    limitPriceFor('bbo', 'SELL', 100, {bid: 99.9, ask: 100.1}),
    99.9,
  );
  assert.equal(limitPriceFor('bbo', 'SELL', 100), null);
  assert.equal(limitPriceFor('mid', 'BUY', 100, {bid: 99.9, ask: 100.1}), 100);
  assert.equal(limitPriceFor('mid', 'BUY', 100, {bid: 99.9}), null);
});

test('exceedsCeiling treats 0 as no ceiling', () => {
  assert.equal(exceedsCeiling(10, 100, 0), false);
  assert.equal(exceedsCeiling(10, 100, 999), true);
  assert.equal(exceedsCeiling(10, 100, 1000), false);
  assert.equal(exceedsCeiling(NaN, 100, 1000), false);
});
