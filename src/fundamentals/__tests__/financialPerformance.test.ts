import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  changeVsPrior,
  compactCrore,
  niceTicks,
  performanceCagr,
  performanceScale,
  periodLabel,
  type PeriodPoint,
  toPoints,
  ttmGrowth,
} from '../financialPerformance.ts';
import {round, series} from './filings.ts';

const points = (
  revenue: (number | null)[],
  profit: (number | null)[] = revenue.map(() => null),
): PeriodPoint[] =>
  revenue.map((value, i) => ({
    period: 202000 + i,
    revenue: value,
    profit: profit[i] ?? null,
  }));

test('the annual pair reads the first key filed, oldest period first', () => {
  const profitLoss = series([202603, 202503, 202403, 202303], {
    Net_sales: [1000, 900, null, null],
    Total_income: [1050, 950, 800, null],
    Profit_after_tax: [100, null, 60, null],
    Consolidated_NetProfit: [110, 70, 65, null],
  });
  assert.deepEqual(toPoints(profitLoss, 'annual'), [
    {period: 202403, revenue: 800, profit: 60},
    {period: 202503, revenue: 900, profit: 70},
    {period: 202603, revenue: 1000, profit: 100},
  ]);
});

test('each feed reads its own spelling, so a bank files its pair under the fallbacks', () => {
  const bank = series([202606, 202603], {
    Total_Income: [52_000, 50_500],
    Net_Profit: [9_100, 8_800],
  });
  assert.deepEqual(toPoints(bank, 'quarter'), [
    {period: 202603, revenue: 50_500, profit: 8_800},
    {period: 202606, revenue: 52_000, profit: 9_100},
  ]);
  // The quarterly spelling is not the annual one: read as annual, nothing is filed.
  const quarter = series([202606], {Net_Sales: [252_000], Pat: [19_400]});
  assert.deepEqual(toPoints(quarter, 'annual'), []);
  assert.deepEqual(toPoints(quarter, 'quarter'), [
    {period: 202606, revenue: 252_000, profit: 19_400},
  ]);
  assert.deepEqual(toPoints(undefined, 'quarter'), []);
});

test('trailing-twelve-month growth sets the last four quarters against the four before', () => {
  const quarters = points([100, 100, 100, 100, 110, 110, 110, 110]);
  assert.equal(round([ttmGrowth(quarters, 'revenue')])[0], 10);
  assert.equal(ttmGrowth(quarters.slice(1), 'revenue'), null);
  // A quarter not filed anywhere in the eight leaves no comparison to make.
  const gap = points([100, 100, null, 100, 110, 110, 110, 110]);
  assert.equal(ttmGrowth(gap, 'revenue'), null);
  // A year of losses is no base for a percentage.
  const turnaround = points(
    [100, 100, 100, 100, 110, 110, 110, 110],
    [-10, -10, -10, -10, 5, 5, 5, 5],
  );
  assert.equal(ttmGrowth(turnaround, 'profit'), null);
});

test('three-year CAGR runs back from the newest year and needs a positive base', () => {
  const years = points([100, 110, 121, 133.1], [-5, 20, 30, 40]);
  assert.equal(round([performanceCagr(years, 'revenue', 3)])[0], 10);
  assert.equal(performanceCagr(years, 'profit', 3), null);
  assert.equal(performanceCagr(years.slice(1), 'revenue', 3), null);
  assert.equal(
    performanceCagr(points([100, 110, 121, -1]), 'revenue', 3),
    null,
  );
});

test('the readout change compares a period with the one before it', () => {
  const quarters = points([100, 110, null], [0, 12, 15]);
  assert.equal(changeVsPrior(quarters, 0, 'revenue'), null);
  assert.equal(round([changeVsPrior(quarters, 1, 'revenue')])[0], 10);
  assert.equal(changeVsPrior(quarters, 2, 'revenue'), null);
  // A prior at zero has no percentage to give.
  assert.equal(changeVsPrior(quarters, 1, 'profit'), null);
  assert.equal(round([changeVsPrior(quarters, 2, 'profit')])[0], 25);
  assert.equal(changeVsPrior(quarters, 5, 'revenue'), null);
});

test('a period end reads as its month and two-digit year', () => {
  assert.equal(periodLabel(202606), "Jun '26");
  assert.equal(periodLabel(202503), "Mar '25");
  assert.equal(periodLabel(202412), "Dec '24");
  assert.equal(periodLabel(2026), '2026');
});

test('ticks land on round steps and contain the data at both ends', () => {
  const ticks = niceTicks(180_062, 0);
  assert.deepEqual(ticks, [0, 50_000, 100_000, 150_000, 200_000]);
  assert.ok((ticks.at(-1) ?? 0) >= 180_062);
  assert.deepEqual(niceTicks(100, -30), [-50, 0, 50, 100]);
  assert.deepEqual(niceTicks(0, -5), [0]);
  assert.deepEqual(niceTicks(Number.NaN, 0), [0]);
});

test('one axis scales both measures, and a loss hangs below zero inside it', () => {
  const growing = performanceScale(points([1000, 1200], [100, 150]));
  assert.deepEqual(growing, {
    ticks: [0, 500, 1000, 1500],
    top: 1500,
    span: 1500,
  });

  const loss = performanceScale(points([1000], [-200]));
  assert.deepEqual(loss.ticks, [-500, 0, 500, 1000]);
  assert.equal(loss.top, 1000);
  assert.equal(loss.span, 1500);
});

test('an all-loss series keeps a real span, so no bar outgrows the plot', () => {
  const scale = performanceScale(points([-5, -3], [-8, -6]));
  assert.deepEqual(scale.ticks, [0]);
  assert.equal(scale.top, 0);
  assert.equal(scale.span, 8);
  for (const value of [-5, -3, -8, -6]) {
    assert.ok(Math.abs(value) / scale.span <= 1);
  }
  // Nothing to scale at all still divides by something.
  assert.deepEqual(performanceScale([]), {ticks: [0], top: 0, span: 1});
  assert.deepEqual(performanceScale(points([0], [0])), {
    ticks: [0],
    top: 0,
    span: 1,
  });
});

test('axis labels say thousands and lakhs of crore the way they are said', () => {
  assert.equal(compactCrore(37_500), '37.5k');
  assert.equal(compactCrore(1000), '1k');
  assert.equal(compactCrore(200_000), '2L');
  assert.equal(compactCrore(150_000), '1.5L');
  assert.equal(compactCrore(-2500), '-2.5k');
  assert.equal(compactCrore(999), '999');
  assert.equal(compactCrore(12.6), '13');
  assert.equal(compactCrore(0), '0');
});
