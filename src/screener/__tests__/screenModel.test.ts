import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  ScreenCatalog,
  ScreenField,
  ScreenFilter,
  ScreenRow,
} from '../../types/screen.ts';
import {
  BASE_COLUMNS,
  buildCatalogIndex,
  compareOptions,
  decodeScreen,
  defaultFilterFor,
  EMPTY_SCREEN,
  encodeScreen,
  fieldLabel,
  fieldLabelParts,
  fieldValueParts,
  filterLabel,
  filterParts,
  formatFieldValue,
  headerUnit,
  isActiveFilter,
  isEmptyScreen,
  isRunnable,
  isSignedField,
  pruneScreen,
  SCREEN_DEFAULT_TIMEFRAME,
  type ScreenState,
  sortScreenRows,
  splitFieldId,
  toRequest,
  visibleColumns,
  withTimeframe,
} from '../screenModel.ts';

const field = (
  fields: Partial<ScreenField> & Pick<ScreenField, 'id' | 'label'>,
): ScreenField => ({
  header: fields.label,
  unit: '',
  kind: 'number',
  category: 'valuation',
  better: 0,
  ...fields,
});

const catalog: ScreenCatalog = {
  categories: [
    {id: 'valuation', label: 'Valuation'},
    {id: 'growth', label: 'Growth'},
    {id: 'technicals', label: 'Technicals'},
    {id: 'candlesticks', label: 'Candlesticks'},
    {id: 'chart_patterns', label: 'Chart patterns'},
  ],
  timeframes: ['1m', '5m', '15m', '1d', '1w'],
  universes: [
    {id: 'nifty50', label: 'Nifty 50', group: 'Indices', count: 50},
    {id: 'large', label: 'Large caps', group: 'Size', count: 100},
  ],
  fields: [
    field({id: 'price', label: 'Price', unit: 'rupees', popular: true}),
    field({
      id: 'lib.other_income',
      label: 'Other income',
      header: 'Oth Inc',
      unit: 'crore',
    }),
    field({
      id: 'market_cap',
      label: 'Market cap',
      header: 'M.Cap',
      unit: 'crore',
      popular: true,
      aliases: ['mcap'],
    }),
    field({
      id: 'pe',
      label: 'Price to earnings',
      header: 'P/E',
      unit: 'x',
      presets: [
        {label: 'Under 15', max: 15},
        {label: '15 to 25', min: 15, max: 25},
      ],
    }),
    field({id: 'roe', label: 'Return on equity', header: 'ROE', unit: 'pct'}),
    field({id: 'volume', label: 'Volume', header: 'Vol', unit: 'shares'}),
    field({
      id: 'return_1y',
      label: 'Return',
      header: '1Y %',
      unit: 'pct',
      family: 'returns',
      family_label: 'Return',
      period: '1Y',
    }),
    field({
      id: 'profit_growth_qtr',
      label: 'Profit growth',
      header: 'Qtr Profit Var',
      unit: 'pct',
      category: 'growth',
      family: 'profit_growth',
      family_label: 'Profit growth',
      period: 'Qtr',
    }),
    field({
      id: 'profit_growth',
      label: 'Profit growth',
      header: 'Profit Var 1Y',
      unit: 'pct',
      category: 'growth',
      family: 'profit_growth',
      family_label: 'Profit growth',
      period: '1Y',
      popular: true,
    }),
    field({
      id: 'profit_growth_3y',
      label: 'Profit growth',
      header: 'Profit Var 3Y',
      unit: 'pct',
      category: 'growth',
      family: 'profit_growth',
      family_label: 'Profit growth',
      period: '3Y CAGR',
    }),
    field({
      id: 'rsi14',
      label: 'RSI 14',
      header: 'RSI',
      category: 'technicals',
      technical: true,
    }),
    field({
      id: 'sma50',
      label: 'SMA 50',
      unit: 'rupees',
      category: 'technicals',
      technical: true,
      family: 'sma',
    }),
    field({
      id: 'sma200',
      label: 'SMA 200',
      unit: 'rupees',
      category: 'technicals',
      technical: true,
      family: 'sma',
      timeframes: ['1m', '5m', '15m', '1d'],
    }),
    field({
      id: 'above_sma200',
      label: 'Above SMA 200',
      header: '>SMA 200',
      kind: 'flag',
      category: 'technicals',
      technical: true,
    }),
    field({
      id: 'pat.bullish_engulfing',
      label: 'Bullish engulfing',
      unit: 'bars',
      kind: 'pattern',
      category: 'candlesticks',
      technical: true,
    }),
    field({
      id: 'pat.ascending_triangle_breakout',
      label: 'Ascending triangle breakout',
      unit: 'bars',
      kind: 'pattern',
      category: 'chart_patterns',
      technical: true,
    }),
    field({
      id: 'ind.adx_14',
      label: 'adx_14',
      category: 'technicals',
      technical: true,
    }),
    field({
      id: 'ind.brand_new_col',
      label: 'brand_new_col',
      category: 'technicals',
      technical: true,
      description: 'Written for the column',
    }),
  ],
};

