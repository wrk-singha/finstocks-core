import assert from 'node:assert/strict';
import {test} from 'node:test';

import {esfSubscribeRefusal} from '../basketSubscribe.ts';

const mobileError = (message: string, status: number) =>
  Object.assign(new Error(message), {status});

const axiosError = (error: string, status: number) =>
  Object.assign(
    new Error(`Request failed with status code ${String(status)}`),
    {
      response: {status, data: {error}},
    },
  );

test('409 is "already subscribed", in the backend\'s words, on either host\'s error shape', () => {
  assert.deepEqual(
    esfSubscribeRefusal(
      mobileError('You already subscribe to this basket', 409),
      'fallback',
    ),
    {
      kind: 'alreadySubscribed',
      message: 'You already subscribe to this basket',
    },
  );
  assert.deepEqual(
    esfSubscribeRefusal(
      axiosError('You already subscribe to this basket', 409),
      'fallback',
    ),
    {
      kind: 'alreadySubscribed',
      message: 'You already subscribe to this basket',
    },
  );
});

test("400 and 422 are invalid requests with the server's text; 412 is a live subscription with no broker", () => {
  assert.deepEqual(
    esfSubscribeRefusal(
      mobileError('capital must be at least ₹70000', 400),
      'x',
    ),
    {kind: 'invalid', message: 'capital must be at least ₹70000'},
  );
  assert.deepEqual(
    esfSubscribeRefusal(
      mobileError('confirm_live is required for live trading', 400),
      'x',
    ),
    {kind: 'invalid', message: 'confirm_live is required for live trading'},
  );
  assert.deepEqual(esfSubscribeRefusal(mobileError('', 422), 'fallback'), {
    kind: 'invalid',
    message: 'fallback',
  });
  assert.deepEqual(
    esfSubscribeRefusal(
      mobileError('Connect a broker to subscribe with real money', 412),
      'x',
    ),
    {
      kind: 'noBroker',
      message: 'Connect a broker to subscribe with real money',
    },
  );
  assert.equal(
    esfSubscribeRefusal(mobileError('Unauthorized', 401), 'x')?.kind,
    'refused',
  );
  assert.equal(
    esfSubscribeRefusal(mobileError('Not found', 404), 'x')?.kind,
    'refused',
  );
});

test('no status, a timeout, a 500 and a 502 are not refusals: the subscription may exist', () => {
  assert.equal(
    esfSubscribeRefusal(mobileError('Request timed out', 0), 'x'),
    null,
  );
  assert.equal(
    esfSubscribeRefusal(mobileError('Failed to subscribe', 500), 'x'),
    null,
  );
  assert.equal(esfSubscribeRefusal(axiosError('Bad gateway', 502), 'x'), null);
  assert.equal(esfSubscribeRefusal(new Error('boom'), 'x'), null);
  assert.equal(esfSubscribeRefusal(null, 'x'), null);
  assert.equal(esfSubscribeRefusal(undefined, 'x'), null);
});
