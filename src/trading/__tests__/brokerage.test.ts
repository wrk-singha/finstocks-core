import assert from 'node:assert/strict';
import {test} from 'node:test';

import {computeBrokerageTotals, resolveBrokerageSegment} from '../brokerage.ts';
import type {BrokerageTrade} from '../brokerage.ts';
import {calculateBrokerage} from '../brokerageCalculator.ts';

test('computeBrokerageTotals skips open trades and bills DP once per scrip-day', () => {
  const trades = [
    {
      symbol: 'INFY',
      buy_price: 100,
      sell_price: 110,
      quantity: 10,
      sell_time: '2026-09-10T09:15:00Z',
    },
    {
      symbol: 'INFY',
      buy_price: 100,
      sell_price: 112,
      quantity: 10,
      sell_time: '2026-09-10T14:00:00Z',
    },
    {
      symbol: 'INFY',
      buy_price: 100,
      sell_price: 105,
      quantity: 10,
      sell_time: '2026-09-11T10:00:00Z',
    },
    {symbol: 'TCS', buy_price: 100, sell_price: null, quantity: 10},
  ];
  const totals = computeBrokerageTotals(trades, 'zerodha', 'delivery');
  assert.equal(totals.dpCharges, 15.34 * 2);
  assert.equal(totals.grossPnl, 100 + 120 + 50);
  const perTrade = trades
    .slice(0, 3)
    .map(t =>
      calculateBrokerage(
        t.buy_price,
        t.sell_price ?? 0,
        t.quantity,
        'delivery',
        'zerodha',
      ),
    );
  const expected = perTrade.reduce((s, c) => s + c.totalCharges, 0) - 15.34;
  assert.ok(Math.abs(totals.totalCharges - expected) < 1e-9);
  assert.ok(Math.abs(totals.netPnl - (270 - expected)) < 1e-9);
});

test('a trade without symbol or sell time keeps its own DP fee', () => {
  const totals = computeBrokerageTotals(
    [
      {buy_price: 100, sell_price: 110, quantity: 10},
      {buy_price: 100, sell_price: 110, quantity: 10},
    ],
    'dhann',
    'delivery',
  );
  assert.equal(totals.dpCharges, 14.75 * 2);
});

test('a missing, NaN or numeric-string field reads as web reads it, not as NaN', () => {
  const sbin = (over: Record<string, unknown>) =>
    ({
      symbol: 'SBIN',
      buy_price: 800,
      sell_price: 810,
      quantity: 15,
      sell_time: '2026-10-27T10:00:00',
      ...over,
    }) as BrokerageTrade;
  const total = (t: BrokerageTrade) =>
    computeBrokerageTotals([t], 'zerodha', 'delivery');
  // A NaN sell is no sale: skipped like an open trade.
  assert.deepEqual(
    total(sbin({sell_price: Number.NaN})),
    total(sbin({sell_price: null})),
  );
  // A NaN buy price or quantity counts as 0, as a missing one does.
  assert.deepEqual(
    total(sbin({buy_price: Number.NaN})),
    total(sbin({buy_price: undefined})),
  );
  assert.equal(total(sbin({buy_price: Number.NaN})).grossPnl, 810 * 15);
  assert.equal(total(sbin({quantity: Number.NaN})).totalCharges, 0);
  // A numeric string is its number.
  assert.deepEqual(
    total(sbin({buy_price: '800', sell_price: '810', quantity: '15'})),
    total(sbin({})),
  );
  assert.equal(total(sbin({sell_price: ''})).totalCharges, 0);
});

test('resolveBrokerageSegment reads the strategy first, then average hold time', () => {
  assert.equal(
    resolveBrokerageSegment({symbol: 'NIFTY24JUL22000CE'}),
    'options',
  );
  assert.equal(resolveBrokerageSegment({symbol: 'NIFTY24JULFUT'}), 'futures');
  assert.equal(
    resolveBrokerageSegment({symbol: 'INFY', is_fno: true}),
    'futures',
  );
  assert.equal(
    resolveBrokerageSegment({symbol: 'INFY', is_intraday: true}),
    'intraday',
  );
  assert.equal(resolveBrokerageSegment({symbol: 'INFY'}), 'delivery');
  // A stock whose name ends in CE or PE is the stock, not an option: only a strike then CE or PE
  // is a contract.
  assert.equal(resolveBrokerageSegment({symbol: 'RELIANCE'}), 'delivery');
  assert.equal(
    resolveBrokerageSegment({symbol: 'RELIANCE', is_intraday: true}),
    'intraday',
  );
  assert.equal(resolveBrokerageSegment({symbol: 'BAJFINANCE'}), 'delivery');
  assert.equal(
    resolveBrokerageSegment({symbol: 'RELIANCE24JUL3000PE'}),
    'options',
  );
  // The spaced contract form is an option still, as the backend reads it: not futures.
  assert.equal(
    resolveBrokerageSegment({symbol: 'NIFTY 24DEC 24000 CE'}),
    'options',
  );
  assert.equal(
    resolveBrokerageSegment({symbol: 'BANKNIFTY 26NOV 52000 PE', is_fno: true}),
    'options',
  );
  // A spaced strike stands as its own word of three digits or more, or follows an expiry; a name
  // that merely ends in a number and CE/PE is not a contract, and only a plain space separates.
  const seg = (symbol: string) =>
    resolveBrokerageSegment({symbol, is_fno: false, is_intraday: false});
  for (const symbol of [
    'TCS 24DEC 3000 PE',
    'RELIANCE 2900 CE',
    'IDEA 24DEC 10 CE',
    'NIFTY 24DEC25 24000.5 PE',
    'X1CE',
  ]) {
    assert.equal(seg(symbol), 'options', symbol);
  }
  for (const symbol of [
    'NV20 PE',
    'MIDCAP150 PE',
    'ABC 2 PE',
    'NIFTY50\tCE',
    'X 1\nPE',
    '24000  CE',
    'RELIANCE 2900 CE ',
  ]) {
    assert.equal(seg(symbol), 'delivery', symbol);
  }
  // An index name stays the index's (futures), as web reads it.
  assert.equal(seg('NIFTY 50 PE'), 'futures');
  assert.equal(resolveBrokerageSegment(undefined), 'delivery');
  assert.equal(
    resolveBrokerageSegment(undefined, [
      {buy_time: '2026-09-10T04:00:00Z', sell_time: '2026-09-10T09:00:00Z'},
    ]),
    'intraday',
  );
  assert.equal(
    resolveBrokerageSegment(undefined, [
      {buy_time: '2026-09-08T04:00:00Z', sell_time: '2026-09-10T09:00:00Z'},
      {buy_time: '2026-09-10T04:00:00Z', sell_time: null},
    ]),
    'delivery',
  );
});