const index = buildCatalogIndex(catalog);
const byId = (id: string): ScreenField => {
  const found = index.byId.get(id);
  assert.ok(found, id);
  return found;
};

test('a daily id carries no timeframe, every other one does', () => {
  assert.equal(SCREEN_DEFAULT_TIMEFRAME, '1d');
  assert.equal(withTimeframe('rsi14', '1d'), 'rsi14');
  assert.equal(withTimeframe('rsi14', ''), 'rsi14');
  assert.equal(withTimeframe('rsi14', '15m'), 'rsi14@15m');
  assert.deepEqual(splitFieldId('rsi14@15m'), {id: 'rsi14', tf: '15m'});
  assert.deepEqual(splitFieldId('rsi14'), {id: 'rsi14', tf: '1d'});
});

test('a family of periods is one picker entry, led by its popular member', () => {
  const growth = index.entries.find(e => e.key === 'profit_growth');
  assert.ok(growth);
  assert.equal(growth.label, 'Profit growth');
  assert.deepEqual(
    growth.members.map(m => m.id),
    ['profit_growth_qtr', 'profit_growth', 'profit_growth_3y'],
  );
  assert.equal(growth.primary.id, 'profit_growth');
  assert.equal(growth.popular, true);
  // Every period is searchable, lowercased like the rest.
  assert.equal(
    growth.haystack,
    'profit growth profit growth qtr profit var 1y 3y cagr',
  );
  assert.equal(
    index.entries.find(e => e.key === 'market_cap')?.haystack,
    'market cap m.cap mcap',
  );
});

test('moving-average levels are there to compare against, never offered alone', () => {
  assert.ok(index.byId.has('sma50'));
  assert.ok(index.byId.has('sma200'));
  assert.equal(
    index.entries.some(e => e.key === 'sma' || e.primary.id === 'sma50'),
    false,
  );
});

test('curated fields lead a category and the statement lines follow', () => {
  assert.deepEqual(
    index.byCategory.get('valuation')?.map(e => e.key),
    [
      'price',
      'market_cap',
      'pe',
      'roe',
      'volume',
      'returns',
      'lib.other_income',
    ],
  );
  assert.equal(index.categoryLabel.get('chart_patterns'), 'Chart patterns');
  assert.deepEqual(index.timeframes, ['1m', '5m', '15m', '1d', '1w']);
  assert.equal(buildCatalogIndex(undefined).entries.length, 0);
});

test('indicator columns take the panel’s names, and an unknown one is humanised', () => {
  const adx = byId('ind.adx_14');
  assert.equal(adx.label, 'ADX 14');
  assert.equal(adx.header, 'ADX 14');
  assert.equal(adx.description, '14-period Average Directional Index');
  const unknown = byId('ind.brand_new_col');
  assert.equal(unknown.label, 'Brand new col');
  assert.equal(unknown.description, undefined);
});

test('labels: the header alone, or the label with its period and a non-daily timeframe', () => {
  assert.equal(fieldLabel(index, 'profit_growth_3y'), 'Profit Var 3Y');
  assert.equal(
    fieldLabel(index, 'profit_growth_3y', true),
    'Profit growth · 3Y CAGR',
  );
  assert.equal(fieldLabel(index, 'rsi14@15m'), 'RSI · 15 min');
  assert.equal(fieldLabel(index, 'rsi14'), 'RSI');
  assert.equal(fieldLabel(index, 'rsi14@3h'), 'RSI · 3h');
  // A fundamental has no timeframe to show, whatever the key says.
  assert.equal(fieldLabel(index, 'pe@15m'), 'P/E');
  assert.equal(fieldLabel(index, 'nope@15m', true), 'nope@15m');
  assert.deepEqual(fieldLabelParts(index, 'rsi14@1w', true), {
    name: 'RSI 14',
    period: null,
    timeframe: '1w',
  });
  assert.deepEqual(fieldLabelParts(index, 'nope'), {
    name: 'nope',
    period: null,
    timeframe: null,
  });
});

