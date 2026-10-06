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
