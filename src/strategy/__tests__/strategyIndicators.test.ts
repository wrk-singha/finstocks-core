import assert from 'node:assert/strict';
import {test} from 'node:test';

import {indicatorSections} from '../../data/indicatorsConfig.ts';
import {STRATEGY_INDICATOR_OPTIONS} from '../strategyIndicators.ts';

test('the rule picker carries position context, every computed column, then fundamentals', () => {
  const context = STRATEGY_INDICATOR_OPTIONS.findIndex(
    o => o.value === '$entry_price',
  );
  assert.deepEqual(
    STRATEGY_INDICATOR_OPTIONS.slice(context, context + 8).map(o => o.value),
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

test('the picker opens on the five lead groups, and the rest follow in their source order', () => {
  const lead = [
    'Momentum Indicators',
    'Price & Moving Averages',
    'OHLCV Data',
    'Volume & Stochastic',
    'Volatility & Trend',
  ];
  const runs = STRATEGY_INDICATOR_OPTIONS.map(o => o.group).filter(
    (group, i, all) => group !== all[i - 1],
  );
  // One run per group: sorting by group never splits one.
  assert.equal(new Set(runs).size, runs.length);
  assert.deepEqual(runs.slice(0, lead.length), lead);
  assert.deepEqual(runs.slice(lead.length), [
    'Position context',
    ...indicatorSections
      .filter(s => s.fields.length > 0 && !lead.includes(s.title))
      .map(s => s.title),
    'Valuation',
    'Profitability',
    'Growth',
    'Per Share',
    'Leverage',
    'Dividends & Holdings',
  ]);
  assert.equal(STRATEGY_INDICATOR_OPTIONS[0]?.value, 'rsi14');
});
