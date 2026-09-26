import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import {savedAlertsApi} from '../savedAlerts.ts';
import {fakeHttp} from './fakeHttp.ts';

test('saved alert endpoints keep the /watchlists path and body', async () => {
  const {http, calls} = fakeHttp();
  const api = savedAlertsApi(http);
  await api.getSavedAlerts();
  await api.saveSavedAlerts([{id: 'w1', name: 'n'} as never]);
  await api.deleteSavedAlert('w/1');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/watchlists', undefined, undefined],
      ['/watchlists', 'PUT', {watchlists: [{id: 'w1', name: 'n'}]}],
      ['/watchlists/w%2F1', 'DELETE', undefined],
    ],
  );
});

test('the saved alert cache keys keep the arrays they had before the rename', () => {
  assert.deepEqual(queryKeys.savedAlerts(), ['watchlists']);
  assert.deepEqual(queryKeys.pendingWatch(), ['watchlists', 'pending-watch']);
});