test('a cell reads a missing figure as a dash, never 0, and each unit in its own form', () => {
  assert.equal(formatFieldValue(undefined, byId('pe')), '—');
  assert.equal(formatFieldValue(Number.NaN, byId('pe')), '—');
  assert.equal(formatFieldValue(Infinity, byId('pe')), '—');
  assert.equal(formatFieldValue(0, byId('pe')), '0.00×');
  assert.equal(formatFieldValue(1, byId('above_sma200')), 'Yes');
  assert.equal(formatFieldValue(0, byId('above_sma200')), 'No');
  assert.equal(
    formatFieldValue(0, byId('pat.bullish_engulfing')),
    'Latest bar',
  );
  assert.equal(
    formatFieldValue(4, byId('pat.bullish_engulfing')),
    '4 bars ago',
  );
  assert.equal(formatFieldValue(123456.7, byId('market_cap')), '1,23,457');
  assert.equal(formatFieldValue(512.5, byId('market_cap')), '512.50');
  assert.equal(formatFieldValue(-12.34, byId('roe')), '-12.3%');
  assert.equal(formatFieldValue(245.6, byId('roe')), '246%');
  assert.equal(formatFieldValue(2_50_00_000, byId('volume')), '2.50 Cr');
  assert.equal(formatFieldValue(3_40_000, byId('volume')), '3.40 L');
  assert.equal(formatFieldValue(4_560, byId('volume')), '4.6 K');
  assert.equal(formatFieldValue(512, byId('volume')), '512');
  assert.equal(formatFieldValue(1.23456, undefined), '1.23');
  assert.deepEqual(fieldValueParts(3, byId('pat.bullish_engulfing')), {
    kind: 'pattern',
    barsAgo: 3,
  });
  assert.deepEqual(fieldValueParts(1, byId('above_sma200')), {
    kind: 'flag',
    value: true,
  });
  assert.deepEqual(fieldValueParts(undefined, undefined), {kind: 'missing'});
});

test('headers carry the unit unless every cell already does, and moves carry a tone', () => {
  assert.equal(headerUnit(byId('market_cap')), '₹ Cr');
  assert.equal(headerUnit(byId('roe')), '');
  assert.equal(headerUnit(byId('pe')), '');
  assert.equal(headerUnit(undefined), '');
  assert.equal(isSignedField(byId('return_1y')), true);
  assert.equal(isSignedField(byId('roe')), false);
  assert.equal(isSignedField(undefined), false);
});

test('a filter reads as its condition', () => {
  const read = (filter: ScreenFilter) => filterLabel(index, filter);
  assert.equal(
    read({field: 'profit_growth_3y', min: 25}),
    'Profit growth · 3Y CAGR > 25%',
  );
  assert.equal(read({field: 'pe', max: 20}), 'Price to earnings < 20×');
  assert.equal(read({field: 'pe', max: 12.5}), 'Price to earnings < 12.50×');
  assert.equal(
    read({field: 'market_cap', min: 500, max: 30000}),
    'Market cap ₹500 Cr – ₹30,000 Cr',
  );
  assert.equal(read({field: 'price', min: 5}), 'Price > ₹5');
  assert.equal(read({field: 'roe'}), 'Return on equity · any');
  assert.equal(read({field: 'above_sma200', flag: true}), 'Above SMA 200');
  assert.equal(
    read({field: 'above_sma200@15m', flag: false}),
    'Not above sma 200 · 15 min',
  );
  assert.equal(
    read({field: 'pat.bullish_engulfing', flag: true, max: 0}),
    'Bullish engulfing · latest bar',
  );
  assert.equal(
    read({field: 'pat.ascending_triangle_breakout', flag: false, max: 29}),
    'No Ascending triangle breakout · last 30 bars',
  );
  assert.equal(
    read({field: 'sma50@15m', op: 'gt', ref: 'sma200@15m', factor: 1}),
    'SMA 50 · 15 min > SMA 200 · 15 min',
  );
  assert.equal(
    read({field: 'price', op: 'lt', ref: 'sma200', factor: 0.95}),
    'Price < 0.95 × SMA 200',
  );
  assert.equal(read({field: 'gone', min: 3}), 'gone');
});

