import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildPnlSeries,
  DEFAULT_START_CAPITAL,
  deriveAutopilotCard,
  deriveStrategyCards,
  resolveStrategyChartSymbol,
} from '../activeStrategies.ts';
import type {Strategy} from '../../types/trade.ts';
import {
  athenaRow,
  sparseRow,
  strategy,
  trade,
  UUID_A,
  UUID_B,
  UUID_C,
  UUID_D,
  UUID_E,
} from './fixtures.ts';

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

test('deriveStrategyCards: a budget with no mode sizes by AMOUNT; a missing or odd one never throws', () => {
  const [unset] = deriveStrategyCards(
    [strategy({strategy_id: UUID_A, budget_config: {val: 50000}})],
    trades,
  );
  assert.ok(unset);
  assert.equal(unset.allocated, 50000);
  assert.equal(unset.allocationMode, undefined);
  assert.equal(unset.startCapital, 50000);
  assert.ok(Math.abs(unset.pnlPct - 0.1) < 1e-12);
  assert.notEqual(unset.maxDrawdownPct, null);

  // Off the wire, where the type promises nothing.
  const cardFor = (budget: unknown) => {
    const row = {
      ...strategy({strategy_id: UUID_A}),
      budget_config: budget,
    } as Strategy;
    const [card] = deriveStrategyCards([row], trades);
    assert.ok(card, JSON.stringify(budget));
    return card;
  };
  for (const budget of [undefined, null, {}, {mode: 'AMOUNT', val: '50000'}]) {
    const card = cardFor(budget);
    const said = JSON.stringify(budget);
    assert.equal(card.pnl, 50, said);
    assert.equal(card.allocated, 0, said);
    assert.equal(card.startCapital, DEFAULT_START_CAPITAL, said);
    assert.equal(card.pnlPct, 0, said);
    assert.equal(card.maxDrawdownPct, null, said);
    assert.equal(card.equity.line, '', said);
    assert.deepEqual(card.pnlSeries, [0, 100, 50], said);
    assert.equal(card.statusLabel, 'Active', said);
    assert.equal(card.openPositionsCount, 2, said);
  }
  assert.equal(
    cardFor({mode: 'AMOUNT', val: '50000'}).allocationMode,
    'AMOUNT',
  );
  assert.equal(cardFor(null).allocationMode, undefined);
  const noVal = cardFor({mode: 'AMOUNT'});
  assert.equal(noVal.allocated, 0);
  assert.equal(noVal.startCapital, DEFAULT_START_CAPITAL);
  assert.equal(noVal.pnlPct, 0);
  assert.equal(noVal.maxDrawdownPct, null);
  const oddMode = cardFor({mode: 7, val: 50000});
  assert.equal(oddMode.allocationMode, undefined);
  assert.equal(oddMode.startCapital, 50000);
});

test('deriveStrategyCards: an Athena script row reads its val as the total capital its return is on', () => {
  const scriptTrades = [
    trade({
      id: 's1',
      stock_symbol: 'RELIANCE',
      quantity: 10,
      buy_price: 2500,
      sell_price: 2600,
      buy_time: '2026-07-08T04:00:00Z',
      sell_time: '2026-07-09T04:00:00Z',
      execution_strategy: `STRAT${UUID_E}`,
    }),
  ];
  const [card] = deriveStrategyCards([athenaRow()], scriptTrades);
  assert.ok(card);
  assert.equal(card.id, UUID_E);
  assert.equal(card.name, 'Breakout script');
  assert.equal(card.statusLabel, 'Active');
  assert.equal(card.category, 'Swing');
  assert.equal(card.allocated, 200000);
  assert.equal(card.allocationMode, undefined);
  assert.equal(card.startCapital, 200000);
  assert.equal(card.pnl, 1000);
  assert.equal(card.pnlPct, 0.5);
  assert.equal(card.maxDrawdownPct, 0);
  assert.notEqual(card.equity.line, '');
  assert.equal(
    deriveStrategyCards([athenaRow({status: 'ERROR'})], [])[0]?.statusLabel,
    'Ended',
  );
});

test('a sparse row - no symbol, prompt, timeframe or budget - derives a card and charts nothing', () => {
  const [card] = deriveStrategyCards([sparseRow()], []);
  assert.ok(card);
  assert.equal(card.name, 'Strategy');
  assert.equal(card.category, 'Swing');
  assert.equal(card.statusLabel, 'Active');
  assert.equal(card.allocated, 0);
  assert.equal(card.pnlPct, 0);
  assert.equal(resolveStrategyChartSymbol(card), null);
  const [symbolLess] = deriveStrategyCards(
    [athenaRow({symbol: undefined})],
    [],
  );
  assert.ok(symbolLess);
  assert.equal(resolveStrategyChartSymbol(symbolLess), null);
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
