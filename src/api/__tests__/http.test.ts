import assert from 'node:assert/strict';
import {test} from 'node:test';

import {query} from '../http.ts';

test('query skips undefined and null, encodes the rest', () => {
  assert.equal(query({}), '');
  assert.equal(query({a: 1, b: undefined, c: null}), '?a=1');
  assert.equal(query({mock: true, q: 'a b&c'}), '?mock=true&q=a%20b%26c');
});
