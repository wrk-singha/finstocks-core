import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  ScreenerBacktestResult,
  ScreenerStrategy,
} from '../../types/screener.ts';
import {
  buildDeployMessage,
  computeSummaryStats,
  confirmedTimeframes,
  deriveRiskTier,
  formatBacktestProfitPct,
  getMonthlyData,
  mapTimeframeLabel,
  picksResetInfo,
  picksResetMessage,
  splitEntryExit,
  strategyHorizon,
  strategyRiskTier,
} from '../screenerUtils.ts';

const result = (
  o: Partial<ScreenerBacktestResult> & {period_label: string},
): ScreenerBacktestResult => ({
  id: 1,
  strategy_id: 1,
  timeframe: '15m',
  period_start: '',
  period_end: '',
  is_intraday: false,
  target_pct: 0,
  stop_loss_pct: 0,
  total_trades: null,
  realized_pnl: null,
  duration_seconds: null,
  trades_log: null,
  created_at: '',
  ...o,
});

const template = (o: Partial<ScreenerStrategy>): ScreenerStrategy => ({
  id: 1,
  name: 'x',
  description: '',
  symbol: 'NIFTY100',
  is_premium: false,
  created_at: '',
  ...o,
});

test('timeframe labels and the confirmed list', () => {
  assert.equal(mapTimeframeLabel('15m'), '15 Min');
  assert.equal(mapTimeframeLabel('1w'), '1w');
  assert.equal(confirmedTimeframes(undefined), null);
  assert.equal(confirmedTimeframes([]), null);
  assert.deepEqual(confirmedTimeframes(['1m', '1d', '1w']), ['1d', '1m']);
});

test('getMonthlyData fills 12 months, summing the trade log when present', () => {
  const months = getMonthlyData(
    [
      result({
        period_label: 'Jan 2024',
        total_trades: 2,
        trades_log: [
          {pnl: 100, symbol: 'A'},
          {pnl: -30, symbol: 'B'},
        ],
      }),
      result({period_label: 'Mar 2024', total_trades: 1, realized_pnl: 55}),
      result({period_label: 'Feb 2024', timeframe: '1d', realized_pnl: 999}),
      result({period_label: 'Jan 2023', realized_pnl: 999}),
      result({period_label: 'Foo 2024', realized_pnl: 999}),
    ],
    '15m',
    2024,
  );
  assert.equal(months.length, 12);
  assert.deepEqual(months.map(m => m.month).slice(0, 3), ['Jan', 'Feb', 'Mar']);
  assert.deepEqual(months[0], {
    month: 'Jan',
    profit: 70,
    totalTrades: 2,
    trades_log: [
      {pnl: 100, symbol: 'A'},
      {pnl: -30, symbol: 'B'},
    ],
  });
  assert.deepEqual(months[1], {
    month: 'Feb',
    profit: 0,
    totalTrades: 0,
    trades_log: [],
  });
  assert.equal(months[2]?.profit, 55);
  assert.deepEqual(computeSummaryStats(months), {
    totalReturn: 125,
    bestMonth: {month: 'Jan', profit: 70},
    worstMonth: {month: 'Feb', profit: 0},
  });
  assert.deepEqual(computeSummaryStats(getMonthlyData([], '15m', 2024)), {
    totalReturn: null,
    bestMonth: null,
    worstMonth: null,
  });
  assert.deepEqual(computeSummaryStats([]), {
    totalReturn: null,
    bestMonth: null,
    worstMonth: null,
  });
});

test('strategyHorizon and the empty-picks copy', () => {
  assert.equal(strategyHorizon(template({is_intraday: true})), 'intraday');
  assert.equal(strategyHorizon(template({})), 'longterm');
  assert.equal(strategyHorizon(template({avg_pnl: 3})), 'swing');
  assert.equal(
    picksResetMessage('longterm'),
    "Today's picks are being finalized — check back soon.",
  );
  assert.equal(
    picksResetMessage('swing'),
    "This week's picks are done — the next set lands next Monday at 9:05 AM.",
  );
  const wednesdayMorning = new Date('2026-06-10T02:30:00Z');
  assert.equal(
    picksResetMessage('intraday', wednesdayMorning),
    "Today's picks are done — the next set lands at 9:05 AM.",
  );
  const fridayNoon = new Date('2026-06-12T06:30:00Z');
  assert.equal(
    picksResetMessage('intraday', fridayNoon),
    "Today's picks are done — the next set lands at 9:05 AM Monday.",
  );
});

