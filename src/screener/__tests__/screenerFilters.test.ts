import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ScreenerStock} from '../../types/screener.ts';
import {
  applyScreenerFilters,
  buildScreenMessage,
  capBand,
  DEFAULTS,
  type Filters,
  mapSector,
  sortStocks,
  toBackendFilters,
} from '../screenerFilters.ts';

const stock = (
  o: Partial<ScreenerStock> & {symbol: string},
): ScreenerStock => ({
  name: null,
  sector: null,
  price: null,
  change_pct: null,
  mkt_cap: null,
  pe: null,
  rsi: null,
  roe: null,
  debt_equity: null,
  div_yield: null,
  trend_status: null,
  final_score: null,
  high_52w: null,
  low_52w: null,
  volume: null,
  in_holdings: null,
  in_watchlist: null,
  ...o,
});

const filters = (o: Partial<Filters>): Filters => ({
  ...DEFAULTS,
  funds: new Set(),
  techs: new Set(),
  custom: [],
  ...o,
});

test('toBackendFilters sends the server-side filters and the timeframe', () => {
  assert.deepEqual(toBackendFilters(DEFAULTS), {interval: '15m'});
  assert.deepEqual(
    toBackendFilters(
      filters({
        rsi: 'oversold',
        universe: 'nifty50',
        techs: new Set(['uptrend', 'near52w', 'highvol']),
        custom: [
          {key: 'rsi14', min: '30', max: '70'},
          {key: 'doji', flag: true},
        ],
      }),
      '1d',
    ),
    {
      interval: '1d',
      rsi_min: '0',
      rsi_max: '40',
      trend: 'Uptrend',
      near_52w_high: 'true',
      high_volume: 'true',
      universe: 'NIFTY 50',
      ind: 'rsi14:30:70,doji:true',
    },
  );
  assert.equal(
    toBackendFilters(filters({rsi: 'strong', universe: 'nifty500'})).universe,
    'NIFTY 500',
  );
  assert.equal(toBackendFilters(filters({rsi: 'neutral'})).rsi_max, '60');
});

test('mapSector and capBand coarsen the data into chips', () => {
  assert.equal(mapSector('Oil & Gas Refining'), 'Energy');
  assert.equal(mapSector('Software & Programming'), 'IT');
  assert.equal(mapSector('Private Sector Bank'), 'Financials');
  assert.equal(mapSector('Cement'), 'Infrastructure');
  assert.equal(mapSector('Textiles'), null);
  assert.equal(mapSector(null), null);
  assert.equal(capBand(250000), 'mega');
  assert.equal(capBand(60000), 'large');
  assert.equal(capBand(20000), 'mid');
  assert.equal(capBand(100), 'small');
  assert.equal(capBand(null), null);
});

test('sortStocks: score and most keys descend, P/E ascends, missing values sink', () => {
  const list = [
    stock({symbol: 'A', final_score: 1, pe: 30, rsi: null}),
    stock({symbol: 'B', final_score: null, pe: 10, rsi: 70}),
    stock({symbol: 'C', final_score: 5, pe: null, rsi: 40}),
  ];
  assert.deepEqual(
    sortStocks(list, 'score').map(s => s.symbol),
    ['C', 'A', 'B'],
  );
  assert.deepEqual(
    sortStocks(list, 'pe').map(s => s.symbol),
    ['B', 'A', 'C'],
  );
  assert.deepEqual(
    sortStocks(list, 'rsi').map(s => s.symbol),
    ['B', 'C', 'A'],
  );
});

test('applyScreenerFilters runs every client-side filter then sorts', () => {
  const universe = [
    stock({
      symbol: 'PASS',
      sector: 'Pharma',
      mkt_cap: 60000,
      rsi: 35,
      price: 400,
      roe: 20,
      debt_equity: 0.1,
      pe: 20,
      trend_status: 'Uptrend',
      final_score: 2,
    }),
    stock({
      symbol: 'RSI',
      sector: 'Pharma',
      mkt_cap: 60000,
      rsi: 55,
      price: 400,
      roe: 20,
      debt_equity: 0.1,
      pe: 20,
      trend_status: 'Uptrend',
      final_score: 9,
    }),
    stock({
      symbol: 'NULLS',
      sector: 'Pharma',
      mkt_cap: 60000,
      price: 400,
      roe: 20,
      debt_equity: 0.1,
      pe: 20,
      trend_status: 'Uptrend',
    }),
    stock({
      symbol: 'PE',
      sector: 'Pharma',
      mkt_cap: 60000,
      rsi: 35,
      price: 400,
      roe: 20,
      debt_equity: 0.1,
      pe: -3,
      trend_status: 'Uptrend',
    }),
  ];
  const f = filters({
    sector: 'Healthcare',
    mktCap: 'large',
    rsi: 'oversold',
    price: 'under500',
    funds: new Set(['roe15', 'lowdebt', 'pe25']),
    techs: new Set(['uptrend']),
  });
  assert.deepEqual(
    applyScreenerFilters(universe, f).map(s => s.symbol),
    ['PASS'],
  );
  assert.deepEqual(
    applyScreenerFilters(universe, DEFAULTS).map(s => s.symbol),
    ['RSI', 'PASS', 'NULLS', 'PE'],
  );
});

test('buildScreenMessage describes the active screen for the assistant', () => {
  const f = filters({
    sector: 'IT',
    rsi: 'oversold',
    funds: new Set(['pe25']),
    techs: new Set(['uptrend']),
    custom: [{key: 'rsi14', max: '40'}],
  });
  const options = [
    {
      key: 'rsi14',
      label: 'RSI 14',
      group: 'Momentum Indicators',
      kind: 'number' as const,
    },
  ];
  assert.equal(
    buildScreenMessage(f, [], 'Backtest', options),
    "Backtest a rule-based screen of Indian stocks over long-term historical data. Screen rules: sector IT, RSI oversold, P/E < 25, in an uptrend, RSI 14 ≤ 40. Re-apply the screen across the full history — don't backtest a fixed list of today's candidates.",
  );
  assert.equal(
    buildScreenMessage(
      DEFAULTS,
      [stock({symbol: 'TCS'}), stock({symbol: 'INFY'})],
      'Deploy',
    ),
    'Deploy a strategy over Indian stocks filtered by the current market. Candidates: TCS, INFY.',
  );
});
