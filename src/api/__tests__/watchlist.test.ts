import assert from 'node:assert/strict';
import {test} from 'node:test';

import {watchlistApi} from '../watchlist.ts';
import {fakeHttp} from './fakeHttp.ts';

test('watchlist endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = watchlistApi(http);
  await api.getWatchlists();
  await api.saveWatchlists([{id: 'w1', name: 'n'} as never]);
  await api.deleteWatchlist('w/1');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/watchlists', undefined, undefined],
      ['/watchlists', 'PUT', {watchlists: [{id: 'w1', name: 'n'}]}],
      ['/watchlists/w%2F1', 'DELETE', undefined],
    ],
  );
});
