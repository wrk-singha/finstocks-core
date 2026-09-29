import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {
  FundamentalCatalog,
  FundamentalSeries,
} from '../../types/fundamentalSeries.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

const CATALOG: FundamentalCatalog = {
  symbol: 'M&M',
  basis: 'C',
  groups: [{id: 'pl', label: 'Income statement'}],
  metrics: [
    {
      id: 'net_sales',
      label: 'Net sales',
      group: 'pl',
      section: 'Revenue',
      unit: 'crore',
      level: 0,
      periods: ['Q', 'A', 'TTM'],
      aliases: ['Revenue'],
      available: {Q: 13, A: 11, TTM: 10},
    },
  ],
};

test('the catalogue is read for one company, as served', async () => {
  const {http, calls} = fakeHttp([CATALOG]);
  const catalog = await marketApi(http).getFundamentalCatalog('M&M');
  assert.equal(calls[0]?.path, '/news/fundamentals/metrics?symbol=M%26M');
  assert.equal(calls[0]?.init, undefined);
  assert.deepEqual(catalog, CATALOG);
});

test('the lists Go sends as null read as empty, and a null count map as none sent', async () => {
  const {http} = fakeHttp([
    {groups: null, metrics: null},
    {
      groups: [{id: 'pl', label: 'Income statement'}],
      metrics: [
        {
          id: 'net_sales',
          label: 'Net sales',
          group: 'pl',
          unit: 'crore',
          level: 0,
          periods: null,
          aliases: null,
          available: null,
        },
        {
          id: 'eps',
          label: 'EPS',
          group: 'pl',
          unit: 'rupees',
          level: 0,
          periods: ['Q'],
          available: {},
        },
      ],
    },
  ]);
  const api = marketApi(http);
  assert.deepEqual(await api.getFundamentalCatalog('TCS'), {
    groups: [],
    metrics: [],
  });
  const {metrics} = await api.getFundamentalCatalog('TCS');
  assert.deepEqual(metrics[0], {
    id: 'net_sales',
    label: 'Net sales',
    group: 'pl',
    unit: 'crore',
    level: 0,
    periods: [],
  });
  assert.equal('available' in (metrics[0] ?? {}), false);
  // An empty map is an answer: nothing on file at any period.
  assert.deepEqual(metrics[1]?.available, {});
});

test('a series is asked by company, line and period, and at the live price only when given', async () => {
  const series: FundamentalSeries = {
    symbol: 'TCS',
    metric: {
      id: 'pe',
      label: 'P/E',
      group: 'ratios',
      unit: 'x',
      level: 0,
      periods: ['D'],
    },
    period: 'D',
    basis: 'C',
    points: [{time: 1_758_844_800, period: '26 Sep 2026', value: 27.4}],
  };
  const {http, calls} = fakeHttp([series, series]);
  const api = marketApi(http);
  assert.deepEqual(await api.getFundamentalSeries('TCS', 'pe', 'D'), series);
  await api.getFundamentalSeries('TCS', 'pe', 'D', {
    price: 3120.5,
    at: 1_758_860_100,
  });
  assert.deepEqual(
    calls.map(call => call.path),
    [
      '/news/fundamentals/series?symbol=TCS&metric=pe&period=D',
      '/news/fundamentals/series?symbol=TCS&metric=pe&period=D&live_price=3120.5&live_at=1758860100',
    ],
  );
});

test('a series Go sent without points reads as none, its line filled like the catalogue', async () => {
  const {http} = fakeHttp([
    {
      symbol: 'TCS',
      metric: {
        id: 'inventory',
        label: 'Inventory',
        group: 'bs',
        unit: 'crore',
        level: 1,
        periods: null,
        aliases: null,
      },
      period: 'A',
      basis: 'C',
      points: null,
    },
  ]);
  const series = await marketApi(http).getFundamentalSeries(
    'TCS',
    'inventory',
    'A',
  );
  assert.deepEqual(series.points, []);
  assert.deepEqual(series.metric, {
    id: 'inventory',
    label: 'Inventory',
    group: 'bs',
    unit: 'crore',
    level: 1,
    periods: [],
  });
});

test('each company, line, period and live price is a cache entry of its own', () => {
  assert.deepEqual(queryKeys.fundamentalCatalog('TCS'), [
    'fundamental-catalog',
    'TCS',
  ]);
  assert.deepEqual(queryKeys.fundamentalSeries('TCS', 'pe', 'D'), [
    'fundamental-series',
    'TCS',
    'pe',
    'D',
  ]);
  assert.notDeepEqual(
    queryKeys.fundamentalSeries('TCS', 'pe', 'D'),
    queryKeys.fundamentalSeries('TCS', 'pe', 'A'),
  );
  assert.deepEqual(
    queryKeys.fundamentalSeriesLive('TCS', 'pe', 3120.5, 1_758_860_100),
    ['fundamental-series-live', 'TCS', 'pe', 3120.5, 1_758_860_100],
  );
  // A line asked at the live price never shares the stored line's entry, or its prefix.
  const stored = queryKeys.fundamentalSeries('TCS', 'pe', 'D');
  const live = queryKeys.fundamentalSeriesLive('TCS', 'pe', 3120.5, 1);
  assert.notEqual(stored[0], live[0]);
});
