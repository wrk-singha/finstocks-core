import assert from 'node:assert/strict';
import {test} from 'node:test';

import {parseGraphPrevCloses} from '../trading.ts';

const raw = {
  RELIANCE: {t: ['2026-09-14 09:15:00'], c: [101], pc: 100},
  TCS: {t: ['2026-09-14 09:15:00'], c: [205]},
};

test('the settled previous close is read per symbol, through either wrapper', () => {
  assert.deepEqual(parseGraphPrevCloses(raw), {RELIANCE: 100});
  assert.deepEqual(parseGraphPrevCloses({data: raw}), {RELIANCE: 100});
  assert.deepEqual(parseGraphPrevCloses({data: {data: raw}}), {RELIANCE: 100});
});

test('a symbol without a numeric pc is absent rather than zero', () => {
  assert.deepEqual(parseGraphPrevCloses(undefined), {});
  assert.deepEqual(parseGraphPrevCloses(null), {});
  assert.deepEqual(parseGraphPrevCloses({}), {});
  // The older array shape carries no series-level scalar at all.
  assert.deepEqual(
    parseGraphPrevCloses({RELIANCE: [{time: '2026-09-14', close: 1}]}),
    {},
  );
  // A non-numeric pc skips the symbol entirely rather than landing it as undefined.
  assert.deepStrictEqual(
    parseGraphPrevCloses({RELIANCE: {t: [], c: [], pc: null}}),
    {},
  );
});

test('a zero previous close is kept, since zero is a number the server meant', () => {
  assert.deepEqual(parseGraphPrevCloses({RELIANCE: {t: [], c: [], pc: 0}}), {
    RELIANCE: 0,
  });
});
