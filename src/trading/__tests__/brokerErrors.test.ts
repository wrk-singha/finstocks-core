import assert from 'node:assert/strict';
import {test} from 'node:test';

import {getApiErrorMessage} from '../brokerErrors.ts';

test('reads the backend message ahead of the client’s generic one', () => {
  assert.equal(
    getApiErrorMessage(
      {
        response: {data: {error: 'Insufficient funds'}},
        message: 'Request failed with status code 400',
      },
      'x',
    ),
    'Insufficient funds',
  );
  assert.equal(
    getApiErrorMessage({response: {data: {message: 'm'}}}, 'x'),
    'm',
  );
  assert.equal(getApiErrorMessage({response: {data: {detail: 'd'}}}, 'x'), 'd');
  assert.equal(getApiErrorMessage(new Error('boom'), 'x'), 'boom');
  assert.equal(
    getApiErrorMessage({response: {data: {error: ''}}}, 'fallback'),
    'fallback',
  );
  assert.equal(getApiErrorMessage(null, 'fallback'), 'fallback');
  assert.equal(getApiErrorMessage(undefined, 'fallback'), 'fallback');
});
