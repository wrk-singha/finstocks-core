import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

test('the world indices narrow to one benchmark on request', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getWorldIndices();
  await api.getWorldIndices(92, 26);
  await api.getWorldIndices(30, undefined);
  assert.deepEqual(
    calls.map(call => call.path),
    [
      '/market/world-indices?days=30',
      '/market/world-indices?days=92&index_id=26',
      '/market/world-indices?days=30',
    ],
  );
});

test('the table and a one-index window never share a cache entry', () => {
  assert.deepEqual(queryKeys.market.worldIndices(30), [
    'world-indices',
    30,
    null,
  ]);
  assert.deepEqual(queryKeys.market.worldIndices(30, null), [
    'world-indices',
    30,
    null,
  ]);
  assert.deepEqual(queryKeys.market.worldIndices(92, 26), [
    'world-indices',
    92,
    26,
  ]);
});
