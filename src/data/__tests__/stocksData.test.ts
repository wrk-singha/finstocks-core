import assert from 'node:assert/strict';
import {test} from 'node:test';

import {NIFTY100_SYMBOLS} from '../stocksData.ts';

// NSE's ticker changes Doom now serves (same ISINs). Doom answers unknown_symbol for the old
// names, so a page opened under one was blank.
const RENAMED: readonly (readonly [string, string])[] = [
  ['HEG', 'HEGAM'],
  ['SILLYMONKS', 'CRESTO'],
  ['AMIRCHAND', 'AEROPLANE'],
  ['ASHIKA', 'ASHIKAG'],
];

test('a ticker NSE renamed is listed under its new name only', () => {
  const listed = new Set(NIFTY100_SYMBOLS);
  for (const [old, current] of RENAMED) {
    assert.ok(listed.has(current), `${current} is listed`);
    assert.ok(!listed.has(old), `${old} is no longer listed`);
  }
});

test('the equity list is sorted and names each symbol once', () => {
  assert.deepEqual([...NIFTY100_SYMBOLS], [...NIFTY100_SYMBOLS].sort());
  assert.equal(new Set(NIFTY100_SYMBOLS).size, NIFTY100_SYMBOLS.length);
});
