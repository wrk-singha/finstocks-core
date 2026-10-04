import assert from 'node:assert/strict';
import {test} from 'node:test';

import {outcomeOfError} from '../orderOutcome.ts';

/** The web's rejection: an axios error, with the status on its response. */
const axiosError = (status: number) => ({
  message: `Request failed with status code ${status}`,
  response: {status, data: {error: 'x'}},
});

/** Mobile's rejection: its `ApiError`, with the status on the error and 0 when no answer arrived. */
const apiError = (status: number, code?: string) =>
  Object.assign(new Error('x'), {name: 'ApiError', status, code});

const REFUSALS = [400, 403, 404, 409, 422, 429];

test('the six refusals are a rejection, on either host’s error', () => {
  for (const status of REFUSALS) {
    assert.equal(outcomeOfError(axiosError(status)), 'rejected', `${status}`);
    assert.equal(outcomeOfError(apiError(status)), 'rejected', `${status}`);
  }
});

test('every other 4xx is unknown: a late 401 or a 408 may not have stopped the order', () => {
  for (let status = 400; status < 500; status += 1) {
    if (REFUSALS.includes(status)) continue;
    assert.equal(outcomeOfError(axiosError(status)), 'unknown', `${status}`);
    assert.equal(outcomeOfError(apiError(status)), 'unknown', `${status}`);
  }
});

test('every 5xx is unknown: the backend’s 502 is a trade service that did not answer in time', () => {
  for (let status = 500; status < 600; status += 1) {
    assert.equal(outcomeOfError(axiosError(status)), 'unknown', `${status}`);
    assert.equal(outcomeOfError(apiError(status)), 'unknown', `${status}`);
  }
});

test('a status that is no error at all is still not a refusal', () => {
  for (const status of [100, 101, 200, 201, 204, 301, 302, 304, 307]) {
    assert.equal(outcomeOfError(axiosError(status)), 'unknown', `${status}`);
    assert.equal(outcomeOfError(apiError(status)), 'unknown', `${status}`);
  }
});

test('a network failure is unknown', () => {
  // axios: no response at all.
  assert.equal(
    outcomeOfError({message: 'Network Error', code: 'ERR_NETWORK'}),
    'unknown',
  );
  // Mobile: status 0.
  assert.equal(outcomeOfError(apiError(0, 'network')), 'unknown');
  assert.equal(outcomeOfError(new TypeError('Failed to fetch')), 'unknown');
});

test('a timeout or an abort is unknown', () => {
  assert.equal(
    outcomeOfError({
      message: 'timeout of 60000ms exceeded',
      code: 'ECONNABORTED',
    }),
    'unknown',
  );
  assert.equal(
    outcomeOfError({message: 'canceled', code: 'ERR_CANCELED'}),
    'unknown',
  );
  assert.equal(outcomeOfError(apiError(0, 'timeout')), 'unknown');
  assert.equal(outcomeOfError(apiError(0, 'cancelled')), 'unknown');
  assert.equal(
    outcomeOfError(Object.assign(new Error('x'), {name: 'AbortError'})),
    'unknown',
  );
});

test('a malformed body is unknown, whatever status it came with', () => {
  // Mobile throws on a 2xx whose body is not JSON; the order was very likely taken.
  assert.equal(outcomeOfError(apiError(200, 'malformed')), 'unknown');
  assert.equal(
    outcomeOfError(new SyntaxError('Unexpected token <')),
    'unknown',
  );
  // A status that is not a number is no status.
  assert.equal(outcomeOfError({response: {status: '400'}}), 'unknown');
  assert.equal(outcomeOfError({response: {}}), 'unknown');
  assert.equal(outcomeOfError({response: null}), 'unknown');
});

test('anything else thrown is unknown, and nothing thrown is read without throwing', () => {
  assert.equal(outcomeOfError(null), 'unknown');
  assert.equal(outcomeOfError(undefined), 'unknown');
  assert.equal(outcomeOfError('boom'), 'unknown');
  assert.equal(outcomeOfError(400), 'unknown');
  assert.equal(outcomeOfError(new Error('boom')), 'unknown');
});
