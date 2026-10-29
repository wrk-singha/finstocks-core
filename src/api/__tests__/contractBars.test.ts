import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  contractBarsOf,
  graphDataPaths,
  parseContractBars,
  tradingApi,
} from '../trading.ts';
import {fakeHttp} from './fakeHttp.ts';

const RIL = 'RELIANCE26OCTFUT';
const TCS = 'TCS26OCTFUT';
const ril = {
  t: ['2026-10-24 09:20:00', '2026-10-24 09:15:00'],
  c: [99, 101],
  oi: [1200, null],
  pc: 100.5,
  poi: 1050,
};
// No OI on any bar, and no base: the server sends neither column.
const tcs = {t: ['2026-10-24 09:20:00'], c: [50]};

test('include_oi is asked for only when opted in, and the paths without it are as they were', () => {
  const plain = graphDataPaths({symbols: [RIL], market: 'IN'});
  assert.equal(plain.length, 1);
  assert.ok(!plain[0]?.includes('include_oi'));
  const withOi = graphDataPaths({
    symbols: [RIL],
    market: 'IN',
    period: '1w',
    interval: '1m',
    closeOnly: true,
    fnoSymbols: [RIL],
    includeOI: true,
    page: {to: 1761298260, count: 152},
  });
  assert.equal(
    withOi[0],
    `/trading/graph-data?symbols=${RIL}&market=IN&period=1w&interval=1m&include_oi=1&close_only=1&to=1761298260&count=152&fno_symbols=${RIL}`,
  );
  // Off is the same as absent: the server keys its cache on the flag.
  assert.deepEqual(
    graphDataPaths({symbols: [RIL], market: 'IN', includeOI: false}),
    plain,
  );
});

test('each contract keeps its closes, its OI column with the nulls the feed left, and its pc and poi, through either wrapper', () => {
  const bars = parseContractBars({data: {data: {[RIL]: ril, [TCS]: tcs}}});
  assert.deepEqual(bars[RIL], ril);
  assert.deepEqual(bars[TCS], tcs);
  assert.equal(bars[TCS]?.oi, undefined);
  assert.equal(bars[TCS]?.poi, undefined);
  assert.deepEqual(parseContractBars({data: {[RIL]: ril}})[RIL], ril);
  assert.deepEqual(parseContractBars({[RIL]: ril})[RIL], ril);
});

test('a series without its columns, the older array shape, or no body is no contract', () => {
  assert.deepEqual(parseContractBars(undefined), {});
  assert.deepEqual(parseContractBars(null), {});
  assert.deepEqual(parseContractBars({}), {});
  assert.deepEqual(
    parseContractBars({[RIL]: [{time: '2026-10-24', close: 1}]}),
    {},
  );
  assert.deepEqual(parseContractBars({[RIL]: {t: ['2026-10-24']}}), {});
  // A non-numeric pc or poi is left off rather than landing as null.
  assert.deepEqual(
    parseContractBars({[RIL]: {t: [], c: [], pc: null, poi: 'x'}}),
    {[RIL]: {t: [], c: []}},
  );
});

test('every batch empty is a failed read; no batch at all is an empty one', async () => {
  await assert.rejects(
    contractBarsOf([{}, undefined], () => Promise.resolve({})),
    /No contract bars in response/,
  );
  assert.deepEqual(await contractBarsOf([], () => Promise.resolve({})), {
    bars: {},
    partial: false,
  });
});

test('one empty batch beside a full one is asked once more, and kept and marked partial when it stays empty or fails', async () => {
  const askedAgain: number[] = [];
  const whole = await contractBarsOf([{[RIL]: ril}, {}], batch => {
    askedAgain.push(batch);
    return Promise.resolve({[TCS]: tcs});
  });
  assert.deepEqual(askedAgain, [1]);
  assert.deepEqual(whole, {bars: {[RIL]: ril, [TCS]: tcs}, partial: false});

  const stillEmpty = await contractBarsOf([{[RIL]: ril}, {}], () =>
    Promise.resolve({}),
  );
  assert.deepEqual(stillEmpty, {bars: {[RIL]: ril}, partial: true});

  const failed = await contractBarsOf([{}, {[RIL]: ril}], () =>
    Promise.reject(new Error('no answer')),
  );
  assert.deepEqual(failed, {bars: {[RIL]: ril}, partial: true});
});

test('getContractBars reads close-only with include_oi, every symbol a contract, 26 to a request, and merges the batches', async () => {
  const many = Array.from({length: 27}, (_, i) => `S${i}26OCTFUT`);
  const {http, calls} = fakeHttp([
    {data: {data: {[RIL]: ril}}},
    {data: {data: {[TCS]: tcs}}},
  ]);
  const out = await tradingApi(http).getContractBars({
    symbols: many,
    market: 'IN',
    period: '1m',
    interval: '1m',
    page: {to: 1761298260, count: 1672},
  });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.ok(call.path.startsWith('/trading/graph-data?'));
    assert.ok(call.path.includes('&include_oi=1'));
    assert.ok(call.path.includes('&close_only=1'));
    assert.ok(call.path.includes('&to=1761298260&count=1672'));
    assert.ok(call.path.includes('fno_symbols=S0'.replace('S0', 'S')));
  }
  // Each batch names its own symbols as contracts: 26 in the first, one in the second.
  const named = (call: number) =>
    (calls[call]?.path.split('fno_symbols=').length ?? 0) - 1;
  assert.equal(named(0), 26);
  assert.equal(named(1), 1);
  assert.deepEqual(out, {bars: {[RIL]: ril, [TCS]: tcs}, partial: false});
});

test('getContractBars asks an empty batch again through the same client, and marks the read partial when it stays empty', async () => {
  const many = Array.from({length: 27}, (_, i) => `S${i}26OCTFUT`);
  const {http, calls} = fakeHttp([{data: {data: {[RIL]: ril}}}, {}, {}]);
  const out = await tradingApi(http).getContractBars({
    symbols: many,
    market: 'IN',
  });
  assert.equal(calls.length, 3);
  assert.equal(calls[2]?.path, calls[1]?.path);
  assert.deepEqual(out, {bars: {[RIL]: ril}, partial: true});
});