test('filter parts carry the facts, formatted, for a host that words them', () => {
  assert.deepEqual(filterParts(index, {field: 'roe', min: 15.5, max: 40}), {
    kind: 'between',
    name: {name: 'Return on equity', period: null, timeframe: null},
    min: '15.5%',
    max: '40%',
  });
  assert.deepEqual(
    filterParts(index, {
      field: 'sma50@5m',
      op: 'lt',
      ref: 'sma200@5m',
      factor: 1.02,
    }),
    {
      kind: 'compare',
      name: {name: 'SMA 50', period: null, timeframe: '5m'},
      op: 'lt',
      factor: '1.02',
      ref: {name: 'SMA 200', period: null, timeframe: '5m'},
    },
  );
  assert.deepEqual(
    filterParts(index, {field: 'pat.bullish_engulfing', max: 4}),
    {
      kind: 'pattern',
      name: {name: 'Bullish engulfing', period: null, timeframe: null},
      want: true,
      maxBarsAgo: 4,
    },
  );
});

test('a new filter starts from the field’s first preset, or on for flags and patterns', () => {
  assert.deepEqual(defaultFilterFor(byId('pe')), {
    field: 'pe',
    min: undefined,
    max: 15,
  });
  assert.deepEqual(defaultFilterFor(byId('above_sma200'), '15m'), {
    field: 'above_sma200@15m',
    flag: true,
  });
  assert.deepEqual(defaultFilterFor(byId('pat.bullish_engulfing')), {
    field: 'pat.bullish_engulfing',
    max: 0,
    flag: true,
  });
  // A formation needs confirmed swings either side, so a few bars find nothing.
  assert.deepEqual(defaultFilterFor(byId('pat.ascending_triangle_breakout')), {
    field: 'pat.ascending_triangle_breakout',
    max: 29,
    flag: true,
  });
  assert.equal(defaultFilterFor(byId('roe'), '15m').field, 'roe');
  assert.equal(isActiveFilter(defaultFilterFor(byId('roe'))), false);
  assert.equal(isActiveFilter(defaultFilterFor(byId('pe'))), true);
});

test('a comparison carries the timeframe of the side it is measured against', () => {
  const options = compareOptions(index, byId('sma50'), '15m');
  assert.deepEqual(options, [{value: 'sma200@15m', label: 'SMA 200'}]);
  // SMA 200 has no weekly reading, so a weekly SMA 50 has nothing to compare with.
  assert.deepEqual(compareOptions(index, byId('sma50'), '1w'), []);
  assert.deepEqual(compareOptions(index, byId('sma50'), '1d'), [
    {value: 'sma200', label: 'SMA 200'},
  ]);
});

test('comparisons stay within one unit, among fundamentals or among technicals', () => {
  assert.deepEqual(
    compareOptions(index, byId('market_cap'), '1d').map(o => o.value),
    [],
  );
  assert.deepEqual(
    compareOptions(index, byId('roe'), '1d').map(o => o.value),
    ['return_1y', 'profit_growth_qtr', 'profit_growth', 'profit_growth_3y'],
  );
  assert.deepEqual(compareOptions(index, byId('rsi14'), '1d'), []);
  assert.deepEqual(compareOptions(index, byId('above_sma200'), '1d'), []);
  assert.deepEqual(compareOptions(index, undefined, '1d'), []);
});

const screen = (patch: Partial<ScreenState>): ScreenState => ({
  ...EMPTY_SCREEN,
  ...patch,
});

test('the table shows the base columns, then each active filter, then the reader’s own', () => {
  assert.deepEqual(visibleColumns(EMPTY_SCREEN), [...BASE_COLUMNS]);
  assert.deepEqual(
    visibleColumns(
      screen({
        filters: [
          {field: 'roe', min: 15},
          {field: 'pe'},
          {field: 'market_cap', min: 500},
          {field: 'rsi14@15m', max: 30},
        ],
        columns: ['pe', 'roe', 'volume'],
      }),
    ),
    ['price', 'return_1d', 'market_cap', 'roe', 'rsi14@15m', 'pe', 'volume'],
  );
  assert.equal(isEmptyScreen(EMPTY_SCREEN), true);
  assert.equal(isEmptyScreen(screen({columns: ['pe']})), false);
});

