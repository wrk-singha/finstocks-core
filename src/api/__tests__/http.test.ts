import assert from 'node:assert/strict';
import {test} from 'node:test';

import {endsSession, query, SESSION_UNAUTHORIZED, statusOf} from '../http.ts';

test('query skips undefined and null, encodes the rest', () => {
  assert.equal(query({}), '');
  assert.equal(query({a: 1, b: undefined, c: null}), '?a=1');
  assert.equal(query({mock: true, q: 'a b&c'}), '?mock=true&q=a%20b%26c');
});

test('statusOf reads the status off either host rejection', () => {
  // Mobile's ApiError carries the status itself; an axios error nests it in the response.
  const apiError = (status: number) =>
    Object.assign(new Error('failed'), {status});
  assert.equal(statusOf(apiError(404)), 404);
  assert.equal(statusOf(apiError(0)), 0);
  assert.equal(statusOf({response: {status: 502}}), 502);
});

test('statusOf has no status for anything else thrown', () => {
  assert.equal(statusOf(new Error('boom')), undefined);
  assert.equal(statusOf({response: {}}), undefined);
  assert.equal(statusOf({response: null}), undefined);
  assert.equal(statusOf({status: '404'}), undefined);
  assert.equal(statusOf('404'), undefined);
  assert.equal(statusOf(null), undefined);
  assert.equal(statusOf(undefined), undefined);
});

test('a 401 ends the session unless its route says otherwise', () => {
  // backend-go internal/middleware/auth.go TokenRequired: the words it refuses a token with.
  assert.deepEqual(SESSION_UNAUTHORIZED, [
    'Token is missing!',
    'Invalid token signature',
    'Invalid token',
    'User not found',
    'Session expired, please log in again',
  ]);
  // Any route, any words: fail closed.
  assert.equal(endsSession('Something unheard of'), true);
  assert.equal(endsSession('Invalid token', {}), true);
  // The route's own refusal, in its words, keeps the session; its other 401s do not.
  const own = {ownUnauthorized: 'Old password is incorrect'};
  assert.equal(endsSession('Old password is incorrect', own), false);
  assert.equal(endsSession('Session expired, please log in again', own), true);
  // A route that forwards another service's status: only the middleware's words end the session.
  const forwards = {forwardsUnauthorized: true};
  for (const words of SESSION_UNAUTHORIZED) {
    assert.equal(endsSession(words, forwards), true, words);
  }
  assert.equal(endsSession('Trade failed', forwards), false);
  assert.equal(endsSession('Could not start a voice session', forwards), false);
  assert.equal(endsSession('Request failed with status 401.', forwards), false);
});
