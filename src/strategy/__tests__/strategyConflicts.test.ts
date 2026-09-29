import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  conflictWarning,
  findConflictingStrategies,
  strategiesMatchingSymbols,
  underlyingsOf,
} from '../strategyConflicts.ts';
import {strategy, UUID_A, UUID_B, UUID_C, UUID_D} from './fixtures.ts';

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

test('underlyingsOf splits a list, drops indices and baskets, and reads a contract as its stock', () => {
  assert.deepEqual(underlyingsOf('tcs, RELIANCE26JUNFUT/infy'), [
    'TCS',
    'RELIANCE',
    'INFY',
  ]);
  assert.deepEqual(
    underlyingsOf('NIFTY 50, NIFTY_BANK, BANKNIFTY, FNO, CUSTOM_LIST'),
    [],
  );
  assert.deepEqual(underlyingsOf('NIFTYBEES'), ['NIFTYBEES']);
  assert.deepEqual(underlyingsOf(' , '), []);
});

test('strategiesMatchingSymbols returns the rows, and a prefiltered set skips the book filter', () => {
  const tcs = strategy({strategy_id: UUID_A, symbol: 'TCS'});
  const paused = strategy({
    strategy_id: UUID_B,
    symbol: 'TCS26SEPFUT',
    status: 'PAUSED',
  });
  const mock = strategy({strategy_id: UUID_C, symbol: 'TCS', is_mock: true});
  const done = strategy({
    strategy_id: UUID_D,
    symbol: 'INFY, TCS',
    status: 'COMPLETED',
  });
  const index = strategy({strategy_id: 'idx', symbol: 'NIFTY100'});
  const all = [tcs, paused, mock, done, index];

  assert.deepEqual(strategiesMatchingSymbols('TCS', all, false), [tcs, paused]);
  assert.deepEqual(strategiesMatchingSymbols('TCS', all, true), [mock]);
  // The caller narrowed the set itself, so a finished or other-book row it passes still matches.
  assert.deepEqual(strategiesMatchingSymbols('tcs', all, false, true), [
    tcs,
    paused,
    mock,
    done,
  ]);
  // An index strategy never appears under a stock, nor under the index itself.
  assert.deepEqual(strategiesMatchingSymbols('NIFTY', all, false, true), []);
  assert.deepEqual(strategiesMatchingSymbols(undefined, all, false), []);
  assert.deepEqual(strategiesMatchingSymbols('TCS', undefined, false), []);
});

test('the book filter reads a null is_mock as the live book', () => {
  const unflagged = strategy({
    strategy_id: UUID_A,
    symbol: 'TCS',
    strategy_hname: 'Unflagged',
    is_mock: null as unknown as boolean,
  });
  assert.deepEqual(findConflictingStrategies('TCS', [unflagged], false), [
    'Unflagged',
  ]);
  assert.deepEqual(findConflictingStrategies('TCS', [unflagged], true), []);
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
