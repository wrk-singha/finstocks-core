import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  EsfBacktestRun,
  EsfMember,
  EsfNavPoint,
  EsfSubscription,
} from '../../types/esf.ts';
import {yearsBetween} from '../basketBacktest.ts';
import {
  basketHeadline,
  cadenceLabel,
  marketLabel,
  minAmountHint,
  navChange,
  navSummary,
  planBasketBuy,
  primaryBacktest,
  reviewDayLabel,
  reviewPeriodLabel,
  reviewPeriodsLabel,
  stockCountLabel,
  subscriptionStatusLabel,
  trackingStart,
  volatilityLabel,
  weightLabel,
} from '../basketFormat.ts';

const stats = (cagr: number | null, vol: number) => ({
  'total_%': 0,
  'cagr_%': cagr,
  'vol_%': vol,
  'max_dd_%': -20,
});

const run: EsfBacktestRun = {
  id: 3,
  label: '10 years',
  window_start: '2016-04-01',
  window_end: '2026-03-31',
  rebalances: 120,
  is_primary: true,
  method: 'Equal weight, monthly.',
  metrics: {
    window: '10y',
    strategy_net: stats(21.4, 18),
    strategy_gross: stats(23, 18),
    nifty500: stats(13.2, 15),
    equal_weight_universe: stats(12, 16),
  },
};

const point = (
  trade_date: string,
  nav: number,
  benchmark: number | null,
): EsfNavPoint => ({trade_date, nav, benchmark});

const member = (
  symbol: string,
  ref_close: number | null,
  change: EsfMember['change'] = 'kept',
): EsfMember => ({
  symbol,
  rank: 1,
  selection_score: 50,
  stage: null,
  weight: 0.1,
  ref_close,
  change,
  return_6m: null,
  company_name: null,
  industry: null,
});

test('a cadence reads as its label, its period and the day the review falls on', () => {
  assert.equal(cadenceLabel('first-monday'), 'Monthly');
  assert.equal(cadenceLabel('results-quarterly'), 'Quarterly');
  assert.equal(cadenceLabel('fortnightly'), 'fortnightly');
  assert.equal(reviewPeriodLabel('weekly'), 'week');
  assert.equal(reviewPeriodsLabel('quarterly'), 'quarters');
  assert.equal(reviewPeriodsLabel('unknown'), 'reviews');
  assert.equal(reviewDayLabel('monthly'), 'the last trading day of the month');
  assert.equal(reviewDayLabel('first-monday'), 'the first Monday of the month');
  assert.equal(reviewDayLabel('unknown'), 'each review day');
});

test('the stock count says when places are held in cash', () => {
  assert.equal(stockCountLabel(20, 20), '20 · equal weight');
  assert.equal(stockCountLabel(14, 20), '14 of 20 · rest in cash');
});

test('volatility is read against the benchmark', () => {
  assert.equal(volatilityLabel(14, 15), 'Low');
  assert.equal(volatilityLabel(20, 15), 'Medium');
  assert.equal(volatilityLabel(22, 15), 'High');
});

test("the minimum is explained with the basket's own numbers, floor or rounding step", () => {
  assert.equal(
    minAmountHint({size: 20, min_capital_basis: null}),
    'Enough for an equal split to buy at least one share of all 20 stocks.',
  );
  assert.equal(
    minAmountHint({
      size: 20,
      min_capital_basis: {
        symbol: 'MRF',
        price: 1200,
        margin: 0.1,
        step: 5000,
        floor: 25000,
      },
    }),
    'Enough for an equal split to buy at least one share of all 20 stocks. 20 × ₹1,200.00 (MRF, the dearest share) + 10% for price moves = ₹26,400, rounded up to the next ₹5,000.',
  );
  assert.equal(
    minAmountHint({
      size: 10,
      min_capital_basis: {
        symbol: 'ITC',
        price: 400,
        margin: 0.1,
        step: 5000,
        floor: 25000,
      },
    }),
    "Enough for an equal split to buy at least one share of all 10 stocks. 10 × ₹400.00 (ITC, the dearest share) + 10% for price moves = ₹4,400, so this basket's floor of ₹25,000 applies.",
  );
});

