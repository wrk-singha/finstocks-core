import assert from 'node:assert/strict';
import {test} from 'node:test';

import {normalizeStrategyRow} from '../strategyBudget.ts';
import {buildBacktestAgainQuery, buildDeployQuery} from '../strategyQuery.ts';
import {strategy, UUID_A} from './fixtures.ts';

test('buildBacktestAgainQuery: a shared backtest as is-alive sends it, asked for again in words', () => {
  const row = normalizeStrategyRow({
    strategy_id: UUID_A,
    is_mock: true,
    created_at: '2026-10-01T10:00:00Z',
    symbol: 'TCS',
    timeframe: '15m',
    original_query: 'Buy when RSI < 30',
    is_backtest: true,
  });
  assert.equal(
    buildBacktestAgainQuery(row),
    'Backtest this exact strategy: Buy when RSI < 30, on TCS, on the 15m timeframe',
  );
});

test('buildBacktestAgainQuery: every rule the row carries, and no size', () => {
  assert.equal(
    buildBacktestAgainQuery(
      strategy({
        strategy_id: UUID_A,
        symbol: 'CUSTOM_LIST',
        is_intraday: true,
        take_profit: 5,
        stop_loss: 2,
        rules: {
          entry: [],
          exit: [],
          nlp_triggers: [{id: 'n1', summary: 'the CEO resigns'}],
        },
      }),
    ),
    'Backtest this exact strategy: Buy when RSI < 30, intraday, squared off same day, take profit +5%, stop loss -2%, exit when the CEO resigns',
  );
});

test('buildDeployQuery: the edited entry, the overrides and the capital; an empty override is none', () => {
  const row = strategy({strategy_id: UUID_A});
  assert.equal(
    buildDeployQuery(row, 'Buy when RSI < 25', 50_000, 'INFY', '1h'),
    'Instantly run this exact strategy now: Buy when RSI < 25, on INFY, on the 1h timeframe, with a capital of 50000',
  );
  assert.equal(
    buildDeployQuery(row, 'Buy when RSI < 25', undefined, '', ''),
    'Instantly run this exact strategy now: Buy when RSI < 25, on TCS, on the 15m timeframe',
  );
});
