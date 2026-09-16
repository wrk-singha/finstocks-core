import assert from 'node:assert/strict';
import {test} from 'node:test';

import {parseGraphPrevCloses, tradingApi} from '../trading.ts';
import {fakeHttp} from './fakeHttp.ts';

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

test('bars and previous closes come back from one set of requests, not two', async () => {
  const series = {t: ['2026-09-14 09:15:00'], o: [100], c: [101], pc: 99};
  const {http, calls} = fakeHttp([{data: {data: {RELIANCE: series}}}]);

  const out = await tradingApi(http).getGraphDataWithPrevCloses({
    symbols: ['RELIANCE'],
    market: 'IN',
  });

  // The point of the method: fetching each separately would poll the endpoint twice for the scalar.
  assert.equal(calls.length, 1);
  assert.ok(calls[0]?.path.startsWith('/trading/graph-data'));
  assert.equal(out.data.RELIANCE?.length, 1);
  assert.equal(out.data.RELIANCE?.[0]?.close, 101);
  assert.deepStrictEqual(out.prevCloses, {RELIANCE: 99});
});

test('batches merge, and a page without pc contributes no previous close', async () => {
  const withPc = {t: ['2026-09-14 09:15:00'], c: [101], pc: 99};
  const withoutPc = {t: ['2026-09-14 09:15:00'], c: [205]};
  const {http, calls} = fakeHttp([{RELIANCE: withPc}, {TCS: withoutPc}]);
  const many = Array.from({length: 27}, (_, i) => `S${i}`);

  const out = await tradingApi(http).getGraphDataWithPrevCloses({
    symbols: many,
    market: 'IN',
  });

  assert.equal(calls.length, 2);
  assert.deepStrictEqual(out.prevCloses, {RELIANCE: 99});
  assert.equal(out.data.TCS?.length, 1);
});