test('a watchlist screen waits for its list rather than asking for the whole market', () => {
  const lists: Record<string, string[]> = {};
  const symbols = (id: string) => lists[id] ?? [];
  const state = screen({
    universes: ['wl:core'],
    filters: [{field: 'roe', min: 15}],
  });

  assert.equal(isRunnable(state, symbols), false);
  // What would have gone out: no universe and no symbols, which the server reads as everything.
  assert.deepEqual(toRequest(state, symbols), {
    universes: [],
    symbols: [],
    industries: [],
    filters: [{field: 'roe', min: 15}],
    columns: [],
  });

  lists.core = ['TCS', 'INFY'];
  assert.equal(isRunnable(state, symbols), true);
  assert.deepEqual(toRequest(state, symbols).symbols, ['TCS', 'INFY']);
});

test('a screen with any universe beyond its watchlists, or none at all, runs at once', () => {
  const none = () => [];
  assert.equal(isRunnable(EMPTY_SCREEN, none), true);
  assert.equal(
    isRunnable(screen({universes: ['wl:core', 'nifty50']}), none),
    true,
  );
  assert.equal(isRunnable(screen({universes: ['wl:a', 'wl:b']}), none), false);
  assert.equal(
    isRunnable(screen({universes: ['wl:a', 'wl:b']}), id =>
      id === 'b' ? ['TCS'] : [],
    ),
    true,
  );
  assert.deepEqual(
    toRequest(
      screen({
        universes: ['nifty50', 'wl:b'],
        industries: ['financial-services'],
        filters: [{field: 'pe'}, {field: 'pe', max: 20}],
        columns: ['roe'],
      }),
      () => ['TCS'],
    ),
    {
      universes: ['nifty50'],
      symbols: ['TCS'],
      industries: ['financial-services'],
      filters: [{field: 'pe', max: 20}],
      columns: ['roe'],
    },
  );
});

// Encoded by the web app's encodeScreen (frontend 1485be7d), so a link shared from either app
// opens the same screen in the other.
const WEB_ENCODED =
  'JTdCJTIydSUyMiUzQSU1QiUyMm5pZnR5NTAlMjIlMkMlMjJ3bCUzQWNvcmUlMjIlNUQlMkMlMjJpJTIyJTNBJTVCJTIyZmluYW5jaWFsLXNlcnZpY2VzJTJGYmFua3MlMjIlNUQlMkMlMjJmJTIyJTNBJTVCJTdCJTIyZmllbGQlMjIlM0ElMjJyb2UlMjIlMkMlMjJtaW4lMjIlM0ExNSU3RCUyQyU3QiUyMmZpZWxkJTIyJTNBJTIyc21hNTAlNDAxNW0lMjIlMkMlMjJvcCUyMiUzQSUyMmd0JTIyJTJDJTIycmVmJTIyJTNBJTIyc21hMjAwJTQwMTVtJTIyJTJDJTIyZmFjdG9yJTIyJTNBMSU3RCUyQyU3QiUyMmZpZWxkJTIyJTNBJTIycGF0LmJ1bGxpc2hfZW5ndWxmaW5nJTIyJTJDJTIybWF4JTIyJTNBMCUyQyUyMmZsYWclMjIlM0F0cnVlJTdEJTVEJTJDJTIyYyUyMiUzQSU1QiUyMnBlJTIyJTVEJTJDJTIycyUyMiUzQSU3QiUyMmtleSUyMiUzQSUyMnJvZSUyMiUyQyUyMmRpciUyMiUzQSUyMmFzYyUyMiU3RCUyQyUyMnAlMjIlM0ElMjJxdWFsaXR5LWNvbXBvdW5kZXJzJTIyJTdE';

const SHARED: ScreenState = {
  universes: ['nifty50', 'wl:core'],
  industries: ['financial-services/banks'],
  filters: [
    {field: 'roe', min: 15},
    {field: 'sma50@15m', op: 'gt', ref: 'sma200@15m', factor: 1},
    {field: 'pat.bullish_engulfing', max: 0, flag: true},
  ],
  columns: ['pe'],
  sort: {key: 'roe', dir: 'asc'},
  preset: 'quality-compounders',
};

test('a screen packs into the same string the web packs it into, and back', () => {
  assert.equal(encodeScreen(SHARED), WEB_ENCODED);
  assert.deepEqual(decodeScreen(WEB_ENCODED), SHARED);
});

