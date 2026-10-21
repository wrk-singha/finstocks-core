import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ExecutionLogEntry} from '../../types/strategyLogs.ts';
import type {TradeData} from '../../types/user.ts';
import {
  backtestRoundTrips,
  bookRoundTrips,
  tradeInstantMs,
  tripSymbols,
} from '../roundTrips.ts';

const row = (over: Partial<ExecutionLogEntry>): ExecutionLogEntry => ({
  pnl: 0,
  symbol: 'INFY',
  buy_time: '2026-09-01 09:20:00',
  quantity: 10,
  buy_price: 1500,
  sell_time: '2026-09-01 10:05:00',
  sell_price: 1510,
  ...over,
});

const lot = (over: Partial<TradeData>): TradeData => ({
  id: '1',
  timestamp: '2026-09-01T03:50:00Z',
  stock_symbol: 'INFY',
  quantity: 10,
  buy_price: 1500,
  sell_price: 1510,
  buy_time: '2026-09-01T03:50:00Z',
  sell_time: '2026-09-01T04:35:00Z',
  status: 'SIMULATION',
  user_id: 'u',
  execution_strategy: null,
  ...over,
});

test('a time with no offset is IST wall clock; one with an offset is read as written', () => {
  assert.equal(
    tradeInstantMs('2026-09-01 09:15:00'),
    Date.parse('2026-09-01T03:45:00Z'),
  );
  assert.equal(
    tradeInstantMs('2026-09-01T09:15'),
    Date.parse('2026-09-01T03:45:00Z'),
  );
  assert.equal(
    tradeInstantMs('2026-09-01'),
    Date.parse('2026-08-31T18:30:00Z'),
  );
  assert.equal(
    tradeInstantMs('2026-09-01T03:45:00Z'),
    Date.parse('2026-09-01T03:45:00Z'),
  );
  assert.equal(
    tradeInstantMs('2026-09-01T09:15:00+05:30'),
    Date.parse('2026-09-01T03:45:00Z'),
  );
  assert.equal(tradeInstantMs(''), null);
  assert.equal(tradeInstantMs(null), null);
  assert.equal(tradeInstantMs('yesterday'), null);
});

test("a backtest's rows become trips in entry order, short by the side's words, open without an exit", () => {
  const trips = backtestRoundTrips([
    row({buy_time: '2026-09-02 09:20:00', pnl: 100}),
    row({trade_side: 'SHORT', pnl: -50, exit_reason: 'STOP_LOSS'}),
    row({
      buy_time: '2026-09-03 09:20:00',
      sell_time: '',
      sell_price: 0,
      pnl: 0,
    }),
  ]);
  assert.deepEqual(
    trips.map(t => [t.id, t.side, t.pnl, t.exitReason ?? null]),
    [
      ['bt1', 'short', -50, 'STOP_LOSS'],
      ['bt0', 'long', 100, null],
      ['bt2', 'long', null, null],
    ],
  );
  const open = trips[2];
  assert.equal(open?.exitMs, null);
  assert.equal(open?.exitPrice, null);
  assert.equal(open?.source, 'backtest');
  assert.equal(trips[0]?.symbol, 'INFY');
});

test('a backtest row with no usable entry is left out; a symbol may ride as stock_symbol', () => {
  const trips = backtestRoundTrips([
    row({buy_price: 0}),
    row({buy_time: 'not a time'}),
    {...row({symbol: ''}), stock_symbol: 'tcs'} as ExecutionLogEntry,
  ]);
  assert.equal(trips.length, 1);
  assert.equal(trips[0]?.symbol, 'TCS');
  assert.deepEqual(backtestRoundTrips(undefined), []);
});

test("the book's Mock and Live lots are trips; a row in neither book is left out", () => {
  const trips = bookRoundTrips([
    lot({id: 'a'}),
    lot({id: 'b', status: 'LIVE', buy_time: '2026-09-02T03:50:00Z'}),
    lot({id: 'c', status: 'PENDING'}),
  ]);
  assert.deepEqual(
    trips.map(t => [t.id, t.source, t.pnl]),
    [
      ['a', 'mock', 100],
      ['b', 'live', 100],
    ],
  );
});

test('a short lot reads its entry from buy_* and its cover from sell_*; an open lot has no result', () => {
  const [short, open] = bookRoundTrips([
    lot({
      id: 's',
      execution_payload: JSON.stringify({transaction_type: 'SELL'}),
      buy_price: 1510,
      sell_price: 1500,
    }),
    lot({
      id: 'o',
      sell_price: null,
      sell_time: null,
      buy_time: '2026-09-02T03:50:00Z',
    }),
  ]);
  assert.equal(short?.side, 'short');
  assert.equal(short?.pnl, 100);
  assert.equal(open?.exitMs, null);
  assert.equal(open?.pnl, null);
});

test("a contract's exit premium is its exit price, and an index-scale entry is read in premium units", () => {
  const [trip] = bookRoundTrips([
    lot({
      stock_symbol: 'NIFTY26SEP25000CE',
      buy_price: 24100,
      sell_price: 24200,
      quantity: 75,
      execution_payload: JSON.stringify({buy_premium: 120, sell_premium: 150}),
    }),
  ]);
  assert.equal(trip?.entryPrice, 120);
  assert.equal(trip?.exitPrice, 150);
  assert.equal(trip?.pnl, 2250);
});

test('symbols are counted, most traded first, ties by name', () => {
  const trips = backtestRoundTrips([
    row({symbol: 'TCS'}),
    row({symbol: 'INFY'}),
    row({symbol: 'TCS'}),
    row({symbol: 'HDFC'}),
  ]);
  assert.deepEqual(tripSymbols(trips), [
    {symbol: 'TCS', count: 2},
    {symbol: 'HDFC', count: 1},
    {symbol: 'INFY', count: 1},
  ]);
});
