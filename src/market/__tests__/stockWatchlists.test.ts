import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StockWatchlist} from '../../types/stockWatchlist.ts';
import {
  exceedsWatchlistCap,
  freshSymbols,
  MAX_WATCHLIST_ITEMS,
  MAX_WATCHLISTS,
  pruneSections,
  upsertWatchlist,
  watchlistMembership,
  withItemsReplaced,
  withSymbolRemoved,
  withSymbolsAdded,
} from '../stockWatchlists.ts';

const list = (
  id: string,
  symbols: string[],
  sections: StockWatchlist['sections'] = [],
): StockWatchlist => ({
  id,
  name: `List ${id}`,
  description: '',
  symbols,
  sections,
  share_id: null,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
});

test('the caps are the server’s: 20 lists, 250 symbols a list', () => {
  assert.equal(MAX_WATCHLISTS, 20);
  assert.equal(MAX_WATCHLIST_ITEMS, 250);
});

test('sections keep only symbols still on the list, and keep their order', () => {
  const sections = [
    {name: 'Banks', symbols: ['HDFCBANK', 'ICICIBANK']},
    {name: 'IT', symbols: ['TCS']},
  ];
  assert.deepEqual(pruneSections(sections, ['ICICIBANK', 'RELIANCE']), [
    {name: 'Banks', symbols: ['ICICIBANK']},
    {name: 'IT', symbols: []},
  ]);
  assert.deepEqual(sections[0]?.symbols, ['HDFCBANK', 'ICICIBANK']);
});

test('fresh symbols drop repeats and what the list already holds', () => {
  const held = list('a', ['TCS']);
  assert.deepEqual(freshSymbols(held, ['INFY', 'TCS', 'INFY', 'WIPRO']), [
    'INFY',
    'WIPRO',
  ]);
  assert.deepEqual(freshSymbols(held, ['TCS']), []);
  assert.deepEqual(freshSymbols(undefined, ['TCS', 'TCS']), ['TCS']);
});

test('the cap check counts the whole batch, since the server refuses it whole', () => {
  const nearlyFull = list(
    'a',
    Array.from({length: MAX_WATCHLIST_ITEMS - 1}, (_, i) => `S${String(i)}`),
  );
  assert.equal(exceedsWatchlistCap(nearlyFull, 1), false);
  assert.equal(exceedsWatchlistCap(nearlyFull, 2), true);
});

test('an add goes on top, once', () => {
  const next = withSymbolsAdded(list('a', ['TCS', 'INFY']), [
    'RELIANCE',
    'TCS',
    'RELIANCE',
  ]);
  assert.deepEqual(next.symbols, ['RELIANCE', 'TCS', 'INFY']);
});

test('a removal prunes the sections that held it', () => {
  const next = withSymbolRemoved(
    list('a', ['TCS', 'INFY'], [{name: 'IT', symbols: ['TCS', 'INFY']}]),
    'TCS',
  );
  assert.deepEqual(next.symbols, ['INFY']);
  assert.deepEqual(next.sections, [{name: 'IT', symbols: ['INFY']}]);
});

test('a replace takes the new order and drops section entries off the list', () => {
  const next = withItemsReplaced(
    list('a', ['TCS', 'INFY']),
    ['INFY', 'TCS'],
    [{name: 'IT', symbols: ['TCS', 'WIPRO']}],
  );
  assert.deepEqual(next.symbols, ['INFY', 'TCS']);
  assert.deepEqual(next.sections, [{name: 'IT', symbols: ['TCS']}]);
});

test('an upsert replaces the row with its id, or joins the end', () => {
  const rows = [list('a', ['TCS']), list('b', [])];
  const renamed = {...list('a', ['TCS']), name: 'Tech'};
  assert.deepEqual(
    upsertWatchlist(rows, renamed).map(row => row.name),
    ['Tech', 'List b'],
  );
  assert.deepEqual(
    upsertWatchlist(rows, list('c', [])).map(row => row.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    upsertWatchlist(undefined, list('c', [])).map(row => row.id),
    ['c'],
  );
});

test('membership answers "on this list" and "on any list"', () => {
  const {byListId, all} = watchlistMembership([
    list('a', ['TCS', 'INFY']),
    list('b', ['TCS', 'RELIANCE']),
  ]);
  assert.equal(byListId.get('a')?.has('INFY'), true);
  assert.equal(byListId.get('b')?.has('INFY'), false);
  assert.deepEqual([...all].sort(), ['INFY', 'RELIANCE', 'TCS']);
  assert.equal(watchlistMembership([]).all.size, 0);
});
