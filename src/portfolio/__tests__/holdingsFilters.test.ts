import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  applyPerfFilter,
  applySearchFilter,
  applyStrategyFilter,
  buildStrategyOptions,
  filterRelevantTrades,
  flipSortDir,
  sortHoldings,
  sortPositions,
  strategyKeyOf,
} from '../holdingsFilters.ts';
import {trade} from './fixtures.ts';

test('filterRelevantTrades: mode first, then bought/sold in range or still open before the end', () => {
  const range = {start: new Date(2026, 7, 10), end: new Date(2026, 7, 20)};
  const rows = [
    trade({id: 'open-before', buy_time: '2026-08-01T04:00:00Z'}),
    trade({id: 'bought-in', buy_time: '2026-08-12T04:00:00Z'}),
    trade({
      id: 'sold-in',
      buy_time: '2026-08-01T04:00:00Z',
      sell_time: '2026-08-15T04:00:00Z',
      sell_price: 1,
    }),
    trade({
      id: 'closed-before',
      buy_time: '2026-08-01T04:00:00Z',
      sell_time: '2026-08-02T04:00:00Z',
      sell_price: 1,
    }),
    trade({id: 'future', buy_time: '2026-08-25T04:00:00Z'}),
    trade({id: 'mock', buy_time: '2026-08-12T04:00:00Z', status: 'SIMULATION'}),
  ];
  const live = filterRelevantTrades(rows, {
    dateRange: range,
    isMockEnabled: false,
    selectedMarket: 'IN',
  });
  assert.deepEqual(
    live.map(t => t.id),
    ['open-before', 'bought-in', 'sold-in'],
  );
  const mock = filterRelevantTrades(rows, {
    dateRange: range,
    isMockEnabled: true,
    selectedMarket: 'IN',
  });
  assert.deepEqual(
    mock.map(t => t.id),
    ['mock'],
  );
  const all = filterRelevantTrades(rows, {
    dateRange: range,
    isMockEnabled: true,
    selectedMarket: 'IN',
    disableFiltering: true,
  });
  assert.deepEqual(
    all.map(t => t.id),
    ['open-before', 'bought-in', 'sold-in', 'mock'],
  );
});

const row = (
  symbol: string,
  pnl: number | null,
  extra: Partial<{
    hasSoldTrades: boolean;
    hasLivePrice: boolean;
    strategyId: string | null;
    strategyDisplay: string;
    strategyNumber: number | null;
    strategyDescription: string;
    currentPrice: number;
    returnPercent: number;
    todayPercent: number;
  }> = {},
) => ({
  symbol,
  pnl,
  hasSoldTrades: false,
  hasLivePrice: true,
  strategyId: null,
  strategyDisplay: 'MANUAL',
  strategyNumber: null,
  currentPrice: 100,
  returnPercent: 0,
  todayPercent: 0,
  ...extra,
});

test('perf and search filters', () => {
  const rows = [
    row('A', 10),
    row('B', -5),
    row('C', 0),
    row('D', null, {hasLivePrice: false}),
    row('E', 7, {hasLivePrice: false, hasSoldTrades: true}),
  ];
  assert.deepEqual(
    applyPerfFilter(rows, 'winners').map(r => r.symbol),
    ['A', 'C', 'E'],
  );
  assert.deepEqual(
    applyPerfFilter(rows, 'losers').map(r => r.symbol),
    ['B'],
  );
  assert.equal(applyPerfFilter(rows, 'all'), rows);
  assert.deepEqual(
    applySearchFilter(rows, '  a').map(r => r.symbol),
    ['A'],
  );
  assert.equal(applySearchFilter(rows, ' '), rows);
});

