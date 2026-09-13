import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {TradeData} from '../../types/user.ts';
import {
  countOrdersFromTrades,
  deriveOrdersFromTrades,
  groupOrdersByDay,
  isPartiallyFilled,
  normalizeOrderStatus,
  orderStatusLabel,
  orderStatusTone,
  tabForStatus,
} from '../ordersModel.ts';

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

test('normalizeOrderStatus maps broker spellings onto the enum', () => {
  assert.equal(normalizeOrderStatus('open'), 'APPROVED');
  assert.equal(normalizeOrderStatus('trigger pending'), 'TRIGGER_PENDING');
  assert.equal(normalizeOrderStatus('SL-M'), 'TRIGGER_PENDING');
  assert.equal(normalizeOrderStatus('cancelled'), 'CANCELLED');
  assert.equal(normalizeOrderStatus('weird'), 'UNKNOWN');
  assert.equal(normalizeOrderStatus(null), 'UNKNOWN');
});

test('tabs, labels and tones follow the status table', () => {
  assert.equal(tabForStatus('CANCELLATION_REQUESTED'), 'open');
  assert.equal(tabForStatus('DELIVERY_AWAITED'), 'executed');
  assert.equal(tabForStatus('REJECTED'), 'cancelled');
  assert.equal(orderStatusLabel('MODIFICATION_REQUESTED'), 'Modifying');
  assert.equal(orderStatusTone('EXECUTED'), 'success');
  assert.equal(orderStatusTone('FAILED'), 'error');
  assert.equal(orderStatusTone('NEW'), 'warning');
});

test('a closed trade is two orders, newest first, unknown status reads as executed', () => {
  const orders = deriveOrdersFromTrades([
    trade({
      sell_price: 110,
      sell_time: '2026-09-11T05:00:00Z',
      stock_symbol: 'NIFTY24JUL22000CE',
      order_status: 'open',
    }),
    trade({id: 't2', quantity: 0}),
    trade({id: 't3', buy_time: null, timestamp: '2026-09-09T10:00:00Z'}),
  ]);
  assert.deepEqual(
    orders.map(o => [o.id, o.side, o.status, o.placedAt]),
    [
      ['t1-sell', 'SELL', 'APPROVED', '2026-09-11T05:00:00Z'],
      ['t1-buy', 'BUY', 'APPROVED', '2026-09-10T04:00:00Z'],
      ['t3-buy', 'BUY', 'EXECUTED', '2026-09-09T10:00:00Z'],
    ],
  );
  assert.equal(orders[0]?.underlying, 'NIFTY');
  assert.equal(orders[0]?.isFno, true);
  assert.equal(
    countOrdersFromTrades([
      trade({sell_price: 110}),
      trade({id: 't2', quantity: 0}),
      trade({id: 't3'}),
    ]),
    3,
  );
  const first = orders[0];
  assert.ok(first);
  assert.equal(isPartiallyFilled({...first, filledQuantity: 4}), true);
  assert.equal(isPartiallyFilled(first), false);
});

test('groupOrdersByDay buckets consecutive rows and drops unparseable stamps', () => {
  const orders = deriveOrdersFromTrades([
    trade({sell_price: 110, sell_time: '2026-09-11T05:00:00Z'}),
    trade({id: 't3', buy_time: 'garbage'}),
  ]);
  const days = groupOrdersByDay(orders);
  assert.deepEqual(
    days.map(d => [d.date, d.orders.length]),
    [
      ['2026-09-11', 1],
      ['2026-09-10', 1],
    ],
  );
});
