import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import {stockWatchlistsApi} from '../stockWatchlists.ts';
import {fakeHttp} from './fakeHttp.ts';

const section = {name: 'Banks', symbols: ['HDFCBANK']};

test('list reads and writes hit /stock-watchlists with web’s bodies', async () => {
  const {http, calls} = fakeHttp();
  const api = stockWatchlistsApi(http);
  await api.getStockWatchlists();
  await api.createStockWatchlist({name: 'Energy', symbols: ['RELIANCE']});
  await api.updateStockWatchlist({id: 'swl-1', name: 'Core'});
  await api.updateStockWatchlist({id: 'swl-1', description: 'Long holds'});
  await api.deleteStockWatchlist('swl-1');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/stock-watchlists', undefined, undefined],
      ['/stock-watchlists', 'POST', {name: 'Energy', symbols: ['RELIANCE']}],
      ['/stock-watchlists/swl-1', 'PATCH', {name: 'Core'}],
      ['/stock-watchlists/swl-1', 'PATCH', {description: 'Long holds'}],
      ['/stock-watchlists/swl-1', 'DELETE', undefined],
    ],
  );
});

test('items are added, removed by query and replaced whole', async () => {
  const {http, calls} = fakeHttp();
  const api = stockWatchlistsApi(http);
  await api.addStockWatchlistSymbols({id: 'swl-1', symbols: ['TCS', 'INFY']});
  await api.removeStockWatchlistSymbol({id: 'swl-1', symbol: 'M&M'});
  await api.replaceStockWatchlistItems({
    id: 'swl-1',
    symbols: ['HDFCBANK', 'TCS'],
    sections: [section],
  });
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/stock-watchlists/swl-1/items', 'POST', {symbols: ['TCS', 'INFY']}],
      ['/stock-watchlists/swl-1/items?symbol=M%26M', 'DELETE', undefined],
      [
        '/stock-watchlists/swl-1/items',
        'PUT',
        {symbols: ['HDFCBANK', 'TCS'], sections: [section]},
      ],
    ],
  );
});

test('copy, share, details, flags, the removed trail and search', async () => {
  const {http, calls} = fakeHttp();
  const api = stockWatchlistsApi(http);
  await api.copyStockWatchlist({id: 'swl-1', name: 'Core (copy)'});
  await api.shareStockWatchlist('swl-1');
  await api.unshareStockWatchlist('swl-1');
  await api.getStockWatchlistDetails('swl-1');
  await api.getStockWatchlistFlags();
  await api.setStockWatchlistFlag({symbol: 'TCS', color: 'red'});
  await api.setStockWatchlistFlag({symbol: 'TCS', color: null});
  await api.getRemovedWatchlistSymbols();
  await api.restoreRemovedWatchlistSymbol({symbol: 'TCS', listId: 'swl-1'});
  await api.searchWatchlistSymbols('nifty bank', 'index');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/stock-watchlists/swl-1/copy', 'POST', {name: 'Core (copy)'}],
      ['/stock-watchlists/swl-1/share', 'POST', undefined],
      ['/stock-watchlists/swl-1/share', 'DELETE', undefined],
      ['/stock-watchlists/swl-1/details', undefined, undefined],
      ['/stock-watchlist-flags', undefined, undefined],
      ['/stock-watchlist-flags', 'PUT', {symbol: 'TCS', color: 'red'}],
      ['/stock-watchlist-flags', 'PUT', {symbol: 'TCS', color: ''}],
      ['/stock-watchlist-removed', undefined, undefined],
      [
        '/stock-watchlist-removed/restore',
        'POST',
        {symbol: 'TCS', list_id: 'swl-1'},
      ],
      [
        '/stock-watchlist-search?q=nifty%20bank&type=index',
        undefined,
        undefined,
      ],
    ],
  );
});

test('ids are encoded, and a shared list is fetched without the bearer', async () => {
  const {http, last} = fakeHttp();
  const api = stockWatchlistsApi(http);
  await api.deleteStockWatchlist('a/b');
  assert.equal(last().path, '/stock-watchlists/a%2Fb');
  await api.getSharedStockWatchlist('share 1');
  assert.equal(last().path, '/share/stock-watchlists/share%201');
  assert.equal(last().init?.anonymous, true);
});

test('the cache keys are the arrays web builds inline', () => {
  const keys = queryKeys.stockWatchlists;
  assert.deepEqual(keys.lists(), ['stock-watchlists']);
  assert.deepEqual(keys.writes(), ['stock-watchlists', 'write']);
  assert.deepEqual(keys.details('swl-1', ['TCS', 'INFY']), [
    'stock-watchlists',
    'details',
    'swl-1',
    'TCS,INFY',
  ]);
  assert.deepEqual(keys.flags(), ['stock-watchlists', 'flags']);
  assert.deepEqual(keys.removed(), ['stock-watchlists', 'removed']);
  assert.deepEqual(keys.search('  reliance ', 'stock'), [
    'stock-watchlists',
    'search',
    'stock',
    'RELIANCE',
  ]);
  assert.deepEqual(queryKeys.sharedStockWatchlist('abc'), [
    'shared-stock-watchlist',
    'abc',
  ]);
});

test('every other stock-watchlist key sits under the lists prefix', () => {
  const [prefix] = queryKeys.stockWatchlists.lists();
  const keys = queryKeys.stockWatchlists;
  for (const key of [
    keys.details(undefined, []),
    keys.flags(),
    keys.removed(),
    keys.search('x', 'all'),
  ]) {
    assert.equal(key[0], prefix);
  }
  assert.notEqual(queryKeys.sharedStockWatchlist('abc')[0], prefix);
});
