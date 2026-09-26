import assert from 'node:assert/strict';
import {test} from 'node:test';

import {query, statusOf} from '../http.ts';

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
