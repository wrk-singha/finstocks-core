import assert from 'node:assert/strict';
import {test} from 'node:test';

import {preTradeNote} from '../behaviourMirror.ts';
import {DAY, HOUR, trade} from './fixtures.ts';

const NOW = Date.UTC(2026, 8, 13, 10);

const closed = (
  symbol: string,
  pnlPerUnit: number,
  soldAgoMs: number,
  quantity = 10,
) =>
  trade({
    stock_symbol: symbol,
    quantity,
    buy_price: 100,
    sell_price: 100 + pnlPerUnit,
    buy_time: new Date(NOW - soldAgoMs - HOUR).toISOString(),
    sell_time: new Date(NOW - soldAgoMs).toISOString(),
  });

const history = [
  closed('TCS', 5, 10 * DAY),
  closed('INFY', 5, 20 * DAY),
  closed('HDFC', 5, 30 * DAY),
  closed('ITC', 5, 40 * DAY),
  closed('SBIN', 5, 50 * DAY),
  closed('WIPRO', 5, 60 * DAY),
];

test('silent below five round-trips, and on open positions', () => {
  assert.equal(preTradeNote(undefined, {symbol: 'X', now: NOW}), null);
  assert.equal(
    preTradeNote(history.slice(0, 4), {symbol: 'X', now: NOW}),
    null,
  );
  assert.equal(
    preTradeNote([...history, trade()], {symbol: 'X', now: NOW}),
    null,
  );
});

test('a loss closed minutes ago speaks first, but only when it is a real dent', () => {
  const dent = [...history, closed('TCS', -10, 12 * 60_000)];
  assert.equal(
    preTradeNote(dent, {symbol: 'ANY', now: NOW}),
    'You closed a loss on TCS 12 min ago.',
  );
  // Median notional is ₹1,000; a ₹5 scratch is under the 2% floor.
  const scratch = [...history, closed('TCS', -0.5, 12 * 60_000, 1)];
  assert.equal(preTradeNote(scratch, {symbol: 'ANY', now: NOW}), null);
  // Recency matters as much as size.
  const stale = [...history, closed('TCS', -10, 2 * HOUR)];
  assert.equal(preTradeNote(stale, {symbol: 'ANY', now: NOW}), null);
});

test('order size against the usual notional — the line the web copy lacked', () => {
  assert.equal(
    preTradeNote(history, {symbol: 'X', orderValue: 3000, now: NOW}),
    'This is 3.0× your usual order size of ₹1,000.',
  );
  assert.equal(
    preTradeNote(history, {symbol: 'X', orderValue: 2000, now: NOW}),
    null,
  );
  assert.equal(
    preTradeNote(history, {
      symbol: 'X',
      orderValue: 3000,
      orderValueComparable: false,
      now: NOW,
    }),
    null,
  );
  // The web caller passes only {symbol}: no size line, no crash.
  assert.equal(preTradeNote(history, {symbol: 'X', now: NOW}), null);
});

test('a symbol this account keeps losing on', () => {
  const repeat = [
    ...history,
    closed('ZEEL', -3, 5 * DAY),
    closed('ZEEL', -4, 8 * DAY),
    closed('ZEEL', 2, 9 * DAY),
  ];
  assert.equal(
    preTradeNote(repeat, {symbol: 'ZEEL', now: NOW}),
    'ZEEL has closed at a loss 2 times for you in the last 90 days.',
  );
  assert.equal(preTradeNote(repeat, {symbol: 'TCS', now: NOW}), null);
  // Net positive on the name: the losses are not the story.
  const netUp = [
    ...history,
    closed('ZEEL', -1, 5 * DAY),
    closed('ZEEL', -1, 8 * DAY),
    closed('ZEEL', 9, 9 * DAY),
  ];
  assert.equal(preTradeNote(netUp, {symbol: 'ZEEL', now: NOW}), null);
});
