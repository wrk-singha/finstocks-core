import assert from 'node:assert/strict';
import {test} from 'node:test';

import {STRATEGY_INDICATOR_OPTIONS} from '../strategyIndicators.ts';

test('the rule picker leads with position context, then every computed column, then fundamentals', () => {
  assert.deepEqual(
    STRATEGY_INDICATOR_OPTIONS.slice(0, 8).map(o => o.value),
    [
      '$entry_price',
      '$entry_time',
      '$trailing_stop',
      '$pullback_low',
      '$opening_range_high',
      '$opening_range_low',
      '$candle_size',
      '$trade_count',
    ],
  );
  const rsi = STRATEGY_INDICATOR_OPTIONS.find(o => o.value === 'rsi14');
  assert.deepEqual(rsi, {
    value: 'rsi14',
    label: 'RSI 14',
    group: 'Momentum Indicators',
  });
  const pe = STRATEGY_INDICATOR_OPTIONS.find(o => o.value === 'pe_ttm');
  assert.equal(pe?.group, 'Valuation');
  assert.equal(STRATEGY_INDICATOR_OPTIONS.at(-1)?.value, 'mf');
  const values = STRATEGY_INDICATOR_OPTIONS.map(o => o.value);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values.length, 8 + 241 + 24);
});