test('buildStrategyOptions counts once per row and orders strategies by number', () => {
  const rows = [
    row('A', 1, {
      strategyId: 's2',
      strategyDisplay: 'STRATEGY',
      strategyNumber: 2,
      strategyDescription: 'Momentum',
    }),
    row('B', 1, {
      strategyId: 's1',
      strategyDisplay: 'STRATEGY',
      strategyNumber: 1,
      strategyDescription: '',
    }),
    row('C', 1, {
      strategyId: 's2',
      strategyDisplay: 'STRATEGY',
      strategyNumber: 2,
    }),
    row('D', 1, {strategyDisplay: 'AUTOPILOT'}),
    row('E', 1),
    row('F', 1),
  ];
  assert.deepEqual(buildStrategyOptions(rows), [
    {value: 'all', label: 'All strategies', count: 6},
    {value: 's1', label: 'Strategy 1', count: 1},
    {value: 's2', label: 'Momentum', count: 2},
    {value: 'AUTOPILOT', label: 'Autopilot', count: 1},
    {value: 'MANUAL', label: 'Manual', count: 2},
  ]);
  assert.equal(
    strategyKeyOf(row('Z', 1, {strategyId: 's2', strategyDisplay: 'STRATEGY'})),
    's2',
  );
  assert.equal(strategyKeyOf(row('Z', 1)), 'MANUAL');
  assert.deepEqual(
    applyStrategyFilter(rows, 's2').map(r => r.symbol),
    ['A', 'C'],
  );
  assert.deepEqual(
    applyStrategyFilter(rows, 'MANUAL').map(r => r.symbol),
    ['E', 'F'],
  );
  assert.equal(applyStrategyFilter(rows, 'all'), rows);
});

test('sortHoldings: unit picks the lens; rows with no return sort as neutral', () => {
  const rows = [
    row('A', 100, {returnPercent: 5, currentPrice: 10, todayPercent: -1}),
    row('B', -50, {returnPercent: -20, currentPrice: 30, todayPercent: 2}),
    row('C', null, {
      hasLivePrice: false,
      returnPercent: 99,
      currentPrice: 20,
      todayPercent: 0,
    }),
  ];
  assert.deepEqual(
    sortHoldings(rows, 'return').map(r => r.symbol),
    ['A', 'C', 'B'],
  );
  assert.deepEqual(
    sortHoldings(rows, 'return', 'asc', 'amount').map(r => r.symbol),
    ['B', 'C', 'A'],
  );
  assert.deepEqual(
    sortHoldings(rows, 'price', 'desc', 'amount').map(r => r.symbol),
    ['B', 'C', 'A'],
  );
  assert.deepEqual(
    sortHoldings(rows, 'price', 'desc', 'percent').map(r => r.symbol),
    ['B', 'C', 'A'],
  );
  assert.deepEqual(
    sortHoldings(rows, 'name', 'asc').map(r => r.symbol),
    ['A', 'B', 'C'],
  );
  assert.equal(flipSortDir('asc'), 'desc');
});

test('sortPositions keeps unpriced rows last in either direction', () => {
  const rows = [
    {sym: 'A', pnl: 10, valueNum: 100},
    {sym: 'B', pnl: null, valueNum: 50},
    {sym: 'C', pnl: -30, valueNum: 100},
    {sym: 'D', pnl: 5, valueNum: 10},
  ];
  assert.deepEqual(
    sortPositions(rows, 'return', 'desc', 'amount').map(r => r.sym),
    ['A', 'D', 'C', 'B'],
  );
  assert.deepEqual(
    sortPositions(rows, 'return', 'asc', 'amount').map(r => r.sym),
    ['C', 'D', 'A', 'B'],
  );
  assert.deepEqual(
    sortPositions(rows, 'return', 'desc', 'percent').map(r => r.sym),
    ['D', 'A', 'C', 'B'],
  );
  assert.deepEqual(
    sortPositions(rows, 'price', 'asc').map(r => r.sym),
    ['D', 'A', 'C', 'B'],
  );
  assert.deepEqual(
    sortPositions(rows, 'name', 'desc').map(r => r.sym),
    ['D', 'C', 'B', 'A'],
  );
});
