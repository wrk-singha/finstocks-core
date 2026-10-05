import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  calculateInvestedValue,
  computeDayRealized,
  computeDayUnrealized,
  computeMarkedTotals,
  computePortfolioMetrics,
  type DayPricedRow,
  type InvestableStrategy,
} from '../portfolioSummary.ts';
import {trade} from './fixtures.ts';

const strategy = (o: Partial<InvestableStrategy> = {}): InvestableStrategy => ({
  status: 'RUNNING',
  is_mock: false,
  symbol: 'RELIANCE',
  budget_config: {val: 1000, mode: 'AMOUNT'},
  ...o,
});

test('calculateInvestedValue: AMOUNT budgets of live, running, same-segment strategies plus equity autopilot', () => {
  const strategies = [
    strategy(),
    strategy({status: 'paused', budget_config: {val: 500, mode: 'AMOUNT'}}),
    strategy({status: 'PENDING'}),
    strategy({status: 'COMPLETED'}),
    strategy({is_backtest: true}),
    strategy({is_mock: true}),
    strategy({budget_config: {val: 50, mode: 'QTY'}}),
    strategy({budget_config: {val: 10, mode: 'PERCENT'}}),
    strategy({
      symbol: 'NIFTY24JULFUT',
      budget_config: {val: 7000, mode: 'AMOUNT'},
    }),
    strategy({is_fno: true, budget_config: {val: 300, mode: 'AMOUNT'}}),
  ];
  const status = {is_mock: false, investment_amount: 20000};
  const trades = [
    trade({quantity: 10, buy_price: 100}),
    trade({quantity: 10, buy_price: 100, sell_price: 120}),
    trade({quantity: 1, buy_price: 100, status: 'SIMULATION'}),
    trade({
      stock_symbol: 'NIFTY2681824400PE',
      quantity: 50,
      buy_price: 24132,
      execution_payload: JSON.stringify({trigger_price: 50}),
    }),
  ];

  assert.deepEqual(
    calculateInvestedValue(strategies, status, false, 'equity', trades),
    {
      totalInvested: 21500,
      strategyInvested: 1500,
      autopilotInvested: 20000,
      costBasis: 1000,
    },
  );
  // F&O: no autopilot, the contract-symbol strategy counts, cost basis at the honest premium.
  assert.deepEqual(
    calculateInvestedValue(strategies, status, false, 'fno', trades),
    {
      totalInvested: 7300,
      strategyInvested: 7300,
      autopilotInvested: 0,
      costBasis: 2500,
    },
  );
  assert.deepEqual(
    calculateInvestedValue(strategies, status, true, 'equity', trades),
    {
      totalInvested: 1000,
      strategyInvested: 1000,
      autopilotInvested: 0,
      costBasis: 100,
    },
  );
  assert.equal(
    calculateInvestedValue(undefined, undefined, false, 'equity').totalInvested,
    0,
  );
});

test("calculateInvestedValue: a budget naming no mode is AMOUNT, as a script strategy's total capital is", () => {
  const strategies = [
    strategy({budget_config: {val: 200000, type: 'AMOUNT', allocate: '25%'}}),
    strategy({budget_config: {val: 400}}),
    strategy({budget_config: {mode: 'AMOUNT'}}),
    strategy({budget_config: null}),
    strategy({budget_config: {val: '900', mode: 'AMOUNT'} as never}),
    strategy({budget_config: {val: 30, mode: 7} as never}),
  ];
  assert.equal(
    calculateInvestedValue(strategies, undefined, false, 'equity')
      .strategyInvested,
    200430,
  );
});

test('computePortfolioMetrics adds the segment realised P&L onto invested', () => {
  const status = {
    is_mock: false,
    investment_amount: 5000,
    strategies: [strategy()],
  };
  const trades = [
    trade({quantity: 10, buy_price: 100, sell_price: 120}),
    trade({quantity: 10, buy_price: 100}),
    trade({
      stock_symbol: 'NIFTY24JULFUT',
      quantity: 1,
      buy_price: 100,
      sell_price: 90,
    }),
  ];
  const m = computePortfolioMetrics(trades, status, false, 'equity');
  assert.deepEqual(m, {
    invested: 6000,
    current: 6200,
    pnl: 200,
    strategyInvested: 1000,
    autopilotInvested: 5000,
    costBasis: 1000,
  });
  assert.equal(
    computePortfolioMetrics(trades, [strategy()], false, 'fno').pnl,
    -10,
  );
  assert.equal(
    computePortfolioMetrics(trades, undefined, false, 'fno').invested,
    0,
  );
});

test('computeDayRealized counts only exits on the current IST day', () => {
  // 20:00 UTC on 31 Aug is already 1 Sep in IST.
  const now = new Date(Date.UTC(2026, 7, 31, 20));
  const trades = [
    trade({
      quantity: 1,
      buy_price: 100,
      sell_price: 110,
      sell_time: '2026-08-31T21:00:00Z',
    }),
    trade({
      quantity: 1,
      buy_price: 100,
      sell_price: 90,
      sell_time: '2026-09-01T03:00:00Z',
    }),
    trade({
      quantity: 1,
      buy_price: 100,
      sell_price: 150,
      sell_time: '2026-08-31T10:00:00Z',
    }),
    trade({quantity: 1, buy_price: 100, sell_price: 150, sell_time: 'garbage'}),
    trade({quantity: 1, buy_price: 100}),
  ];
  assert.equal(computeDayRealized(trades, now), 0);
  assert.equal(computeDayRealized([], now), 0);
});

const priced = (o: Partial<DayPricedRow> = {}): DayPricedRow => ({
  current: 110,
  invested: 100,
  pnl: 10,
  oneDayChange: 2,
  shares: 5,
  hasDayChange: true,
  hasSoldTrades: false,
  hasLivePrice: true,
  ...o,
});

test('computeDayUnrealized is null for an unpriced book, never a confident zero', () => {
  assert.equal(computeDayUnrealized([]), null);
  assert.equal(computeDayUnrealized([priced({hasDayChange: false})]), null);
  assert.equal(computeDayUnrealized([priced({hasSoldTrades: true})]), null);
  assert.equal(
    computeDayUnrealized([
      priced(),
      priced({oneDayChange: -1, shares: 3}),
      priced({hasDayChange: false, oneDayChange: 99}),
    ]),
    7,
  );
});

test('computeMarkedTotals excludes rows it cannot price and says how many', () => {
  const rows = [
    priced(),
    priced({hasLivePrice: false, hasSoldTrades: true, current: 120, pnl: 20}),
    priced({hasLivePrice: false, current: 999, pnl: null}),
  ];
  assert.deepEqual(computeMarkedTotals(rows), {
    current: 230,
    invested: 200,
    pnl: 30,
    pricedCount: 2,
    unpricedCount: 1,
  });
});
