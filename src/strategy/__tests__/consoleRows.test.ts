import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StrategyLog} from '../../types/strategyLogs.ts';
import type {StrategyPosition} from '../activeStrategies.ts';
import {
  chartSymbolFor,
  strategyMeta,
  toActivityRows,
  toClosedConsolePosition,
  toConsolePosition,
} from '../consoleRows.ts';
import {trade} from './fixtures.ts';

const position = (o: Partial<StrategyPosition>): StrategyPosition => ({
  id: 'p',
  symbol: 'TCS',
  shares: 12,
  value: 14448,
  pnl: 640,
  isOpen: true,
  buyPrice: 1204,
  buyTime: '2026-06-30T04:00:00Z',
  sellPrice: null,
  sellTime: null,
  trade: trade({id: 'p', stock_symbol: 'TCS'}),
  ...o,
});

test('toConsolePosition formats a priced open row and blanks an unpriced one', () => {
  assert.deepEqual(toConsolePosition(position({})), {
    sym: 'TCS',
    sub: '12 sh · avg ₹1,204.00',
    val: '₹14,448',
    pl: '+₹640',
    plp: '+4.4%',
    plpPositive: true,
  });
  const unpriced = toConsolePosition(position({pnl: null}));
  assert.deepEqual(
    [unpriced.pl, unpriced.plp, unpriced.plpPositive],
    ['—', '—', null],
  );
  assert.equal(toConsolePosition(position({pnl: 0.001})).pl, '—');
});

test('toClosedConsolePosition leads with realized P&L against the exited cost basis', () => {
  const row = toClosedConsolePosition(
    position({
      isOpen: false,
      buyPrice: 100,
      sellPrice: 110,
      sellTime: '2026-07-01T04:00:00Z',
      value: 1000,
      pnl: 100,
      shares: 10,
    }),
  );
  assert.deepEqual(row, {
    sym: 'TCS',
    // Dated with the year: a ledger that spans years would otherwise not say which July.
    sub: 'Buy ₹100.00 · Jun 30, 2026 9:30 AM  →  Sell ₹110.00 · Jul 1, 2026 9:30 AM',
    val: '+₹100',
    pl: '',
    plp: '+10.0%',
    plpPositive: true,
    closed: true,
  });
  assert.equal(chartSymbolFor([], [row]), 'TCS');
  assert.equal(
    chartSymbolFor([toConsolePosition(position({symbol: 'INFY'}))], [row]),
    'INFY',
  );
  assert.equal(chartSymbolFor([], []), '');
});

test('toActivityRows merges fills with warning/error logs, newest first, capped at 8', () => {
  const log = (o: Partial<StrategyLog>): StrategyLog => ({
    log_id: 1,
    strategy_id: 's',
    log_level: 'INFO',
    payload: null,
    created_at: '2026-07-02T04:00:00Z',
    ...o,
  });
  const rows = toActivityRows(
    [
      trade({
        id: 'sold',
        stock_symbol: 'RELIANCE',
        quantity: 10,
        buy_price: 100,
        sell_price: 110,
        buy_time: '2026-06-30T04:00:00Z',
        sell_time: '2026-07-01T04:00:00Z',
      }),
      trade({
        id: 'open',
        stock_symbol: 'TCS',
        quantity: 2,
        buy_price: 300,
        buy_time: '2026-07-04T04:00:00Z',
      }),
    ],
    [
      log({log_level: 'warning', message: 'Slippage high', symbol: 'TCS'}),
      log({log_level: 'INFO', message: 'tick'}),
      log({
        log_level: 'EXECUTION_ERROR',
        payload: {error: 'boom'},
        created_at: '2026-07-03T04:00:00Z',
      }),
    ],
  );
  assert.deepEqual(rows, [
    {
      side: 'BUY',
      sidePositive: true,
      sym: 'TCS',
      detail: '2 @ ₹300.00',
      t: 'Jul 4, 2026 9:30 AM',
    },
    {
      side: 'ERR',
      sidePositive: false,
      level: 'error',
      sym: 'System',
      detail: 'boom',
      t: 'Jul 3 9:30 AM',
    },
    {
      side: 'WARN',
      sidePositive: false,
      level: 'warning',
      sym: 'TCS',
      detail: 'Slippage high',
      t: 'Jul 2 9:30 AM',
    },
    {
      side: 'SELL',
      sidePositive: false,
      sym: 'RELIANCE',
      detail: '10 @ ₹110.00',
      t: 'Jul 1, 2026 9:30 AM',
    },
  ]);
  const many = Array.from({length: 10}, (_, i) =>
    trade({
      id: String(i),
      stock_symbol: 'X',
      buy_time: `2026-07-${String(10 + i)}T04:00:00Z`,
    }),
  );
  assert.equal(toActivityRows(many).length, 8);
});

test('strategyMeta chips', () => {
  assert.deepEqual(
    strategyMeta({execution_mode: 'loop', is_intraday: false, timeframe: '5m'}),
    ['LOOP', 'Positional', '5M'],
  );
  assert.deepEqual(strategyMeta({is_intraday: true}), ['Intraday']);
  assert.deepEqual(strategyMeta({}), []);
});
