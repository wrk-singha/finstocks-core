import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../queryKeys.ts';

test('the chart manifest has one key, versioned like the file it caches', () => {
  assert.deepEqual(queryKeys.chartManifest(), ['chart-manifest', 1]);
  assert.deepEqual(queryKeys.chartManifest(), queryKeys.chartManifest());
});

test('the FinStocks Score is keyed as web keys it, one entry a symbol', () => {
  assert.deepEqual(queryKeys.esfScore('TCS'), ['esf-score', 'TCS']);
  assert.deepEqual(queryKeys.esfScore(null), ['esf-score', null]);
});

test('the library keys as web does', () => {
  assert.deepEqual(queryKeys.strategyLibrary(), ['strategy-library']);
  assert.deepEqual(queryKeys.strategyLibraryDetail('krishna'), [
    'strategy-library',
    'krishna',
  ]);
  assert.deepEqual(queryKeys.strategyLibraryActivity('kangto'), [
    'strategy-library',
    'kangto',
    'activity',
  ]);
});

test('the sector matrix and its pair key as web does', () => {
  assert.deepEqual(queryKeys.market.rsSectorMatrix(0.25), [
    'rs-sector-matrix',
    0.25,
  ]);
  assert.deepEqual(queryKeys.market.rsSectorPair(0.25, 'NIFTYIT', 'NIFTY'), [
    'rs-sector-matrix',
    'pair',
    0.25,
    'NIFTYIT',
    'NIFTY',
  ]);
});

test('a manual page keys on its slug', () => {
  assert.deepEqual(queryKeys.manualPage('banking-field-manual'), [
    'manual-page',
    'banking-field-manual',
  ]);
});

test('the options regime keys as web does: no date is "latest"', () => {
  assert.deepEqual(queryKeys.regimePulse.snapshot(), [
    'regimepulse',
    'snapshot',
    'latest',
  ]);
  assert.deepEqual(queryKeys.regimePulse.snapshot('2026-10-06'), [
    'regimepulse',
    'snapshot',
    '2026-10-06',
  ]);
  assert.deepEqual(queryKeys.regimePulse.detail('NIFTY'), [
    'regimepulse',
    'detail',
    'NIFTY',
    'latest',
  ]);
  assert.deepEqual(queryKeys.regimePulse.decay('NIFTY', '2026-10-06'), [
    'regimepulse',
    'decay',
    'NIFTY',
    '2026-10-06',
  ]);
  assert.deepEqual(queryKeys.regimePulse.sentiment(), [
    'regimepulse',
    'sentiment',
    'latest',
  ]);
  assert.deepEqual(queryKeys.regimePulse.me(), ['regimepulse', 'me']);
  assert.deepEqual(queryKeys.regimePulse.dates(), ['regimepulse', 'dates']);
});

test('the option levels key by expiry rank and screen request as web does', () => {
  assert.deepEqual(queryKeys.flyone.snapshot('near'), [
    'flyone',
    'snapshot',
    'near',
    'latest',
  ]);
  assert.deepEqual(queryKeys.flyone.snapshot('next', '2026-10-06'), [
    'flyone',
    'snapshot',
    'next',
    '2026-10-06',
  ]);
  assert.deepEqual(queryKeys.flyone.dates(), ['flyone', 'dates']);
  const params = {where: 'score>0', universe: 'stock' as const, limit: 50};
  assert.deepEqual(queryKeys.flyone.screen(params), [
    'flyone',
    'screen',
    params,
  ]);
});

test('an options direction detail keys by symbol, expiry as asked and day, as web does', () => {
  assert.deepEqual(queryKeys.flyone.detail('NIFTY'), [
    'flyone',
    'detail',
    'NIFTY',
    'near',
    'latest',
  ]);
  assert.deepEqual(queryKeys.flyone.detail('NIFTY', '2026-10-13'), [
    'flyone',
    'detail',
    'NIFTY',
    '2026-10-13',
    'latest',
  ]);
  assert.deepEqual(queryKeys.flyone.detail('RELIANCE', 'next', '2026-10-06'), [
    'flyone',
    'detail',
    'RELIANCE',
    'next',
    '2026-10-06',
  ]);
});
