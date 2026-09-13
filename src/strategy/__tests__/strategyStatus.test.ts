import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StrategyLog} from '../../types/strategyLogs.ts';
import {
  findBacktestPayloadLog,
  hasResultPayload,
  isAwaitingStart,
  isBacktestInProgress,
  isCompletedBacktest,
  isInProgress,
  isPaused,
  isTerminalStatus,
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
