import assert from 'node:assert/strict';
import {test} from 'node:test';

import {getSeriesFromGraphData} from '../screener.ts';

const point = (time: string, close: number) => ({
  time,
  open: close,
  close,
  high: close,
  low: close,
});

test('getSeriesFromGraphData sorts chronologically and tolerates key case', () => {
  const graph = {
    TCS: [point('2026-01-02', 2), point('2026-01-01', 1)],
    infy: [point('2026-01-01', 5)],
  };
  assert.deepEqual(
    getSeriesFromGraphData(graph, 'tcs').map(p => p.close),
    [1, 2],
  );
  assert.deepEqual(
    getSeriesFromGraphData(graph, 'INFY').map(p => p.close),
    [5],
  );
  assert.deepEqual(getSeriesFromGraphData(graph, 'RELIANCE'), []);
  assert.deepEqual(getSeriesFromGraphData(undefined, 'TCS'), []);
});
