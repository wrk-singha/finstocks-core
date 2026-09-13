import assert from 'node:assert/strict';
import {test} from 'node:test';

import {authApi} from '../auth.ts';
import {fakeHttp} from './fakeHttp.ts';

test('pre-login endpoints are anonymous POSTs with snake_case bodies', async () => {
  const {http, calls} = fakeHttp();
  const api = authApi(http);
  await api.checkEmail('a@b.c');
  await api.joinWaitlist('a@b.c');
  await api.login('a@b.c', 'pw');
  await api.signup({
    username: 'u',
    email: 'a@b.c',
    password: 'pw',
    referral_code: 'R1',
  });
  await api.googleLogin('id-token', true);
  await api.sendOtp('k');
  await api.verifyOtp('k', '123456', 'R1');
  await api.forgotPassword('a@b.c');
  await api.resetPassword('tok', 'new');
  for (const call of calls) {
    assert.equal(call.init?.anonymous, true, call.path);
    assert.equal(call.init?.method, 'POST', call.path);
  }
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/auth/check-email',
      '/auth/waitlist',
      '/auth/login',
      '/auth/signup',
      '/auth/google-login',
      '/auth/send-otp',
      '/auth/verify-login-otp',
      '/auth/forgot-password',
      '/auth/reset-password',
    ],
  );
  assert.deepEqual(calls[3]?.init?.body, {
    username: 'u',
    email: 'a@b.c',
    password: 'pw',
    referral_code: 'R1',
  });
  assert.deepEqual(calls[4]?.init?.body, {
    token: 'id-token',
    marketing_opt_in: true,
  });
  assert.deepEqual(calls[6]?.init?.body, {
    key: 'k',
    otp: '123456',
    referral_code: 'R1',
  });
  assert.deepEqual(calls[8]?.init?.body, {token: 'tok', new_password: 'new'});
});

test('optional signup fields are omitted, not sent as undefined', async () => {
  const {http, last} = fakeHttp();
  await authApi(http).signup({username: 'u', email: 'e', password: 'p'});
  assert.deepEqual(last().init?.body, {
    username: 'u',
    email: 'e',
    password: 'p',
  });
});

test('verifyResetToken encodes the token; logout is an authenticated POST', async () => {
  const {http, calls} = fakeHttp();
  const api = authApi(http);
  await api.verifyResetToken('a b/c');
  await api.logout();
  assert.equal(calls[0]?.path, '/auth/verify-token?token=a%20b%2Fc');
  assert.equal(calls[0]?.init?.anonymous, true);
  assert.equal(calls[1]?.path, '/logout');
  assert.equal(calls[1]?.init?.method, 'POST');
  assert.equal(calls[1]?.init?.anonymous, undefined);
});
