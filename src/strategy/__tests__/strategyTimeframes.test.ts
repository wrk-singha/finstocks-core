import assert from 'node:assert/strict';
import {test} from 'node:test';

import {normalizeStrategyTimeframe} from '../strategyTimeframes.ts';

test('backend timeframes map onto the editor options case-insensitively, unknown reads daily', () => {
  assert.equal(normalizeStrategyTimeframe('5m'), '5m');
  assert.equal(normalizeStrategyTimeframe('1d'), '1D');
  assert.equal(normalizeStrategyTimeframe('15M'), '15m');
  assert.equal(normalizeStrategyTimeframe('4h'), '1D');
  assert.equal(normalizeStrategyTimeframe(null), '1D');
});
