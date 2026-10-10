import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../queryKeys.ts';

test('the chart manifest has one key, versioned like the file it caches', () => {
  assert.deepEqual(queryKeys.chartManifest(), ['chart-manifest', 1]);
  assert.deepEqual(queryKeys.chartManifest(), queryKeys.chartManifest());
});

test('the library keys as web does', () => {
  assert.deepEqual(queryKeys.strategyLibrary(), ['strategy-library']);
  assert.deepEqual(queryKeys.strategyLibraryDetail('krishna'), [
    'strategy-library',
    'krishna',
  ]);
});
