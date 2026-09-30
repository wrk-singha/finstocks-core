import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  StockWatchlist,
  StockWatchlistFlag,
} from '../../types/stockWatchlist.ts';
import {
  clearedItems,
  exceedsWatchlistCap,
  FLAG_COLORS,
  flagCounts,
  flaggedSymbols,
  flagsBySymbol,
  freshSymbols,
  hasSection,
  MAX_WATCHLIST_ITEMS,
  MAX_WATCHLISTS,
  pruneSections,
  sharedWatchlistPath,
  upsertWatchlist,
  watchlistMembership,
  withFlag,
  withItemsReplaced,
  withoutSection,
  withSectionRenamed,
  withSymbolMoved,
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

const flag = (
  symbol: string,
  color: StockWatchlistFlag['color'],
): StockWatchlistFlag => ({
  symbol,
  color,
  updated_at: '2026-09-01T00:00:00Z',
});

test('the seven flag colours run in TradingView’s order', () => {
  assert.deepEqual(FLAG_COLORS, [
    'red',
    'blue',
    'green',
    'orange',
    'purple',
    'cyan',
    'pink',
  ]);
});

test('a flag set goes first and replaces the symbol’s old colour; null clears it', () => {
  const flags = [flag('TCS', 'red'), flag('INFY', 'blue')];
  const set = withFlag(flags, 'INFY', 'green', '2026-09-30T00:00:00Z');
  assert.deepEqual(set, [
    {symbol: 'INFY', color: 'green', updated_at: '2026-09-30T00:00:00Z'},
    flag('TCS', 'red'),
  ]);
  assert.deepEqual(withFlag(flags, 'TCS', null, 'now'), [flag('INFY', 'blue')]);
  assert.deepEqual(withFlag(undefined, 'SBIN', 'red', 'now'), [
    {symbol: 'SBIN', color: 'red', updated_at: 'now'},
  ]);
  assert.equal(flags.length, 2);
});

test('flags read as one colour a symbol, a colour opens as its symbols, and counts skip the unused', () => {
  const bySymbol = flagsBySymbol([
    flag('TCS', 'red'),
    flag('INFY', 'blue'),
    flag('SBIN', 'red'),
  ]);
  assert.equal(bySymbol.get('INFY'), 'blue');
  assert.equal(bySymbol.get('WIPRO'), undefined);
  assert.deepEqual(flaggedSymbols(bySymbol, 'red'), ['TCS', 'SBIN']);
  assert.deepEqual(flaggedSymbols(bySymbol, 'pink'), []);
  assert.deepEqual(
    [...flagCounts(bySymbol)],
    [
      ['red', 2],
      ['blue', 1],
    ],
  );
});

test('a section name matches whatever its case', () => {
  const sections = [{name: 'Banks', symbols: []}];
  assert.equal(hasSection(sections, 'banks'), true);
  assert.equal(hasSection(sections, 'IT'), false);
});

test('a move files the symbol at the end of one section and takes it out of any other', () => {
  const sections = [
    {name: 'Banks', symbols: ['SBIN', 'HDFCBANK']},
    {name: 'IT', symbols: ['TCS']},
  ];
  assert.deepEqual(withSymbolMoved(sections, 'SBIN', 'IT'), [
    {name: 'Banks', symbols: ['HDFCBANK']},
    {name: 'IT', symbols: ['TCS', 'SBIN']},
  ]);
  assert.deepEqual(withSymbolMoved(sections, 'SBIN', null), [
    {name: 'Banks', symbols: ['HDFCBANK']},
    {name: 'IT', symbols: ['TCS']},
  ]);
  assert.deepEqual(withSymbolMoved(sections, 'TCS', 'IT'), sections);
  assert.deepEqual(sections[0]?.symbols, ['SBIN', 'HDFCBANK']);
});

test('a section renamed keeps its symbols; one removed leaves them unfiled', () => {
  const sections = [
    {name: 'Banks', symbols: ['SBIN']},
    {name: 'IT', symbols: ['TCS']},
  ];
  assert.deepEqual(withSectionRenamed(sections, 'IT', 'Tech'), [
    {name: 'Banks', symbols: ['SBIN']},
    {name: 'Tech', symbols: ['TCS']},
  ]);
  assert.deepEqual(withoutSection(sections, 'Banks'), [
    {name: 'IT', symbols: ['TCS']},
  ]);
});

test('Clear list takes every symbol off and keeps the sections, empty', () => {
  const cleared = clearedItems(
    list('a', ['TCS', 'SBIN'], [{name: 'Banks', symbols: ['SBIN']}]),
  );
  assert.deepEqual(cleared, {
    symbols: [],
    sections: [{name: 'Banks', symbols: []}],
  });
});

test('a shared list opens under /watchlist/shared', () => {
  assert.equal(sharedWatchlistPath('ab12'), '/watchlist/shared/ab12');
  assert.equal(sharedWatchlistPath('a/b'), '/watchlist/shared/a%2Fb');
});
