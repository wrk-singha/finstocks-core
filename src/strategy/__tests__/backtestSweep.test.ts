import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {BacktestSweep} from '../../types/backtest.ts';
import type {ExecutionLogEntry} from '../../types/strategyLogs.ts';
import {buildSweepCurves, prepareSweep} from '../backtestSweep.ts';

const trade = (pnl: number, sellTime: string): ExecutionLogEntry => ({
  pnl,
  symbol: 'NIFTY100',
  buy_time: sellTime,
  quantity: 1,
  buy_price: 100,
  sell_time: sellTime,
  sell_price: 100 + pnl,
});

test('sweep curves with no series draw nothing around a centred baseline', () => {
  assert.deepEqual(buildSweepCurves([]), {curves: [], baseline: 0.5});
});

test('sweep curves share one y-scale and one x-axis, winner drawn last', () => {
  const {curves, baseline} = buildSweepCurves([
    {
      key: 'gainer',
      initialBalance: 100_000,
      isWinner: true,
      trades: [trade(10_000, '2026-01-02T10:00:00Z')],
    },
    {
      key: 'loser',
      initialBalance: 100_000,
      isWinner: false,
      trades: [
        trade(-5_000, '2026-01-01T10:00:00Z'),
        trade(-5_000, '2026-01-03T10:00:00Z'),
      ],
    },
  ]);
  // 90k..110k: the shared start sits mid-box for both, not at each curve's own extreme.
  assert.equal(baseline, 0.5);
  assert.deepEqual(curves, [
    {
      key: 'loser',
      isWinner: false,
      points: [
        {x: 0, y: 0.5},
        {x: 0.5, y: 0.25},
        {x: 1, y: 0},
      ],
    },
    {
      key: 'gainer',
      isWinner: true,
      points: [
        {x: 0, y: 0.5},
        {x: 0.5, y: 1},
      ],
    },
  ]);
});

test('sweep curves replay trades in sell order; an unreadable time sorts first', () => {
  const {curves} = buildSweepCurves([
    {
      key: 'a',
      initialBalance: 100_000,
      isWinner: true,
      trades: [
        trade(-5_000, '2026-01-03T10:00:00Z'),
        trade(2_000, 'not-a-time'),
      ],
    },
  ]);
  // 100k → 102k → 97k over 97k..102k.
  assert.deepEqual(
    curves[0]?.points.map(point => point.y),
    [0.6, 1, 0],
  );
});

test('a flat single curve does not divide by zero', () => {
  assert.deepEqual(
    buildSweepCurves([
      {key: 'flat', initialBalance: 50_000, isWinner: true, trades: []},
    ]),
    {
      curves: [{key: 'flat', isWinner: true, points: [{x: 0, y: 0}]}],
      baseline: 0,
    },
  );
});

const sweep: BacktestSweep = {
  stage: 'confirm',
  variants: [
    {
      label: 'RSI < 30',
      rows: [
        {k: 'Tickers', v: 'nifty100'},
        {k: 'Strategy Name', v: 'RSI dip buyer'},
        {k: 'Backtest Period', v: '2026-06-01 to 2026-09-01'},
        {k: 'Entry Condition', v: 'RSI < 30'},
      ],
    },
    {
      label: 'RSI < 40',
      rows: [
        {k: 'Tickers', v: 'NIFTY100'},
        {k: 'Start Date', v: '2026-06-01'},
        {k: 'Sizing Mode', v: 'percent of capital'},
        {k: 'Total Capital', v: '₹5,00,000'},
        {k: 'Position Sizing', v: '10%'},
      ],
    },
    {label: 'no period', rows: [{k: 'Tickers', v: 'TCS'}]},
  ],
};

test('a sweep prepares one create-backtest body per variant', () => {
  assert.deepEqual(prepareSweep(sweep, 'Sweep', '2026-09-11'), [
    {
      label: 'RSI < 30',
      request: {
        symbol: 'NIFTY100',
        strategy_hname: 'RSI dip buyer — RSI < 30',
        timeframe: '1d',
        is_intraday: false,
        execution_mode: 'LOOP',
        original_query: 'RSI < 30',
        allocated_amount: 100_000,
        start_date: '2026-06-01',
        end_date: '2026-09-01',
      },
    },
    {
      label: 'RSI < 40',
      request: {
        symbol: 'NIFTY100',
        strategy_hname: 'Sweep — RSI < 40',
        timeframe: '1d',
        is_intraday: false,
        execution_mode: 'LOOP',
        original_query: 'RSI < 40',
        allocated_amount: 10,
        sizing_mode: 'PERCENT',
        total_capital: 500_000,
        start_date: '2026-06-01',
        end_date: '2026-09-11',
      },
    },
    // No period: nothing to run, so no body rather than one the backend would reject.
    {label: 'no period', request: null},
  ]);
});

test('an open-ended sweep variant ends today by default', () => {
  const end = prepareSweep(sweep, 'Sweep')[1]?.request?.end_date;
  assert.match(end ?? '', /^\d{4}-\d{2}-\d{2}$/);
});

test('a variant with terms is prepared from them, rules as the query and the compiled FSM through', () => {
  const fsm = {initial_state: 'IDLE', states: {}};
  // The rows deliberately disagree with the terms: the prose beside "Tickers" must not become
  // the symbol when the tool already said which one it meant.
  const [variant] = prepareSweep(
    {
      stage: 'confirm',
      variants: [
        {
          label: 'RSI < 30',
          rows: [
            {k: 'Tickers', v: 'Tata Consultancy Services'},
            {k: 'Strategy Name', v: 'RSI dip buyer'},
            {k: 'Backtest Period', v: '2026-01-01 to 2026-02-01'},
          ],
          terms: {
            tickers: 'tcs',
            strategy_name: 'RSI Dip',
            entry_condition: 'RSI(14) < 30',
            exit_condition: 'RSI(14) > 70',
            backtest_start: '2026-06-01',
            backtest_end: '2026-09-01',
            fsm,
          },
        },
      ],
    },
    'Sweep',
    '2026-09-11',
  );
  assert.deepEqual(variant, {
    label: 'RSI < 30',
    request: {
      symbol: 'TCS',
      strategy_hname: 'RSI Dip — RSI < 30',
      timeframe: '1d',
      is_intraday: false,
      execution_mode: 'LOOP',
      original_query: 'RSI(14) < 30\nRSI(14) > 70',
      allocated_amount: 100_000,
      start_date: '2026-06-01',
      end_date: '2026-09-01',
      fsm,
    },
  });
});

test('a variant without terms carries no fsm key at all', () => {
  const request = prepareSweep(sweep, 'Sweep', '2026-09-11')[0]?.request;
  assert.ok(request);
  assert.equal('fsm' in request, false);
});
