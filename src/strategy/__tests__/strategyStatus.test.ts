import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StrategyLog} from '../../types/strategyLogs.ts';
import {
  findBacktestPayloadLog,
  hasResultPayload,
  isAwaitingStart,
  isBacktestInProgress,
  isCompletedBacktest,
  isConsoleActive,
  isInProgress,
  isPaused,
  isTerminalStatus,
  runStateOf,
  statusOf,
} from '../strategyStatus.ts';

test('status predicates read the upper-cased status', () => {
  assert.equal(statusOf({status: 'running'}), 'RUNNING');
  assert.equal(statusOf({}), '');
  assert.equal(isInProgress({status: 'running'}), true);
  assert.equal(isInProgress({status: 'BACKTESTING'}), true);
  assert.equal(isInProgress({status: 'COMPLETED'}), false);
  assert.equal(isAwaitingStart({status: 'PENDING'}), true);
  assert.equal(isAwaitingStart({status: 'RUNNING'}), false);
  assert.equal(isPaused({status: 'paused'}), true);
  assert.equal(isTerminalStatus('failed'), true);
  assert.equal(isTerminalStatus('RUNNING'), false);
  assert.equal(isTerminalStatus(undefined), false);
});

test('backtest predicates need the is_backtest flag except for BACKTEST_PENDING', () => {
  assert.equal(isBacktestInProgress({status: 'BACKTEST_PENDING'}), true);
  assert.equal(
    isBacktestInProgress({status: 'RUNNING', is_backtest: true}),
    true,
  );
  assert.equal(isBacktestInProgress({status: 'RUNNING'}), false);
  assert.equal(
    isCompletedBacktest({status: 'SUCCESS', is_backtest: true}),
    true,
  );
  assert.equal(isCompletedBacktest({status: 'SUCCESS'}), false);
});

test('a results payload is recognised by shape, so a 0-trade backtest still matches', () => {
  assert.equal(hasResultPayload({trades: []}), true);
  assert.equal(hasResultPayload({final_balance: 100000}), true);
  assert.equal(hasResultPayload({message: 'started'}), false);
  assert.equal(hasResultPayload(null), false);
});

test('findBacktestPayloadLog picks the results row of the right strategy', () => {
  const log = (id: string, payload: StrategyLog['payload']): StrategyLog => ({
    log_id: 1,
    strategy_id: id,
    log_level: 'INFO',
    payload,
    created_at: '2026-07-01T00:00:00Z',
  });
  const logs = [
    log('a', {message: 'x'}),
    log('b', {trades: []}),
    log('a', {initial_balance: 1}),
  ];
  assert.equal(findBacktestPayloadLog('a', logs)?.payload?.initial_balance, 1);
  assert.equal(findBacktestPayloadLog('c', logs), undefined);
  assert.equal(findBacktestPayloadLog('a', undefined), undefined);
});

test('runStateOf reads paused, then waiting to start, and calls every other status running', () => {
  assert.equal(runStateOf({status: 'paused'}), 'paused');
  assert.equal(runStateOf({status: 'PENDING'}), 'waiting');
  assert.equal(runStateOf({status: 'waiting'}), 'waiting');
  assert.equal(runStateOf({status: 'RUNNING'}), 'running');
  assert.equal(runStateOf({status: 'ACTIVE'}), 'running');
  assert.equal(runStateOf({}), 'running');
});

test('isConsoleActive is the Active rail for one book: live-open, no backtests, no autopilot rows', () => {
  const row = (o: {
    status?: string;
    is_mock?: boolean | null;
    is_backtest?: boolean;
    strategy_id?: string;
  }) => ({strategy_id: 'S-1', status: 'RUNNING', is_mock: true, ...o});
  for (const status of ['RUNNING', 'active', 'PENDING', 'WAITING', 'PAUSED']) {
    assert.equal(isConsoleActive(row({status}), true), true, status);
  }
  // A backtest in flight is in progress, but the rail files it under Archived.
  assert.equal(isConsoleActive(row({status: 'BACKTESTING'}), true), false);
  assert.equal(isConsoleActive(row({status: 'COMPLETED'}), true), false);
  assert.equal(isConsoleActive(row({is_backtest: true}), true), false);
  assert.equal(isConsoleActive(row({strategy_id: 'AP-7'}), true), false);
  assert.equal(isConsoleActive(row({}), false), false);
  // The API can send is_mock null: that row belongs to the live book.
  assert.equal(isConsoleActive(row({is_mock: null}), false), true);
  assert.equal(isConsoleActive(row({is_mock: null}), true), false);
});