test('the round trip holds whatever padding the packing stripped', () => {
  for (const columns of [[], ['a'], ['ab'], ['abc']]) {
    const state = screen({columns});
    const packed = encodeScreen(state);
    assert.doesNotMatch(packed, /=/);
    assert.deepEqual(decodeScreen(packed), {...state, preset: undefined});
  }
});

test('a damaged or foreign link decodes to nothing, and a partial one to what it holds', () => {
  assert.equal(decodeScreen(null), null);
  assert.equal(decodeScreen(''), null);
  assert.equal(decodeScreen('!!!'), null);
  assert.equal(decodeScreen('eyJ1Ijp'), null);
  assert.equal(decodeScreen(btoa('null')), null);
  assert.equal(decodeScreen(btoa('5')), null);
  const partial = btoa(
    encodeURIComponent(
      JSON.stringify({
        u: ['nifty50', 7],
        f: [null, {field: 1}, {field: 'pe', max: 20}],
        s: {key: 'pe', dir: 'sideways'},
        p: 3,
      }),
    ),
  );
  assert.deepEqual(decodeScreen(partial), {
    universes: ['nifty50'],
    industries: [],
    filters: [{field: 'pe', max: 20}],
    columns: [],
    sort: {key: 'market_cap', dir: 'desc'},
    preset: undefined,
  });
});

test('pruning keeps a checked screen as the same object', () => {
  const state = screen({
    universes: ['nifty50', 'wl:core'],
    filters: [{field: 'rsi14@15m', max: 30}],
    columns: ['roe'],
  });
  const known = {
    universes: new Set(['nifty50', 'large']),
    watchlists: new Set(['wl:core']),
  };
  assert.equal(pruneScreen(state, index, known), state);
});

test('pruning drops what the catalogue cannot answer', () => {
  const state = screen({
    universes: ['nifty50', 'retired-index'],
    filters: [
      {field: 'roe', min: 15},
      {field: 'retired_field', min: 1},
      {field: 'sma200@1w', min: 1},
      {field: 'pe@15m', max: 20},
      {field: 'sma50@15m', ref: 'retired_field'},
      {field: 'pe', min: Number.NaN},
      {field: 'pe', ref: 'roe', factor: Infinity},
      {field: 'rsi14@5m', min: 70},
    ],
    columns: ['roe', 'retired_field', 'rsi14@1w', 'rsi14@3h'],
  });
  const pruned = pruneScreen(state, index, {universes: new Set(['nifty50'])});
  assert.notEqual(pruned, state);
  assert.deepEqual(pruned.universes, ['nifty50']);
  assert.deepEqual(pruned.filters, [
    {field: 'roe', min: 15},
    {field: 'rsi14@5m', min: 70},
  ]);
  assert.deepEqual(pruned.columns, ['roe', 'rsi14@1w']);
});

test('watchlists and industries are only pruned once they are known', () => {
  const state = screen({
    universes: ['wl:core', 'wl:deleted'],
    industries: ['financial-services', 'retired-sector'],
  });
  const loading = pruneScreen(state, index, {universes: new Set()});
  assert.equal(loading, state);
  const known = pruneScreen(state, index, {
    universes: new Set(),
    watchlists: new Set(['wl:core']),
    industries: new Map([['financial-services', {}]]),
  });
  assert.deepEqual(known.universes, ['wl:core']);
  assert.deepEqual(known.industries, ['financial-services']);
});

const row = (symbol: string, name: string, pe?: number): ScreenRow => ({
  symbol,
  ticker: symbol,
  name,
  industry: 'Banks',
  values: pe === undefined ? {} : {pe},
});

test('a company without the figure sorts last, whichever way the column runs', () => {
  const rows = [
    row('A', 'Axis', 18),
    row('B', 'Bandhan'),
    row('C', 'Canara', 6),
    row('D', 'DCB', 11),
  ];
  const symbols = (sorted: ScreenRow[]) => sorted.map(r => r.symbol);
  assert.deepEqual(symbols(sortScreenRows(rows, {key: 'pe', dir: 'desc'})), [
    'A',
    'D',
    'C',
    'B',
  ]);
  assert.deepEqual(symbols(sortScreenRows(rows, {key: 'pe', dir: 'asc'})), [
    'C',
    'D',
    'A',
    'B',
  ]);
  assert.deepEqual(symbols(sortScreenRows(rows, {key: 'name', dir: 'desc'})), [
    'D',
    'C',
    'B',
    'A',
  ]);
  assert.equal(sortScreenRows(rows, null), rows);
});
