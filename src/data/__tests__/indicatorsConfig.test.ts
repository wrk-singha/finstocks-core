import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildIndicatorCatalog} from '../../screener/screenerIndicators.ts';
import {STRATEGY_INDICATOR_OPTIONS} from '../../strategy/strategyIndicators.ts';
import type {TechnicalIndicatorData} from '../../types/indicators.ts';
import {indicatorSections} from '../indicatorsConfig.ts';

const RESTORED_SECTIONS = [
  'More Double Candle Patterns',
  'More Triple Candle Patterns',
  'Heikin Ashi Patterns',
];

const section = (title: string) =>
  indicatorSections.find(s => s.title === title);

const keysAndLabels = (title: string) =>
  section(title)?.fields.map(f => [f.key, f.label]);

test('the nineteen restored patterns sit in web’s sections, in web’s order, under web’s labels', () => {
  assert.deepEqual(keysAndLabels('More Double Candle Patterns'), [
    ['counter_attack_bullish', 'Bullish counter attack'],
    ['counter_attack_bearish', 'Bearish counter attack'],
    ['doji_star_bullish', 'Bullish doji star'],
    ['doji_star_bearish', 'Bearish doji star'],
    ['in_neck_bearish', 'In neck (bearish)'],
    ['thrusting_bearish', 'Thrusting (bearish)'],
  ]);
  assert.deepEqual(keysAndLabels('More Triple Candle Patterns'), [
    ['three_outside_up', 'Three outside up'],
    ['three_outside_down', 'Three outside down'],
    ['advance_block', 'Advance block'],
    ['deliberation', 'Deliberation'],
    ['homing_pigeon', 'Homing pigeon'],
    ['descending_hawk', 'Descending hawk'],
    ['gap_three_methods_bullish', 'Bullish gap three methods'],
    ['gap_three_methods_bearish', 'Bearish gap three methods'],
  ]);
  assert.deepEqual(keysAndLabels('Heikin Ashi Patterns'), [
    ['ha_bullish_initiation', 'HA bullish initiation'],
    ['ha_bearish_initiation', 'HA bearish initiation'],
    ['ha_bullish_continuation', 'HA bullish continuation'],
    ['ha_bearish_continuation', 'HA bearish continuation'],
    ['ha_doji', 'HA doji'],
    ['ha_tick_up', 'HA tick up'],
    ['ha_tick_down', 'HA tick down'],
  ]);
});

test('the new sections follow the trend-confirmed candles and lead into the range breaks', () => {
  const titles = indicatorSections.map(s => s.title);
  const start = titles.indexOf('Trend-Confirmed Candles');
  assert.deepEqual(titles.slice(start, start + 5), [
    'Trend-Confirmed Candles',
    ...RESTORED_SECTIONS,
    'Gaps & Range Breaks',
  ]);
});

test('every restored field is a yes/no flag read from its own key, never a price level', () => {
  for (const title of RESTORED_SECTIONS) {
    const restored = section(title);
    assert.equal(restored?.priceLevels, undefined, title);
    assert.equal(restored?.defaultCollapsed, undefined, title);
    for (const field of restored?.fields ?? []) {
      assert.equal(field.kind, undefined, field.key);
      // Only this field's key is set, so a getter wired to a neighbour's key reads "No".
      const hit = {
        stock_symbol: 'RELIANCE',
        [field.key]: true,
      } as TechnicalIndicatorData;
      assert.equal(field.getValue(hit), 'Yes', field.key);
      assert.equal(
        field.getValue({stock_symbol: 'RELIANCE', [field.key]: null}),
        'No',
        field.key,
      );
      assert.equal(field.getValue({stock_symbol: 'RELIANCE'}), 'No');
    }
  }
});

test('the chart patterns stay dropped: web restored the candles and Heikin Ashi, not them', () => {
  const keys = new Set(
    indicatorSections.flatMap(s => s.fields.map(field => field.key)),
  );
  const chartPatterns: (keyof TechnicalIndicatorData)[] = [
    'cup_and_handle',
    'ascending_triangle',
    'descending_triangle',
    'symmetrical_triangle',
  ];
  for (const key of chartPatterns) assert.equal(keys.has(key), false, key);
  assert.equal(section('Chart Patterns'), undefined);
});

test('the rule picker and the screener catalog pick them up without a second list', () => {
  assert.deepEqual(
    STRATEGY_INDICATOR_OPTIONS.find(o => o.value === 'three_outside_up'),
    {
      value: 'three_outside_up',
      label: 'Three outside up',
      group: 'More Triple Candle Patterns',
    },
  );
  assert.equal(
    STRATEGY_INDICATOR_OPTIONS.find(o => o.value === 'counter_attack_bullish')
      ?.group,
    'More Double Candle Patterns',
  );
  assert.deepEqual(
    buildIndicatorCatalog([
      {key: 'ha_tick_up', kind: 'boolean', coverage: 0.4},
    ]),
    [
      {
        key: 'ha_tick_up',
        kind: 'boolean',
        label: 'HA tick up',
        group: 'Heikin Ashi Patterns',
        description: 'Heikin Ashi close ticks above the prior one',
      },
    ],
  );
});

test('a VWAP of 0 reads N/A, never ₹0.00', () => {
  const vwap = indicatorSections
    .flatMap(s => s.fields)
    .find(field => field.key === 'vwap');
  // Backend-go answers a missing figure as 0, and VWAP is a session's figure that Doom is not asked
  // for on 1d or 1w (indicators/doom.go intradayOnly), so a daily row carries "vwap": 0.
  assert.equal(vwap?.getValue({stock_symbol: 'TCS', vwap: 0}), 'N/A');
  assert.equal(vwap?.getValue({stock_symbol: 'TCS', vwap: null}), 'N/A');
  assert.equal(vwap?.getValue({stock_symbol: 'TCS'}), 'N/A');
  assert.equal(
    vwap?.getValue({stock_symbol: 'TCS', vwap: 2451.5}),
    '₹2,451.50',
  );
});
