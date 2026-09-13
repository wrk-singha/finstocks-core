import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  computeDayChange,
  getCurrentPriceFromGraphData,
  getRawSeriesFromGraphData,
} from '../holdingsPricing.ts';

const graph = {
  RELIANCE: [
    {time: '2026-08-03T09:15:00Z', close: 101},
    {time: '2026-08-03T03:45:00Z', close: 100},
    {time: '2026-08-02T09:15:00Z', close: 98},
  ],
};

test('computeDayChange compares newest to the session open, or to the prior close off-hours', () => {
  const series = [{close: 110}, {close: 105}, {close: 100}];
  assert.deepEqual(computeDayChange(series, false), {
    oneDayChange: 10,
    oneDayChangePercent: 10,
    hasDayChange: true,
  });
  assert.deepEqual(computeDayChange(series, true), {
    oneDayChange: 5,
    oneDayChangePercent: (5 / 105) * 100,
    hasDayChange: true,
  });
  assert.equal(computeDayChange([{close: 1}], false).hasDayChange, false);
  assert.equal(computeDayChange([], true).hasDayChange, false);
  assert.equal(
    computeDayChange([{close: 5}, {close: 0}], false).oneDayChangePercent,
    0,
  );
});

test('getRawSeriesFromGraphData is case-tolerant and never sorts', () => {
  assert.equal(getRawSeriesFromGraphData(graph, 'reliance'), graph.RELIANCE);
  assert.deepEqual(getRawSeriesFromGraphData(graph, 'TCS'), []);
  assert.deepEqual(getRawSeriesFromGraphData(undefined, 'RELIANCE'), []);
});

test('getCurrentPriceFromGraphData takes the newest point by time, not by position', () => {
  assert.equal(getCurrentPriceFromGraphData(graph, 'RELIANCE'), '101.00');
  assert.equal(
    getCurrentPriceFromGraphData(
      {
        X: [
          {time: '2026-01-01', close: 1},
          {time: '2026-01-02', close: 2.456},
        ],
      },
      'x',
    ),
    '2.46',
  );
  assert.equal(getCurrentPriceFromGraphData(graph, 'TCS'), null);
});
