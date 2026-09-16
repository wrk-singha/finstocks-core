import assert from 'node:assert/strict';
import {test} from 'node:test';

import {prevCloseFor} from '../screener.ts';

test('a previous close is found in whichever case the request spelled the symbol', () => {
  const prevCloses = {RELIANCE: 100, tcs: 200};
  assert.equal(prevCloseFor(prevCloses, 'RELIANCE'), 100);
  assert.equal(prevCloseFor(prevCloses, 'reliance'), 100);
  assert.equal(prevCloseFor(prevCloses, 'TCS'), 200);
  assert.equal(prevCloseFor(prevCloses, 'tcs'), 200);
});

test('an absent symbol or map reads as null, never as a zero', () => {
  assert.equal(prevCloseFor({RELIANCE: 100}, 'INFY'), null);
  assert.equal(prevCloseFor(undefined, 'RELIANCE'), null);
  assert.equal(prevCloseFor({}, 'RELIANCE'), null);
  assert.equal(prevCloseFor({RELIANCE: 0}, 'RELIANCE'), 0);
});
