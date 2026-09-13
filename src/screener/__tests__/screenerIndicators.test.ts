import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  flag,
  indicatorSections,
  largeNum,
  num,
  price,
} from '../../data/indicatorsConfig.ts';
import {
  buildIndicatorCatalog,
  groupIndicatorOptions,
  indicatorFilterLabel,
  serializeIndicatorFilters,
} from '../screenerIndicators.ts';

test('indicatorSections: 186 unique computed columns, formatted through the shared helpers', () => {
  const fields = indicatorSections.flatMap(s => s.fields);
  assert.equal(indicatorSections.length, 24);
  assert.equal(fields.length, 186);
  assert.equal(new Set(fields.map(f => f.key)).size, 186);
  assert.equal(price(1234.5), '₹1,234.50');
  assert.equal(largeNum(1234567.6), '12,34,568');
  assert.equal(num(null), 'N/A');
  assert.equal(flag(true), 'Yes');
  assert.equal(flag(null), 'No');
  const trend = fields.find(f => f.key === 'supertrend_direction');
  assert.equal(
    trend?.getValue({stock_symbol: 'X', supertrend_direction: 'up'}),
    'Uptrend',
  );
  assert.equal(trend?.getValue({stock_symbol: 'X'}), 'N/A');
  assert.equal(fields.find(f => f.key === 'pivot_r1')?.label, 'Resistance 1');
});

test('buildIndicatorCatalog labels covered keys from fundamentals and the indicator panel', () => {
  const catalog = buildIndicatorCatalog([
    {key: 'rsi14', kind: 'number', coverage: 0.9},
    {key: 'pe', kind: 'number', coverage: 0.5},
    {key: 'doji', kind: 'boolean', coverage: 0.9},
    {key: 'brand_new', kind: 'number', coverage: 0.1},
  ]);
  assert.deepEqual(catalog[0], {
    key: 'rsi14',
    kind: 'number',
    label: 'RSI 14',
    group: 'Momentum Indicators',
    description: '14-period Relative Strength Index',
  });
  assert.deepEqual(catalog[1], {
    key: 'pe',
    kind: 'number',
    label: 'P/E (TTM)',
    group: 'Fundamentals',
    description: 'Trailing price-to-earnings',
  });
  assert.equal(catalog[2]?.group, 'Single Candle Patterns');
  assert.deepEqual(catalog[3], {
    key: 'brand_new',
    kind: 'number',
    label: 'brand_new',
    group: 'Other',
  });

  const grouped = groupIndicatorOptions(catalog);
  assert.deepEqual(
    grouped.map(([g]) => g),
    ['Fundamentals', 'Momentum Indicators', 'Single Candle Patterns', 'Other'],
  );
  assert.deepEqual(
    groupIndicatorOptions(catalog, 'trailing').map(([, o]) =>
      o.map(x => x.key),
    ),
    [['pe']],
  );
  assert.deepEqual(
    groupIndicatorOptions(catalog, 'strength').flatMap(([, o]) =>
      o.map(x => x.key),
    ),
    ['rsi14'],
  );
});

test('indicator filters serialise to the ind param and label as chips', () => {
  assert.equal(
    serializeIndicatorFilters([
      {key: 'rsi14', min: '30', max: '70'},
      {key: 'pe', max: '25'},
      {key: 'doji', flag: false},
    ]),
    'rsi14:30:70,pe::25,doji:false',
  );
  const rsi = {
    key: 'rsi14',
    label: 'RSI 14',
    group: 'g',
    kind: 'number' as const,
  };
  const cap = {
    key: 'mkt_cap',
    label: 'Market cap',
    group: 'g',
    kind: 'number' as const,
    unit: '₹ Cr',
  };
  assert.equal(
    indicatorFilterLabel({key: 'rsi14', min: '30', max: '70'}, rsi),
    'RSI 14 30 – 70',
  );
  assert.equal(
    indicatorFilterLabel({key: 'mkt_cap', min: '50000'}, cap),
    'Market cap ≥ ₹ Cr 50000',
  );
  assert.equal(indicatorFilterLabel({key: 'pe', max: '25'}), 'pe ≤ 25');
  assert.equal(indicatorFilterLabel({key: 'doji', flag: true}), 'doji: Yes');
  assert.equal(indicatorFilterLabel({key: 'doji'}), 'doji');
});
