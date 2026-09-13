import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildPnlSeries,
  deriveAutopilotCard,
  deriveStrategyCards,
  resolveStrategyChartSymbol,
} from '../activeStrategies.ts';
import {strategy, trade, UUID_A, UUID_B, UUID_C, UUID_D} from './fixtures.ts';

const forA = `STRAT${UUID_A}`;
const trades = [
  trade({
    id: 't1',
    stock_symbol: 'RELIANCE',
    quantity: 10,
    buy_price: 100,
    sell_price: 110,
    buy_time: '2026-06-30T04:00:00Z',
    sell_time: '2026-07-01T04:00:00Z',
    execution_strategy: forA,
  }),
  trade({
    id: 't2',
    stock_symbol: 'TCS',
    quantity: 5,
    buy_price: 200,
    sell_price: 190,
    buy_time: '2026-07-02T04:00:00Z',
    sell_time: '2026-07-03T04:00:00Z',
    execution_strategy: forA,
  }),
  trade({
    id: 't3',
    stock_symbol: 'TCS',
    quantity: 2,
    buy_price: 300,
    buy_time: '2026-07-04T04:00:00Z',
    execution_strategy: forA,
  }),
  trade({
    id: 't4',
    stock_symbol: 'INFY',
    quantity: 4,
    buy_price: 50,
    buy_time: '2026-07-04T05:00:00Z',
    execution_strategy: forA,
  }),
  trade({
    id: 't5',
    stock_symbol: 'HDFCBANK',
    quantity: 10,
    buy_price: 100,
    sell_price: 120,
    buy_time: '2026-07-01T04:00:00Z',
    sell_time: '2026-07-02T04:00:00Z',
    execution_strategy: 'swing model long term hold',
  }),
  trade({
    id: 't6',
    stock_symbol: 'ITC',
    quantity: 3,
    buy_price: 400,
    buy_time: '2026-07-03T04:00:00Z',
    execution_strategy: 'swing model long term hold',
  }),
];

const strategies = [
  strategy({
    strategy_id: UUID_A,
    strategy_hname: 'RSI Dip',
    created_at: '2026-06-30T12:00:00Z',
  }),
  strategy({
    strategy_id: UUID_B,
    status: 'PAUSED',
    budget_config: {val: 5, mode: 'QTY'},
    created_at: '2026-07-05T12:00:00Z',
  }),
  strategy({
    strategy_id: UUID_C,
    status: 'COMPLETED',
    is_intraday: true,
    created_at: 'not a date',
  }),
  strategy({
    strategy_id: UUID_D,
    status: 'PENDING',
    is_fno: true,
    symbol: 'NIFTY',
    created_at: '2026-07-06T12:00:00Z',
  }),
];

test('deriveStrategyCards: realized KPIs from closed trades, unrealised from priced open rows', () => {
  const cards = deriveStrategyCards(strategies, trades, {TCS: 310});
  const a = cards.find(c => c.id === UUID_A);
  assert.ok(a);
  assert.equal(a.name, 'RSI Dip');
  assert.equal(a.statusLabel, 'Active');
  assert.equal(a.category, 'Swing');
  assert.equal(a.allocationMode, 'AMOUNT');
  assert.equal(a.startCapital, 100000);
  assert.equal(a.pnl, 50);
  assert.ok(Math.abs(a.pnlPct - 0.05) < 1e-12);
  assert.equal(a.hasClosedTrades, true);
  assert.equal(a.winRate, 50);
  assert.equal(a.winRatePct, '50%');
  assert.equal(a.avgHold, '1.0d');
  assert.ok(
    a.maxDrawdownPct !== null &&
      Math.abs(a.maxDrawdownPct - 5000 / 100100) < 1e-9,
  );
  assert.equal(a.openPositionsCount, 2);
  assert.equal(a.pricedOpenCount, 1);
  assert.equal(a.unrealizedPnl, 20);
  assert.deepEqual(
    a.positions.map(p => [p.symbol, p.pnl, p.value]),
    [
      ['TCS', 20, 600],
      ['INFY', null, 200],
    ],
  );
  assert.deepEqual(
    a.closedPositions.map(p => p.id),
    ['t2', 't1'],
  );
  assert.deepEqual(a.closedPnls, [100, -50]);
  assert.deepEqual(a.pnlSeries, [0, 100, 50]);
  assert.ok(a.equity.line.startsWith('M0.0'));
  assert.equal(a.startedLabel, '30 Jun 2026');
});

test('deriveStrategyCards: share-count budgets and exit-less strategies show placeholders', () => {
  const cards = deriveStrategyCards(strategies, trades);
  const b = cards.find(c => c.id === UUID_B);
  assert.ok(b);
  assert.equal(b.statusLabel, 'Paused');
  assert.equal(b.paused, true);
  assert.equal(b.startCapital, 100000);
  assert.equal(b.pnlPct, 0);
  assert.equal(b.maxDrawdownPct, null);
  assert.equal(b.winRatePct, '—');
  assert.equal(b.avgHold, '—');
  assert.equal(b.equity.line, '');
  assert.deepEqual(b.pnlSeries, []);
  assert.equal(b.name, 'Buy when RSI < 30');
  assert.equal(cards.find(c => c.id === UUID_C)?.statusLabel, 'Ended');
  assert.equal(cards.find(c => c.id === UUID_C)?.category, 'Intraday');
  assert.equal(cards.find(c => c.id === UUID_C)?.startedLabel, '—');
  assert.equal(cards.find(c => c.id === UUID_D)?.statusLabel, 'Pending');
  assert.equal(cards.find(c => c.id === UUID_D)?.category, 'F&O');
});

test('cards come back newest-first, with an unparseable created_at last', () => {
  const ids = deriveStrategyCards(strategies, trades).map(c => c.id);
  assert.deepEqual(ids, [UUID_D, UUID_B, UUID_A, UUID_C]);
});

test('deriveAutopilotCard groups by execution_strategy resolving to AUTOPILOT', () => {
  const card = deriveAutopilotCard(trades, 50000, {ITC: 410});
  assert.deepEqual(
    card.trades.map(t => t.id),
    ['t5', 't6'],
  );
  assert.equal(card.pnl, 200);
  assert.ok(Math.abs(card.pnlPct - 0.4) < 1e-12);
  assert.equal(card.winRatePct, '100%');
  assert.equal(card.openPositionsCount, 1);
  assert.equal(card.unrealizedPnl, 30);
  assert.equal(card.maxDrawdownPct, 0);
  assert.equal(deriveAutopilotCard(trades, undefined).maxDrawdownPct, null);
  assert.equal(deriveAutopilotCard(trades, undefined).startCapital, 100000);
});

test('resolveStrategyChartSymbol prefers what the strategy holds over a universe or list', () => {
  const [held] = deriveStrategyCards([strategies[0] as never], trades);
  assert.equal(held && resolveStrategyChartSymbol(held), 'TCS');
  const [declared] = deriveStrategyCards(
    [strategy({strategy_id: UUID_B, symbol: 'NIFTY100'})],
    [],
  );
  assert.equal(declared && resolveStrategyChartSymbol(declared), 'NIFTY100');
  const [list] = deriveStrategyCards(
    [strategy({strategy_id: UUID_B, symbol: 'AMBUJACEM, DLF'})],
    [],
  );
  assert.equal(list && resolveStrategyChartSymbol(list), null);
});

test('buildPnlSeries anchors the running total at 0 and is empty for no closes', () => {
  assert.deepEqual(buildPnlSeries([]), []);
  assert.deepEqual(buildPnlSeries([100, -50, 25]), [0, 100, 50, 75]);
});