test('risk tiers come from drawdown, and only for strategies with a real curve', () => {
  assert.deepEqual(deriveRiskTier(10), {
    label: 'Low risk',
    short: 'Low',
    tone: 'low',
  });
  assert.equal(deriveRiskTier(20)?.tone, 'med');
  assert.equal(deriveRiskTier(25)?.tone, 'high');
  assert.equal(deriveRiskTier(undefined), null);
  assert.equal(strategyRiskTier(template({max_drawdown_pct: 10})), null);
  assert.equal(
    strategyRiskTier(template({max_drawdown_pct: 10, equity_curve: [0, 5]}))
      ?.tone,
    'low',
  );
});

test('splitEntryExit separates prose rules at the first exit keyword', () => {
  assert.deepEqual(splitEntryExit('Buy when RSI < 30. Exit when RSI > 70'), {
    entry: 'RSI < 30',
    exit: 'RSI > 70',
  });
  assert.deepEqual(
    splitEntryExit('Go long on  a breakout; square-off at close'),
    {entry: 'a breakout', exit: 'at close'},
  );
  assert.deepEqual(splitEntryExit('Momentum burst'), {
    entry: 'Momentum burst',
    exit: '',
  });
  assert.deepEqual(splitEntryExit('Sell when RSI > 70'), {
    entry: 'RSI > 70',
    exit: 'RSI > 70',
  });
  assert.deepEqual(splitEntryExit(''), {entry: '', exit: ''});
});

test('formatBacktestProfitPct reads a ₹1L-notional P&L as a percentage', () => {
  assert.equal(formatBacktestProfitPct(12345), '+12.35%');
  assert.equal(formatBacktestProfitPct(-500), '-0.50%');
  assert.equal(formatBacktestProfitPct(0), '0.00%');
  assert.equal(
    buildDeployMessage('Deploy RSI dip', '15m', true),
    'Deploy RSI dip intraday:true selected time frame : 15m',
  );
  assert.equal(
    buildDeployMessage('Deploy RSI dip', '1d'),
    'Deploy RSI dip selected time frame : 1d',
  );
});

const wednesdayMorning = new Date('2026-06-10T02:30:00Z');
const wednesdayNoon = new Date('2026-06-10T06:30:00Z');
const fridayNoon = new Date('2026-06-12T06:30:00Z');

test('picks reset info names each horizon’s next run', () => {
  assert.deepEqual(picksResetInfo('longterm'), {kind: 'finalizing'});
  assert.deepEqual(picksResetInfo('swing'), {kind: 'nextMonday', at: '09:05'});
  assert.deepEqual(picksResetInfo('intraday', wednesdayMorning), {
    kind: 'nextBatch',
    at: '9:05 AM',
  });
  assert.deepEqual(picksResetInfo('intraday', wednesdayNoon), {
    kind: 'nextBatch',
    at: '9:05 AM tomorrow',
  });
  assert.deepEqual(picksResetInfo('intraday', fridayNoon), {
    kind: 'nextBatch',
    at: '9:05 AM Monday',
  });
});

// Recorded from the v0.2.4 implementation before picksResetMessage was rebuilt on picksResetInfo.
test('picks reset message reads exactly as v0.2.4 did', () => {
  assert.deepEqual(
    [
      picksResetMessage('longterm'),
      picksResetMessage('swing'),
      picksResetMessage('intraday', wednesdayMorning),
      picksResetMessage('intraday', wednesdayNoon),
      picksResetMessage('intraday', fridayNoon),
    ],
    [
      "Today's picks are being finalized — check back soon.",
      "This week's picks are done — the next set lands next Monday at 9:05 AM.",
      "Today's picks are done — the next set lands at 9:05 AM.",
      "Today's picks are done — the next set lands at 9:05 AM tomorrow.",
      "Today's picks are done — the next set lands at 9:05 AM Monday.",
    ],
  );
});
