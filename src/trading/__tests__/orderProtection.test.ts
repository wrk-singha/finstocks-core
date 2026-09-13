import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  STOP_STEPS,
  TARGET_STEPS,
  getProtectionSupport,
  pctForPrice,
  priceAtPercent,
  protectionCaveat,
  protectionOutcome,
  settlementForProduct,
  validateProtection,
} from '../orderProtection.ts';

test('support follows the broker/settlement matrix', () => {
  assert.equal(
    getProtectionSupport('zerodha', 'INTRADAY', false).supported,
    false,
  );
  assert.equal(
    getProtectionSupport('zerodha', 'DELIVERY', false).mode,
    'after-fill',
  );
  assert.equal(
    getProtectionSupport('groww', 'DELIVERY', false).supported,
    false,
  );
  assert.equal(
    getProtectionSupport('groww', 'INTRADAY', false).mechanism,
    'OCO smart order',
  );
  assert.equal(getProtectionSupport('dhann', 'INTRADAY', false).mode, 'atomic');
  assert.equal(
    getProtectionSupport('upstox', 'DELIVERY', false).trailing,
    true,
  );
  assert.equal(
    getProtectionSupport(null, 'DELIVERY', false).reason,
    'Connect a broker to attach a target or stop loss.',
  );
  assert.equal(
    getProtectionSupport(null, 'INTRADAY', true).mechanism,
    'simulated',
  );
});

test('caveat names the after-fill window and stays silent when simulated', () => {
  assert.equal(
    protectionCaveat(getProtectionSupport(null, 'DELIVERY', true)),
    null,
  );
  assert.equal(
    protectionCaveat(getProtectionSupport('zerodha', 'INTRADAY', false)),
    null,
  );
  assert.match(
    protectionCaveat(getProtectionSupport('zerodha', 'DELIVERY', false)) ?? '',
    /two-leg GTT once the buy fills/,
  );
  assert.equal(
    protectionCaveat(getProtectionSupport('dhann', 'DELIVERY', false)),
    'Sent with the order as a Super Order.',
  );
});

test('settlementForProduct: only MIS is intraday', () => {
  assert.equal(settlementForProduct('MIS'), 'INTRADAY');
  assert.equal(settlementForProduct('CNC'), 'DELIVERY');
  assert.equal(settlementForProduct('NRML'), 'DELIVERY');
});

test('inverted levels are blocked; no entry price means no check', () => {
  assert.deepEqual(validateProtection(100, 95, 105), {
    target: 'Target must be above your entry price',
    stop: 'Stop loss must be below your entry price',
  });
  assert.deepEqual(validateProtection(100, 105, 95), {
    target: null,
    stop: null,
  });
  assert.deepEqual(validateProtection(0, 95, 105), {target: null, stop: null});
});

test('outcome sizes reward and risk and reports the ratio only with both legs', () => {
  assert.deepEqual(protectionOutcome(100, 10, 105, 98), {
    reward: 50,
    risk: 20,
    ratio: 2.5,
  });
  assert.deepEqual(protectionOutcome(100, 10, 105, null), {
    reward: 50,
    risk: null,
    ratio: null,
  });
  assert.deepEqual(protectionOutcome(100, 0, 105, 98), {
    reward: null,
    risk: null,
    ratio: null,
  });
});

test('priceAtPercent rounds to two decimals and pctForPrice reads the chip back', () => {
  assert.equal(priceAtPercent(339.65, 5), 356.63);
  assert.equal(priceAtPercent(339.65, -2), 332.86);
  assert.equal(pctForPrice(339.65, 1, '356.63', TARGET_STEPS), 5);
  assert.equal(pctForPrice(339.65, -1, '332.86', STOP_STEPS), 2);
  assert.equal(pctForPrice(339.65, 1, '350', TARGET_STEPS), null);
  assert.equal(pctForPrice(0, 1, '356.63', TARGET_STEPS), null);
});
