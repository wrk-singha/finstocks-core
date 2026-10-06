import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  EsfBacktestDay,
  EsfBacktestDetail,
  EsfBacktestMonth,
  EsfBacktestPick,
} from '../../types/esf.ts';
import {
  dailyReturns,
  equityCurve,
  monteCarlo,
  monthlyReturns,
  picksByReview,
  summarize,
  yearlyReturns,
} from '../basketBacktest.ts';
import {basketCharges} from '../basketCharges.ts';

const day = (
  date: string,
  nav: number,
  benchmark: number | null = null,
): EsfBacktestDay => ({date, nav, benchmark});

const daily: EsfBacktestDay[] = [
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

const month = (asOf: string, net: number): EsfBacktestMonth => ({
  as_of: asOf,
  exit_on: asOf,
  names: 2,
  gross: net + 0.5,
  net,
  benchmark: 1,
  universe: null,
  turnover: 0.5,
  market_label: null,
});

test('the summary reads the final multiple, the worst trough and its day, the Sharpe and the win rate', () => {
  const summary = summarize(daily, [
    month('a', 3),
    month('b', -1),
    month('c', 2),
  ]);
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
  assert.deepEqual(monteCarlo([], 10, 100), []);
  assert.deepEqual(monteCarlo(returns, 0, 100), []);
});

const pick = (
  asOf: string,
  symbol: string,
  fwd: number | null,
  change: EsfBacktestPick['change'] = 'kept',
): EsfBacktestPick => ({
  as_of: asOf,
  symbol,
  rank: 1,
  selection_score: null,
  stage: null,
  fwd_return: fwd,
  change,
});

test('picks group by review, and the charges replay the trades a subscription would make', () => {
  const picks = [
    pick('2025-01-31', 'A', 0.1, 'added'),
    pick('2025-01-31', 'B', 0, 'added'),
    pick('2025-07-31', 'A', 0.05),
    pick('2025-07-31', 'C', 0.02, 'added'),
  ];
  assert.deepEqual(
    [...picksByReview(picks).entries()].map(([k, v]) => [
      k,
      v.map(p => p.symbol),
    ]),
    [
      ['2025-01-31', ['A', 'B']],
      ['2025-07-31', ['A', 'C']],
    ],
  );
  const detail: EsfBacktestDetail = {
    run: {
      id: 1,
      label: '1 year',
      window_start: '2025-01-31',
      window_end: '2026-01-31',
      rebalances: 2,
      is_primary: true,
      method: '',
      metrics: {
        window: '1y',
        strategy_net: {'total_%': 0, 'cagr_%': null, 'vol_%': 0, 'max_dd_%': 0},
        strategy_gross: {
          'total_%': 0,
          'cagr_%': null,
          'vol_%': 0,
          'max_dd_%': 0,
        },
        nifty500: {'total_%': 0, 'cagr_%': null, 'vol_%': 0, 'max_dd_%': 0},
        equal_weight_universe: {
          'total_%': 0,
          'cagr_%': null,
          'vol_%': 0,
          'max_dd_%': 0,
        },
      },
    },
    months: [month('2025-01-31', 5), month('2025-07-31', 3)],
    picks,
    daily: [],
  };
  const charges = basketCharges(detail, 100000, 2, 'zerodha');
  assert.ok(charges);
  // Two buys at the first review, then one sell and one buy at the second: four orders over a
  // year, every one of them traded.
  assert.equal(Math.round(charges.ordersPerYear), 4);
  assert.ok(charges.firstBuy > 0);
  assert.ok(charges.perReview > 0);
  assert.ok(charges.tradedPerYear > 150000 && charges.tradedPerYear < 250000);
  assert.equal(
    Number(charges.yearly.totalCharges.toFixed(2)),
    Number(charges.perYear.toFixed(2)),
  );
  // The sell carries the DP charge a buy never does.
  assert.ok(charges.yearly.dpCharges > 0);
  assert.equal(
    basketCharges({...detail, months: []}, 100000, 2, 'zerodha'),
    null,
  );
});
