import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  annualisedReturn,
  type BacktestDay,
  dailyReturns,
  equityCurve,
  monteCarlo,
  monthlyReturns,
  summarize,
  yearlyReturns,
} from '../basketBacktest.ts';

const day = (
  date: string,
  nav: number,
  benchmark: number | null = null,
): BacktestDay => ({date, nav, benchmark});

const daily: BacktestDay[] = [
  day('2024-01-01', 1, 1),
  day('2024-01-02', 1.1, 1.02),
  day('2024-02-01', 0.99, null),
  day('2024-12-31', 1.2, 1.1),
  day('2025-01-31', 1.5, 1.2),
  day('2025-12-31', 1.32, 1.3),
];

test('the equity curve carries the drawdown from the running peak, and the benchmark as served', () => {
  const curve = equityCurve(daily);
  assert.deepEqual(
    curve.map(p => [p.basket, p.benchmark, Number(p.drawdown.toFixed(4))]),
    [
      [1, 1, 0],
      [1.1, 1.02, 0],
      [0.99, null, -0.1],
      [1.2, 1.1, 0],
      [1.5, 1.2, 0],
      [1.32, 1.3, -0.12],
    ],
  );
  assert.deepEqual(
    dailyReturns(daily).map(r => Number(r.toFixed(4))),
    [0.1, -0.1, 0.2121, 0.25, -0.12],
  );
});

test('returns by year and by month chain from the previous period’s close', () => {
  assert.deepEqual(
    yearlyReturns(daily).map(y => [y.label, Number(y.basket.toFixed(4))]),
    [
      ['2024', 0.2],
      ['2025', 0.1],
    ],
  );
  assert.deepEqual(
    monthlyReturns(daily).map(m => [
      m.year,
      m.month,
      Number(m.basket.toFixed(4)),
    ]),
    [
      [2024, 1, 0.1],
      [2024, 2, -0.1],
      [2024, 12, 0.2121],
      [2025, 1, 0.25],
      [2025, 12, -0.12],
    ],
  );
});

test('the summary reads the final multiple, the worst trough and its day, the Sharpe and the win rate', () => {
  const summary = summarize(daily, [{net: 3}, {net: -1}, {net: 2}]);
  assert.ok(summary);
  assert.equal(summary.finalMultiple, 1.32);
  assert.equal(Number(summary.maxDrawdown.toFixed(2)), -0.12);
  assert.equal(summary.maxDrawdownDate, '2025-12-31');
  assert.equal(Number((summary.annualReturn ?? 0).toFixed(3)), 0.149);
  assert.ok(summary.sharpe !== null && summary.sharpe > 0);
  assert.equal(Number(summary.winRate.toFixed(4)), 0.6667);
  // Under a year of history there is no annual figure to claim.
  assert.equal(summarize(daily.slice(0, 3), [])?.annualReturn, null);
  assert.equal(summarize(daily.slice(0, 1), []), null);
  assert.equal(summarize([], []), null);
});

test('the Monte Carlo band is seeded, so the same returns give the same percentiles, ordered and growing from the capital', () => {
  const returns = [0.01, -0.005, 0.02, -0.01, 0.003];
  const a = monteCarlo(returns, 20, 100000, 200);
  const b = monteCarlo(returns, 20, 100000, 200);
  assert.deepEqual(a, b);
  assert.equal(a.length, 21);
  assert.deepEqual(a[0], {
    step: 0,
    p5: 100000,
    p10: 100000,
    p25: 100000,
    p50: 100000,
    p75: 100000,
    p90: 100000,
    p95: 100000,
  });
  const end = a[20];
  assert.ok(end);
  assert.ok(end.p5 <= end.p10 && end.p10 <= end.p25 && end.p25 <= end.p50);
  assert.ok(end.p50 <= end.p75 && end.p75 <= end.p90 && end.p90 <= end.p95);
  assert.ok(end.p50 > 100000);
  // Pinned to web's seeded RNG: a drift in the generator or the percentile read fails here.
  assert.equal(end.p5.toFixed(2), '99391.04');
  assert.equal(end.p50.toFixed(2), '107770.75');
  assert.equal(end.p95.toFixed(2), '114764.67');
  // Paths compound from the capital, so a unit run scaled by the capital is the same band.
  const unit = monteCarlo(returns, 20, 1, 200);
  assert.equal(((unit[20]?.p50 ?? 0) * 100000).toFixed(6), end.p50.toFixed(6));
  assert.deepEqual(monteCarlo([], 10, 100), []);
  assert.deepEqual(monteCarlo(returns, 0, 100), []);
});

test('a multiple annualises over a year or more, and never under one', () => {
  assert.equal(annualisedReturn(1.21, 2)?.toFixed(4), '0.1000');
  assert.equal(annualisedReturn(1.1, 1)?.toFixed(4), '0.1000');
  assert.equal(annualisedReturn(1.5, 0.99), null);
});
