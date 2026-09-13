import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildCashFlows,
  clipToRange,
  contributionBySymbol,
  dayKey,
  latestCloseBySymbol,
  portfolioSeries,
  symbolSeries,
  toPercentSeries,
  totalsFrom,
  unitisedNavSeries,
  xirr,
} from '../netWorth.ts';
import {DAY, trade} from './fixtures.ts';

test('dayKey is the IST day, so a post-midnight AMO fill files under the right session', () => {
  // 20:30 UTC on 31 Aug is 02:00 IST on 1 Sep.
  assert.equal(dayKey('2026-08-31T20:30:00Z'), '2026-09-01');
  assert.equal(dayKey(new Date(Date.UTC(2026, 7, 31, 12))), '2026-08-31');
  assert.equal(dayKey(Date.UTC(2026, 7, 31, 12)), '2026-08-31');
  assert.equal(dayKey('garbage'), '');
  assert.equal(dayKey(null), '');
});

test('latestCloseBySymbol picks the newest finite close regardless of order', () => {
  assert.deepEqual(
    latestCloseBySymbol({
      A: [
        {time: '2026-08-02', close: 2},
        {time: '2026-08-03', close: Number.NaN},
        {time: '2026-08-01', close: 1},
      ],
      B: [],
    }),
    {A: 2},
  );
  assert.deepEqual(latestCloseBySymbol(undefined), {});
});

test('contributionBySymbol splits realised from unrealised and carries unpriced at cost', () => {
  const rows = contributionBySymbol(
    [
      trade({stock_symbol: 'A', quantity: 10, buy_price: 100}),
      trade({stock_symbol: 'A', quantity: 5, buy_price: 100, sell_price: 120}),
      trade({stock_symbol: 'B', quantity: 2, buy_price: 50}),
      trade({stock_symbol: 'C', quantity: 0, buy_price: 50}),
    ],
    {A: 110},
  );
  assert.deepEqual(rows, [
    {
      symbol: 'A',
      invested: 1000,
      current: 1100,
      realised: 100,
      unrealised: 100,
      pnl: 200,
      openQuantity: 10,
    },
    {
      symbol: 'B',
      invested: 100,
      current: 100,
      realised: 0,
      unrealised: 0,
      pnl: 0,
      openQuantity: 2,
    },
  ]);
  assert.deepEqual(totalsFrom(rows), {
    current: 1200,
    invested: 1100,
    unrealised: 100,
    realised: 100,
    returnPct: (100 / 1100) * 100,
  });
  assert.equal(totalsFrom([]).returnPct, 0);
});

test('buildCashFlows and xirr: 100 in, 110 out a year later is ~10%', () => {
  const t0 = Date.UTC(2025, 0, 1);
  const t1 = t0 + 365 * DAY;
  const flows = buildCashFlows(
    [
      trade({
        quantity: 1,
        buy_price: 100,
        buy_time: new Date(t0).toISOString(),
        sell_price: 110,
        sell_time: new Date(t1).toISOString(),
      }),
      trade({quantity: 1, buy_price: 50, buy_time: new Date(t0).toISOString()}),
    ],
    {RELIANCE: 55},
    t1,
  );
  assert.deepEqual(flows, [
    {time: t0, amount: -100},
    {time: t0, amount: -50},
    {time: t1, amount: 110},
    {time: t1, amount: 55},
  ]);
  const rate = xirr(flows);
  assert.ok(rate !== null && Math.abs(rate - 10) < 0.01);

  assert.equal(xirr([{time: t0, amount: -1}]), null);
  assert.equal(
    xirr([
      {time: t0, amount: -1},
      {time: t0 + DAY / 2, amount: 2},
    ]),
    null,
  );
  assert.equal(
    xirr([
      {time: t0, amount: -1},
      {time: t1, amount: -2},
    ]),
    null,
  );
});

test('portfolioSeries keeps a sold position on the dates it was held', () => {
  const series = {
    A: [
      {time: '2026-08-01T10:00:00Z', close: 10},
      {time: '2026-08-02T10:00:00Z', close: 12},
      {time: '2026-08-03T10:00:00Z', close: 14},
    ],
    B: [
      {time: '2026-08-01T10:00:00Z', close: 100},
      {time: '2026-08-03T10:00:00Z', close: 120},
    ],
  };
  const out = portfolioSeries(
    [
      trade({
        stock_symbol: 'A',
        quantity: 1,
        buy_price: 10,
        buy_time: '2026-08-01T05:00:00Z',
        sell_price: 12,
        sell_time: '2026-08-02T05:00:00Z',
      }),
      trade({
        stock_symbol: 'B',
        quantity: 1,
        buy_price: 100,
        buy_time: '2026-08-02T05:00:00Z',
      }),
    ],
    series,
  );
  // A held on the 1st only; B from the 2nd, forward-filled at 100 on the 2nd.
  assert.deepEqual(out.value, [
    {date: '2026-08-01', value: 10},
    {date: '2026-08-02', value: 100},
    {date: '2026-08-03', value: 120},
  ]);
  assert.deepEqual(out.invested, [
    {date: '2026-08-01', value: 10},
    {date: '2026-08-02', value: 100},
    {date: '2026-08-03', value: 100},
  ]);
  assert.deepEqual(portfolioSeries([], series), {value: [], invested: []});
});

test('unitisedNavSeries: new capital mints units, so a deposit does not lift the NAV', () => {
  const value = [
    {date: 'd1', value: 1000},
    {date: 'd2', value: 2100},
    {date: 'd3', value: 2310},
    {date: 'd4', value: 0},
    {date: 'd5', value: 500},
  ];
  const invested = [
    {date: 'd1', value: 1000},
    {date: 'd2', value: 2000},
    {date: 'd3', value: 2000},
    {date: 'd4', value: 0},
    {date: 'd5', value: 500},
  ];
  // d2: the ₹100 gain lands before the ₹1,000 deposit mints units, so NAV is
  // 1100 — a 10% move on the capital that was actually at work, not 5% on the
  // doubled book. d4/d5: redeemed flat, re-entered at the carried NAV.
  const nav = unitisedNavSeries(value, invested).map(p => Math.round(p.value));
  assert.deepEqual(nav, [1000, 1100, 1210, 1210, 1210]);
  assert.deepEqual(unitisedNavSeries([{date: 'd1', value: 0}], invested), []);
});

test('toPercentSeries, symbolSeries and clipToRange', () => {
  assert.deepEqual(
    toPercentSeries([
      {date: 'a', value: 0},
      {date: 'b', value: 200},
      {date: 'c', value: 250},
    ]),
    [
      {date: 'b', value: 0},
      {date: 'c', value: 25},
    ],
  );
  assert.deepEqual(toPercentSeries([{date: 'a', value: 0}]), []);

  assert.deepEqual(
    symbolSeries(
      {
        N: [
          {time: '2026-08-02T10:00:00Z', close: 2},
          {time: '2026-08-01T10:00:00Z', close: 1},
          {time: '2026-08-01T11:00:00Z', close: 1.5},
        ],
      },
      'N',
    ),
    [
      {date: '2026-08-01', value: 1.5},
      {date: '2026-08-02', value: 2},
    ],
  );
  assert.deepEqual(symbolSeries(undefined, 'N'), []);

  assert.deepEqual(
    clipToRange(
      [
        {date: '2026-01-01', value: 1},
        {date: '2026-01-02', value: 2},
        {date: '2026-01-03', value: 3},
      ],
      '2026-01-02',
      '2026-01-02',
    ),
    [{date: '2026-01-02', value: 2}],
  );
});
