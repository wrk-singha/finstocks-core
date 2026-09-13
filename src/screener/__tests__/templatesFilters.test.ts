import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ScreenerStrategy} from '../../types/screener.ts';
import {
  applyTemplateFilters,
  compareMetric,
  countActiveTemplateFilters,
  DEFAULT_TEMPLATE_FILTERS,
  strategyCount,
} from '../templatesFilters.ts';

const template = (
  o: Partial<ScreenerStrategy> & {name: string},
): ScreenerStrategy => ({
  id: 1,
  description: '',
  symbol: 'NIFTY100',
  is_premium: false,
  created_at: '',
  ...o,
});

const list = [
  template({
    name: 'low',
    avg_pnl: 12,
    avg_winrate: 60,
    max_drawdown_pct: 8,
    equity_curve: [0, 1],
  }),
  template({
    name: 'high',
    avg_pnl: 30,
    avg_winrate: 40,
    max_drawdown_pct: 28,
    equity_curve: [0, 1],
  }),
  template({name: 'static'}),
];

test('applyTemplateFilters drops strategies missing a constrained metric', () => {
  assert.deepEqual(
    applyTemplateFilters(list, DEFAULT_TEMPLATE_FILTERS).map(s => s.name),
    ['low', 'high', 'static'],
  );
  assert.deepEqual(
    applyTemplateFilters(list, {
      ...DEFAULT_TEMPLATE_FILTERS,
      risk: ['low'],
    }).map(s => s.name),
    ['low'],
  );
  assert.deepEqual(
    applyTemplateFilters(list, {
      ...DEFAULT_TEMPLATE_FILTERS,
      minReturn: 20,
    }).map(s => s.name),
    ['high'],
  );
  assert.deepEqual(
    applyTemplateFilters(list, {
      ...DEFAULT_TEMPLATE_FILTERS,
      minWinRate: 50,
    }).map(s => s.name),
    ['low'],
  );
  assert.deepEqual(
    applyTemplateFilters(list, {
      ...DEFAULT_TEMPLATE_FILTERS,
      maxDrawdown: 10,
    }).map(s => s.name),
    ['low'],
  );
});

test('compareMetric sinks missing values in both directions', () => {
  assert.deepEqual(
    [3, null, 1, undefined, 2].sort((a, b) => compareMetric(a, b, 'desc')),
    [3, 2, 1, null, undefined],
  );
  assert.deepEqual(
    [3, null, 1].sort((a, b) => compareMetric(a, b, 'asc')),
    [1, 3, null],
  );
});

test('labels and the active-filter badge count', () => {
  assert.equal(strategyCount(1), '1 strategy');
  assert.equal(strategyCount(6), '6 strategies');
  assert.equal(countActiveTemplateFilters(DEFAULT_TEMPLATE_FILTERS), 0);
  assert.equal(
    countActiveTemplateFilters({
      risk: ['low'],
      minReturn: 5,
      minWinRate: 0,
      maxDrawdown: 20,
    }),
    3,
  );
});
