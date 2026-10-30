import assert from 'node:assert/strict';
import {test} from 'node:test';

import {computeBrokerageTotals} from '../../trading/brokerage.ts';
import {calculateBrokerage} from '../../trading/brokerageCalculator.ts';
import type {RoundTrip} from '../roundTrips.ts';
import {chargesForTrips, netOfCharges} from '../tradeCharges.ts';

const trip = (over: Partial<RoundTrip> & Pick<RoundTrip, 'id'>): RoundTrip => ({
  symbol: 'TCS',
  side: 'long',
  qty: 10,
  entryMs: Date.parse('2026-10-20T04:00:00Z'),
  entryPrice: 1000,
  exitMs: Date.parse('2026-10-27T05:00:00Z'),
  exitPrice: 1020,
  pnl: 200,
  source: 'backtest',
  ...over,
});

test('DP is billed once per scrip on each IST day an exit falls on', () => {
  const trips = [
    trip({id: 'a'}),
    // 22:59 IST, still the 27th: no second fee.
    trip({id: 'b', exitMs: Date.parse('2026-10-27T17:29:00Z'), exitPrice: 990}),
    // Midnight IST is the 28th: a fee again.
    trip({
      id: 'c',
      exitMs: Date.parse('2026-10-27T18:30:00Z'),
      exitPrice: 1005,
    }),
    trip({id: 'd', symbol: 'INFY'}),
  ];
  const {byTrip, total} = chargesForTrips(trips, 'delivery', 'zerodha');
  const full = (exit: number) =>
    calculateBrokerage(1000, exit, 10, 'delivery', 'zerodha').totalCharges;
  assert.equal(byTrip.get('a'), full(1020));
  assert.equal(byTrip.get('b'), full(990) - 15.34);
  assert.equal(byTrip.get('c'), full(1005));
  assert.equal(byTrip.get('d'), full(1020));
  // The same trades as backtest rows (IST wall clock) bill the same total.
  const rows = [
    ['TCS', 1020, '2026-10-27T10:30:00'],
    ['TCS', 990, '2026-10-27T22:59:00'],
    ['TCS', 1005, '2026-10-28T00:00:00'],
    ['INFY', 1020, '2026-10-27T10:30:00'],
  ] as const;
  const totals = computeBrokerageTotals(
    rows.map(([symbol, sell_price, sell_time]) => ({
      symbol,
      buy_price: 1000,
      sell_price,
      quantity: 10,
      sell_time,
    })),
    'zerodha',
    'delivery',
  );
  assert.ok(Math.abs(total - totals.totalCharges) < 1e-9);
});

test('the first exit of a scrip-day carries its fee, whatever order the trips come in', () => {
  const late = trip({id: 'late', exitMs: Date.parse('2026-10-27T09:00:00Z')});
  const early = trip({id: 'early', exitPrice: 1010});
  const {byTrip} = chargesForTrips([late, early], 'delivery', 'dhann');
  assert.equal(
    byTrip.get('early'),
    calculateBrokerage(1000, 1010, 10, 'delivery', 'dhann').totalCharges,
  );
  assert.equal(
    byTrip.get('late'),
    calculateBrokerage(1000, 1020, 10, 'delivery', 'dhann').totalCharges -
      14.75,
  );
});

test('a short is sold first and bought back; open trips cost nothing yet', () => {
  const short = trip({
    id: 's',
    side: 'short',
    entryPrice: 1500,
    exitPrice: 1480,
    qty: 20,
  });
  const open = trip({id: 'o', exitMs: null, exitPrice: null, pnl: null});
  const summary = chargesForTrips([short, open], 'intraday', 'groww');
  const c = calculateBrokerage(1480, 1500, 20, 'intraday', 'groww');
  assert.equal(summary.byTrip.get('s'), c.totalCharges);
  assert.equal(summary.byTrip.has('o'), false);
  assert.equal(summary.total, c.totalCharges);
  assert.equal(summary.brokerage, c.brokerage);
  assert.equal(summary.taxes, c.totalCharges - c.brokerage);
});

test('netOfCharges takes each trade’s charges out of its result and leaves open ones', () => {
  const trips = [trip({id: 'a'}), trip({id: 'o', pnl: null})];
  const net = netOfCharges(trips, new Map([['a', 12.5]]));
  assert.equal(net[0]?.pnl, 187.5);
  assert.equal(net[1], trips[1]);
  assert.equal(netOfCharges([trip({id: 'x'})], new Map())[0]?.pnl, 200);
});
