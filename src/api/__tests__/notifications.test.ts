import assert from 'node:assert/strict';
import {test} from 'node:test';

import {notificationsApi} from '../notifications.ts';
import {fakeHttp} from './fakeHttp.ts';

test('inbox and preference endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = notificationsApi(http);
  await api.getNotifications();
  await api.getNotifications({cursor: 'c', limit: 50});
  await api.getPicksLog();
  await api.markRead('n1');
  await api.markAllRead();
  await api.remove('n1');
  await api.getPreferences();
  await api.updatePreferences({picks: false});
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/notifications', undefined, undefined],
      ['/notifications?cursor=c&limit=50', undefined, undefined],
      ['/picks-log', undefined, undefined],
      ['/notifications/n1/read', 'PUT', undefined],
      ['/notifications/read-all', 'PUT', undefined],
      ['/notifications/n1', 'DELETE', undefined],
      ['/notifications/preferences', undefined, undefined],
      ['/notifications/preferences', 'PUT', {preferences: {picks: false}}],
    ],
  );
});
