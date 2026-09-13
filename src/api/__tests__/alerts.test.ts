import assert from 'node:assert/strict';
import {test} from 'node:test';

import {alertsApi} from '../alerts.ts';
import {fakeHttp} from './fakeHttp.ts';

test('alert preference and history endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = alertsApi(http);
  await api.getPreferences('stocks');
  await api.updatePreferences('stocks', {enabled: true, channels: {}});
  await api.getHistory('fno');
  await api.getHistory('fno', 5);
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/alerts/preferences?scope=stocks', undefined, undefined],
      [
        '/alerts/preferences',
        'PUT',
        {scope: 'stocks', enabled: true, channels: {}},
      ],
      ['/alerts/history?scope=fno&limit=30', undefined, undefined],
      ['/alerts/history?scope=fno&limit=5', undefined, undefined],
    ],
  );
});
