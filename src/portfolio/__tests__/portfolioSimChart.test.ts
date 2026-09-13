import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  bandPath,
  domainOf,
  donutArc,
  linePath,
  scaleX,
  scaleY,
  valueTicks,
  yearLabels,
} from '../portfolioSimChart.ts';

test('scaleY inverts for SVG and respects padding; a flat domain does not divide by zero', () => {
  const sy = scaleY(0, 100, 120, 10, 10);
  assert.equal(sy(0), 110);
  assert.equal(sy(100), 10);
  assert.equal(sy(50), 60);
  assert.equal(scaleY(5, 5, 100, 0, 0)(5), 100);
});

test('scaleX spreads n samples evenly, centring a lone sample', () => {
  const sx = scaleX(3, 200);
  assert.deepEqual([sx(0), sx(1), sx(2)], [0, 100, 200]);
  assert.equal(scaleX(1, 200)(0), 100);
});

test('linePath and bandPath', () => {
  const sx = scaleX(3, 20);
  const sy = scaleY(0, 10, 10, 0, 0);
  assert.equal(linePath([0, 5, 10], sx, sy), 'M0.0 10.0 L10.0 5.0 L20.0 0.0');
  assert.equal(
    bandPath([10, 10, 10], [0, 0, 0], sx, sy),
    'M0.0 0.0 L10.0 0.0 L20.0 0.0 L20.0 10.0 L10.0 10.0 L0.0 10.0 Z',
  );
  assert.equal(bandPath([1], [0, 0], sx, sy), '');
});

test('donutArc draws outer arc, inner arc and closes; the large flag flips past 180°', () => {
  const quarter = donutArc(0, 0, 10, 5, 0, Math.PI / 2);
  assert.equal(
    quarter,
    'M10.00 0.00 A10 10 0 0 1 0.00 10.00 L0.00 5.00 A5 5 0 0 0 5.00 0.00 Z',
  );
  assert.match(donutArc(0, 0, 10, 5, 0, Math.PI * 1.5), /A10 10 0 1 1 /);
});

test('domainOf, yearLabels and valueTicks', () => {
  assert.deepEqual(domainOf([3, 1], [2, Number.NaN, 9]), [1, 9]);
  assert.deepEqual(domainOf([], [Number.NaN]), [0, 1]);
  assert.deepEqual(yearLabels(3), ['Now', '1y', '2y', '3y']);
  assert.deepEqual(valueTicks(0, 30, 4), [0, 10, 20, 30]);
  assert.deepEqual(valueTicks(0, 30, 1), [30]);
});
