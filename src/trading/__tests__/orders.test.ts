import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {TradeData} from '../../types/user.ts';
import {clampToLot, deriveOrders, groupOrderLogByDay} from '../orders.ts';

const trade = (patch: Partial<TradeData>): TradeData => ({
  id: 't1',
  timestamp: '2026-09-10T03:45:00Z',
  stock_symbol: 'INFY',
  quantity: 10,
  buy_price: 100,
  sell_price: null,
  buy_time: '2026-09-10T04:00:00Z',
  sell_time: null,
  status: 'open',
  user_id: 'u',
  execution_strategy: null,
  ...patch,
});

test('clampToLot snaps down to whole lots and never below one', () => {
  assert.equal(clampToLot(130, 65), 130);
  assert.equal(clampToLot(100, 65), 65);
  assert.equal(clampToLot(0, 65), 65);
  assert.equal(clampToLot(-5, 65), 65);
  assert.equal(clampToLot(7.9, null), 7);
  assert.equal(clampToLot(0, undefined), 1);
});

test('deriveOrders splits round trips and falls back to the row timestamp', () => {
  const orders = deriveOrders([
    trade({
      sell_price: 110,
      sell_time: null,
      stock_symbol: 'BANKNIFTY24JULFUT',
    }),
    trade({id: 't2', quantity: 0}),
  ]);
  assert.deepEqual(
    orders.map(o => [o.id, o.side, o.price, o.at, o.isFno]),
    [
      ['t1-buy', 'BUY', 100, '2026-09-10T04:00:00Z', true],
      ['t1-sell', 'SELL', 110, '2026-09-10T03:45:00Z', true],
    ],
  );
  assert.deepEqual(
    groupOrderLogByDay(orders).map(d => [d.date, d.orders.length]),
    [['2026-09-10', 2]],
  );
  assert.deepEqual(
    groupOrderLogByDay([{...orders[0], at: 'nope'} as never]),
    [],
  );
});
