import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {TradeSummary} from '../../types/backtest.ts';
import {
  buildBacktestEquity,
  buildBacktestStatItems,
  buildEquityPath,
  calculateBacktestSummary,
  computeMaxDrawdownAmount,
  computeTradeReturnPct,
} from '../backtestStats.ts';

const trades = [
  {
    pnl: 1000,
    buy_time: '2026-01-05T04:00:00Z',
    sell_time: '2026-01-05T09:00:00Z',
  },
  {
    pnl: -500,
    buy_time: '2026-01-06T04:00:00Z',
    sell_time: '2026-01-07T04:00:00Z',
  },
  {
    pnl: 250,
    buy_time: '2026-01-08T04:00:00Z',
    sell_time: '2026-01-08T05:00:00Z',
  },
];

test('an empty backtest summarises to zeros without dividing by nothing', () => {
  const s = calculateBacktestSummary([]);
  assert.equal(s.totalTrades, 0);
  assert.equal(s.winRate, 0);
  assert.equal(s.avgHoldTime, '0min');
  assert.deepEqual(s.sharpeRatio, {value: null, tradingDays: 0});
  assert.equal(s.maxDrawdown, 0);
  assert.equal(s.maxDrawdownAmount, 0);
  assert.equal(s.periodDays, 0);
});

test('calculateBacktestSummary: realized totals, hold time, drawdowns and period', () => {
  const s = calculateBacktestSummary(trades);
  assert.equal(s.totalPnL, 750);
  assert.equal(s.totalTrades, 3);
  assert.ok(Math.abs(s.winRate - 200 / 3) < 1e-9);
  assert.equal(s.avgProfit, 625);
  assert.equal(s.avgLoss, 500);
  assert.equal(s.avgHoldTime, '10.0h');
  assert.ok(Math.abs(s.maxDrawdown - 500 / 101000) < 1e-12);
  assert.equal(s.maxDrawdownAmount, 500);
  assert.equal(s.sharpeRatio.tradingDays, 3);
  assert.ok(typeof s.sharpeRatio.value === 'number');
  assert.ok(Math.abs(s.periodDays - (3 + 1 / 24)) < 1e-9);
});

test('a null capital (QTY sizing) drops the percentage metrics but keeps the rupee drawdown', () => {
  const s = calculateBacktestSummary(trades, null);
  assert.deepEqual(s.sharpeRatio, {value: null, tradingDays: 0});
  assert.equal(s.maxDrawdown, 0);
  assert.equal(s.maxDrawdownAmount, 500);
  assert.equal(computeMaxDrawdownAmount([]), 0);
});

test('computeTradeReturnPct is return on cost, null without a cost', () => {
  assert.equal(
    computeTradeReturnPct({pnl: 100, buy_price: 50, quantity: 10}),
    20,
  );
  assert.equal(computeTradeReturnPct({pnl: 100}), null);
});

test('buildEquityPath scales the curve into the box, padded 6px, and reports the end points', () => {
  assert.deepEqual(buildEquityPath([], 100), {
    line: '',
    area: '',
    startY: 55,
    endY: 55,
  });
  const p = buildEquityPath([100, -50], 1000, 100, 50);
  assert.equal(p.line, 'M0.0 44.0 L50.0 6.0 L100.0 25.0');
  assert.equal(p.area, `${p.line} L100 50 L0 50 Z`);
  assert.equal(p.startY, 44);
  assert.equal(p.endY, 25);
});

test('buildBacktestEquity orders trades by exit before drawing, in the 720x210 box', () => {
  const p = buildBacktestEquity(
    [
      {pnl: -50, sell_time: '2026-01-02T00:00:00Z'},
      {pnl: 100, sell_time: '2026-01-01T00:00:00Z'},
    ],
    1000,
  );
  assert.equal(p.line, 'M0.0 204.0 L360.0 6.0 L720.0 105.0');
});

const summary = (o: Partial<TradeSummary>): TradeSummary => ({
  totalPnL: 0,
  totalTrades: 7,
  winRate: 57.142,
  avgProfit: 0,
  avgLoss: 0,
  avgHoldTime: '1.0d',
  sharpeRatio: {value: null, tradingDays: 0},
  maxDrawdown: 0.1234,
  maxDrawdownAmount: 800,
  periodDays: 0,
  ...o,
});

test('buildBacktestStatItems with a capital baseline: earnings, return %, drawdown %', () => {
  assert.deepEqual(buildBacktestStatItems(summary({}), 100000, 105000), [
    {k: 'Earnings', v: '+₹5,000', tone: 'profit'},
    {k: 'Total return', v: '+5.0%', tone: 'profit'},
    {k: 'Max drawdown', v: '12.3%', tone: 'secondary'},
    {k: '# Trades', v: '7'},
    {k: 'Win rate', v: '57.1%'},
  ]);
});

test('buildBacktestStatItems without a baseline falls back to rupee earnings and drawdown', () => {
  assert.deepEqual(
    buildBacktestStatItems(summary({totalPnL: -1200}), undefined, undefined),
    [
      {k: 'Earnings', v: '-₹1,200', tone: 'loss'},
      {k: 'Total return', v: '—', tone: 'muted'},
      {k: 'Max drawdown (₹)', v: '-₹800', tone: 'secondary'},
      {k: '# Trades', v: '7'},
      {k: 'Win rate', v: '57.1%'},
    ],
  );
});
