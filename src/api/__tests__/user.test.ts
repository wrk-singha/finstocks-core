import assert from 'node:assert/strict';
import {test} from 'node:test';

import {userApi} from '../user.ts';
import {fakeHttp} from './fakeHttp.ts';

test('account endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = userApi(http);
  await api.getUserProfile();
  await api.updatePassword({old: 'a', new: 'b'});
  await api.setService({service: 'zerodha'});
  await api.updatePreferences({});
  await api.acceptTerms({version: 2});
  await api.updatePushToken('tok', 'ios');
  await api.updatePushToken(null);
  await api.requestDeleteAccount();
  await api.confirmDeleteAccount('t');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/user-profile', undefined, undefined],
      ['/update-password', 'POST', {old: 'a', new: 'b'}],
      ['/set-service', 'POST', {service: 'zerodha'}],
      ['/update-preferences', 'POST', {}],
      ['/accept-terms', 'POST', {version: 2}],
      ['/push-token', 'PUT', {push_token: 'tok', platform: 'ios'}],
      ['/push-token', 'PUT', {push_token: null}],
      ['/user/delete-account', 'DELETE', undefined],
      ['/user/confirm-delete-account', 'DELETE', {token: 't'}],
    ],
  );
});
