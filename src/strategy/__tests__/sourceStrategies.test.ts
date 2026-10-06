import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StrategyLog, StrategyLogRow} from '../../types/strategyLogs.ts';
import {
  sourceLogTimeline,
  splitSharedIds,
  strategyCardSource,
} from '../sourceStrategies.ts';
import {findBacktestPayloadLog} from '../strategyStatus.ts';
import {strategy, UUID_A, UUID_B, UUID_C} from './fixtures.ts';

const shared = [strategy({strategy_id: UUID_A, is_backtest: true})];
const sharedLogs: StrategyLog[] = [
  {
    log_id: 1,
    strategy_id: UUID_A,
    log_level: 'info',
    payload: {final_balance: 110_000},
    created_at: '2026-10-01T10:00:00Z',
  },
];

test('strategyCardSource: a card naming a shared strategy reads the snapshot, read-only', () => {
  const source = strategyCardSource([UUID_B, UUID_A], {
    isReadOnly: false,
    sharedStrategies: shared,
    sharedLogs,
  });
  assert.deepEqual(source, {
    isReadOnly: true,
    sharedStrategies: shared,
    sharedLogs,
    fromSource: true,
  });
});

test('strategyCardSource: a card the viewer made stays live, with no snapshot', () => {
  assert.deepEqual(
    strategyCardSource([UUID_C], {
      isReadOnly: false,
      sharedStrategies: shared,
      sharedLogs,
    }),
    {isReadOnly: false, fromSource: false},
  );
});

test('strategyCardSource: a chat with no snapshot (a backend that sends none) is live', () => {
  assert.deepEqual(strategyCardSource([UUID_A], {isReadOnly: false}), {
    isReadOnly: false,
    fromSource: false,
  });
});

test('strategyCardSource: an id in capitals names the same shared strategy', () => {
  assert.equal(
    strategyCardSource([UUID_A.toUpperCase()], {
      isReadOnly: false,
      sharedStrategies: shared,
      sharedLogs,
    }).fromSource,
    true,
  );
});

test('splitSharedIds: the shared rows in the card’s order, the rest left live, each once', () => {
  const second = strategy({strategy_id: UUID_B, is_backtest: true});
  const {shared: rows, liveIds} = splitSharedIds(
    [UUID_C, UUID_B, UUID_A.toUpperCase(), UUID_C, UUID_A],
    [...shared, second],
  );
  assert.deepEqual(
    rows.map(row => row.strategy_id),
    [UUID_B, UUID_A],
  );
  assert.deepEqual(liveIds, [UUID_C]);
});

test('splitSharedIds: with no snapshot every id is live', () => {
  assert.deepEqual(splitSharedIds([UUID_A, UUID_B], undefined), {
    shared: [],
    liveIds: [UUID_A, UUID_B],
  });
});

test('strategyCardSource: a share link hands every card its snapshot as it is', () => {
  const chat = {isReadOnly: true, sharedStrategies: shared, sharedLogs};
  assert.deepEqual(strategyCardSource([UUID_C], chat), {
    ...chat,
    fromSource: false,
  });
});

const row = (
  o: Partial<StrategyLogRow> & {log_id: number},
): StrategyLogRow => ({
  strategy_id: UUID_A,
  log_level: 'info',
  created_at: '2026-10-01T10:00:00Z',
  symbol: 'TCS',
  ...o,
});

test('sourceLogTimeline: each raw row becomes a get-logs log item, newest first', () => {
  const timeline = sourceLogTimeline([
    row({log_id: 1, created_at: '2026-10-01T09:00:00Z', message: 'Started'}),
    row({
      log_id: 2,
      created_at: '2026-10-01T11:00:00Z',
      payload: {trades: [], final_balance: 100_000},
    }),
    row({log_id: 3, created_at: '2026-10-01T10:00:00+05:30'}),
  ]);
  assert.deepEqual(
    timeline.map(item => item.log.log_id),
    [2, 1, 3],
  );
  assert.deepEqual(timeline[1], {
    entry_type: 'log',
    created_at: '2026-10-01T09:00:00Z',
    log: {
      log_id: 1,
      strategy_id: UUID_A,
      log_level: 'info',
      message: 'Started',
      payload: null,
      symbol: 'TCS',
    },
  });
  assert.equal('message' in (timeline[0]?.log ?? {}), false);
});

test('sourceLogTimeline: read as the live feed is, the newest result row is the one found', () => {
  const logs: StrategyLog[] = sourceLogTimeline([
    row({log_id: 1, payload: {final_balance: 90_000}}),
    row({
      log_id: 2,
      created_at: '2026-10-02T10:00:00Z',
      payload: {final_balance: 120_000},
    }),
  ]).map(item => ({...item.log, created_at: item.created_at}));
  assert.equal(findBacktestPayloadLog(UUID_A, logs)?.log_id, 2);
});
