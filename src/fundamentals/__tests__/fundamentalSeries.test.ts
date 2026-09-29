import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  FundamentalCatalog,
  FundamentalMetric,
} from '../../types/fundamentalSeries.ts';
import {
  availablePeriods,
  FUNDAMENTAL_PERIODS,
  isFundamentalPeriod,
  isReported,
  reportedGroups,
  reportedMetrics,
} from '../fundamentalSeries.ts';

const line = (
  id: string,
  group: string,
  available?: FundamentalMetric['available'],
): FundamentalMetric => ({
  id,
  label: id,
  group,
  unit: 'crore',
  level: 0,
  periods: ['Q', 'A', 'TTM'],
  ...(available === undefined ? {} : {available}),
});

test('a line offers the periods the company has points for, in the order the backend lists them', () => {
  assert.deepEqual(
    availablePeriods(line('sales', 'pl', {Q: 13, A: 0, TTM: 10})),
    ['Q', 'TTM'],
  );
  // A count the backend left out is no points, not an unknown.
  assert.deepEqual(availablePeriods(line('sales', 'pl', {A: 11})), ['A']);
  assert.deepEqual(
    availablePeriods({
      ...line('pe', 'ratios', {D: 750, A: 5}),
      periods: ['D', 'A'],
    }),
    ['D', 'A'],
  );
});

test('a line without counts says nothing about what was filed, so it offers every period', () => {
  const metric = line('sales', 'pl');
  const periods = availablePeriods(metric);
  assert.deepEqual(periods, ['Q', 'A', 'TTM']);
  // A copy: a caller that sorts or trims it leaves the catalogue as served.
  periods.pop();
  assert.deepEqual(metric.periods, ['Q', 'A', 'TTM']);
  assert.equal(isReported(metric), true);
});

test('a line with no points at any period is not reported', () => {
  assert.equal(isReported(line('npa', 'bank', {Q: 0, A: 0})), false);
  assert.equal(isReported(line('npa', 'bank', {})), false);
  assert.equal(isReported({...line('npa', 'bank'), periods: []}), false);
});

test('only the statements a company files anything in are offered, in the backend order', () => {
  const catalog: FundamentalCatalog = {
    symbol: 'RELIANCE',
    groups: [
      {id: 'pl', label: 'Income statement'},
      {id: 'bank', label: 'Banking'},
      {id: 'bs', label: 'Balance sheet'},
      {id: 'empty', label: 'Nothing filed'},
    ],
    metrics: [
      line('inventory', 'bs', {A: 11}),
      line('sales', 'pl', {Q: 13}),
      line('npa', 'bank', {Q: 0}),
      line('deposits', 'bs', {A: 0}),
    ],
  };
  assert.deepEqual(
    reportedGroups(catalog).map(group => group.id),
    ['pl', 'bs'],
  );
  assert.deepEqual(
    reportedMetrics(catalog).map(metric => metric.id),
    ['inventory', 'sales'],
  );
  assert.deepEqual(reportedGroups(undefined), []);
  assert.deepEqual(reportedMetrics(undefined), []);
});

test('the periods a line can be charted at, and nothing else', () => {
  assert.deepEqual(FUNDAMENTAL_PERIODS, ['Q', 'A', 'TTM', 'D']);
  for (const period of FUNDAMENTAL_PERIODS) {
    assert.equal(isFundamentalPeriod(period), true);
  }
  for (const other of ['q', 'FY', 'FQ', '', 'daily', 4, null, undefined]) {
    assert.equal(isFundamentalPeriod(other), false);
  }
});
