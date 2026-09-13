import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  conflictWarning,
  findConflictingStrategies,
} from '../strategyConflicts.ts';
import {strategy, UUID_A} from './fixtures.ts';

const running = (symbol: string, o = {}) =>
  strategy({strategy_id: UUID_A, symbol, strategy_hname: `On ${symbol}`, ...o});

test('findConflictingStrategies matches running same-book strategies by underlying', () => {
  const strategies = [
    running('TCS'),
    running('TCS', {is_mock: true, strategy_hname: 'Mock TCS'}),
    running('TCS', {is_backtest: true}),
    running('TCS', {status: 'COMPLETED'}),
    running('NIFTY 50'),
    running('NIFTYBEES'),
    running('AMBUJACEM, TCS'),
    running('RELIANCE26JUNFUT'),
    strategy({
      strategy_id: UUID_A,
      symbol: '',
      stock_symbol: 'INFY',
      strategy_hname: '',
    }),
  ];
  assert.deepEqual(
    findConflictingStrategies('TCS, RELIANCE', strategies, false),
    ['On TCS', 'On AMBUJACEM, TCS', 'On RELIANCE26JUNFUT'],
  );
  assert.deepEqual(findConflictingStrategies('tcs', strategies, true), [
    'Mock TCS',
  ]);
  assert.deepEqual(findConflictingStrategies('NIFTY', strategies, false), []);
  assert.deepEqual(findConflictingStrategies('NIFTYBEES', strategies, false), [
    'On NIFTYBEES',
  ]);
  assert.deepEqual(findConflictingStrategies('INFY', strategies, false), [
    'Untitled strategy',
  ]);
  assert.deepEqual(findConflictingStrategies(undefined, strategies, false), []);
  assert.deepEqual(findConflictingStrategies('TCS', [], false), []);
  assert.deepEqual(
    findConflictingStrategies('CUSTOM_LIST', strategies, false),
    [],
  );
});

test('conflictWarning counts repeated titles and caps the list at three', () => {
  assert.equal(conflictWarning([]), '');
  assert.equal(
    conflictWarning(['RSI Dip']),
    '"RSI Dip" is already running on this stock. Creating this one means two strategies trading it at once.',
  );
  assert.equal(
    conflictWarning(['A', 'B', 'A', 'C']),
    '4 strategies are already running on these stocks: A (2), B, C. Creating this one adds another.',
  );
  assert.equal(
    conflictWarning(['A', 'B', 'C', 'D', 'D']),
    '5 strategies are already running on these stocks: D (2), A, B and 1 more. Creating this one adds another.',
  );
});