test('the headline is the live record once it is a year long, else the primary backtest', () => {
  const launch = point('2025-01-01', 100, 100);
  assert.deepEqual(basketHeadline(launch, point('2026-01-02', 130, 112), run), {
    value: 30.000000000000004,
    benchmark: 12.000000000000011,
    caption: 'since Jan 1, 2025',
    short: 'Since Jan 1, 2025',
  });
  assert.deepEqual(basketHeadline(launch, point('2025-06-01', 130, 112), run), {
    value: 21.4,
    benchmark: 13.2,
    caption: 'a year · backtest since Apr 1, 2016',
    short: 'A year · backtest',
  });
  assert.equal(basketHeadline(null, null, null), null);
  // A run whose metrics have not landed reads as a dash, not a crash.
  assert.deepEqual(
    basketHeadline(null, null, {
      ...run,
      metrics: null as unknown as EsfBacktestRun['metrics'],
    }),
    {
      value: null,
      benchmark: null,
      caption: 'a year · backtest since Apr 1, 2016',
      short: 'A year · backtest',
    },
  );
  assert.equal(
    basketHeadline(null, null, {
      ...run,
      metrics: {window: '10y'} as unknown as EsfBacktestRun['metrics'],
    })?.value,
    null,
  );
  assert.equal(primaryBacktest([{...run, is_primary: false}, run]), run);
});

test('the NAV summary reads the benchmark from the points that carry one', () => {
  assert.equal(navSummary([]), null);
  assert.deepEqual(
    navSummary([
      point('2026-01-01', 100, null),
      point('2026-01-02', 101, 100),
      point('2026-01-05', 110, 104),
    ]),
    {
      since: '2026-01-01',
      asOf: '2026-01-05',
      basket: 10.000000000000009,
      benchmark: 4.0000000000000036,
      days: 2,
    },
  );
  assert.equal(navChange(null, 110), null);
  assert.equal(navChange(100, null), null);
});

test('tracking starts at the earliest effective day, and a market label is spelt out', () => {
  assert.equal(trackingStart([]), null);
  assert.equal(
    trackingStart([
      {
        id: 2,
        as_of: '2026-02-27',
        effective_on: '2026-03-02',
        market_label: null,
        added: 3,
      },
      {
        id: 1,
        as_of: '2026-01-30',
        effective_on: '2026-02-02',
        market_label: null,
        added: 20,
      },
    ]),
    '2026-02-02',
  );
  assert.equal(marketLabel('confirmed_uptrend'), 'Confirmed uptrend');
  assert.equal(marketLabel('sideways'), 'sideways');
  assert.equal(marketLabel(null), null);
  assert.equal(weightLabel(0.05), '5%');
});

test('a subscription reads as paused, awaiting its first orders, or by its return', () => {
  const sub: EsfSubscription = {
    id: 1,
    mode: 'mock',
    capital: 500000,
    realized_pnl: 0,
    status: 'active',
    rebalance_id: null,
    created_at: '2026-10-01T04:00:00Z',
    invested: 0,
    market_value: 0,
    cash: 500000,
    equity: 500000,
    pnl: 0,
    pnl_pct: 0,
    positions: [],
    orders: [],
    next_orders_on: '2026-10-06',
  };
  assert.equal(
    subscriptionStatusLabel(sub),
    'Paper money · first orders Oct 6, 2026',
  );
  assert.equal(
    subscriptionStatusLabel({...sub, status: 'paused', mode: 'live'}),
    'Real money · paused',
  );
  assert.equal(
    subscriptionStatusLabel({
      ...sub,
      pnl_pct: 4.25,
      positions: [
        {
          symbol: 'TCS',
          quantity: 10,
          avg_price: 100,
          last_price: 104,
          value: 1040,
          pnl: 40,
        },
      ],
    }),
    'Paper money · +4.3%',
  );
});

test('the plan splits the capital equally and buys whole shares at the live price or the review close', () => {
  const plan = planBasketBuy(
    [member('A', 100), member('B', 2600, 'added'), member('C', null)],
    {A: 120, C: null},
    10000,
    5,
  );
  assert.equal(plan.slot, 2000);
  assert.deepEqual(
    plan.lines.map(l => [l.member.symbol, l.price, l.shares, l.amount]),
    [
      ['A', 120, 16, 1920],
      ['B', 2600, 0, 0],
      ['C', null, 0, 0],
    ],
  );
  assert.equal(plan.invested, 1920);
  assert.equal(plan.cash, 8080);
  assert.equal(plan.buysEveryStockFrom, 13000);
});

test('years between two dates are fractional', () => {
  assert.equal(yearsBetween('2025-01-01', '2026-01-01'), 365 / 365.25);
});
