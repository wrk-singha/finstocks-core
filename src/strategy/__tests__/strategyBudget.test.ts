import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {BudgetConfig} from '../../types/trade.ts';
import {
  budgetHasRealCapital,
  budgetMode,
  budgetSizingMode,
  budgetVal,
  isScriptBudget,
  isScriptStrategy,
  normalizeStrategyRow,
  normalizeTradeStatus,
  strategyPositionSize,
} from '../strategyBudget.ts';
import {athenaRow, sparseRow, strategy, UUID_A} from './fixtures.ts';

const SCRIPT: BudgetConfig = {val: 200000, type: 'AMOUNT', allocate: '25%'};
// What backend-go 4c1db7b4 writes for a QTY strategy-action: the default capital and the count.
const SCRIPT_QTY: BudgetConfig = {val: 100000, type: 'QTY', qty: 2};
// What the wire can carry where the type says otherwise.
const odd = (budget: unknown) => budget as BudgetConfig;

test('budgetMode: upper-cased, and AMOUNT when the row names none', () => {
  assert.equal(budgetMode({val: 5, mode: 'qty'}), 'QTY');
  assert.equal(budgetMode({val: 5}), 'AMOUNT');
  assert.equal(budgetMode(SCRIPT), 'AMOUNT');
  assert.equal(budgetMode(null), 'AMOUNT');
  assert.equal(budgetMode(undefined), 'AMOUNT');
  assert.equal(budgetMode(odd({mode: 7, val: 5})), 'AMOUNT');
  assert.equal(budgetMode({val: 5, mode: 'PERCENTAGE'}), 'PERCENTAGE');
});

test('budgetSizingMode: one of the editor four, AMOUNT for anything else', () => {
  assert.equal(
    budgetSizingMode({val: 1, mode: 'risk_percent'}),
    'RISK_PERCENT',
  );
  assert.equal(budgetSizingMode({val: 1, mode: 'PERCENTAGE'}), 'AMOUNT');
  assert.equal(budgetSizingMode(SCRIPT), 'AMOUNT');
  assert.equal(budgetSizingMode(undefined), 'AMOUNT');
});

test('budgetVal: a finite number or nothing', () => {
  assert.equal(budgetVal({val: 0, mode: 'AMOUNT'}), 0);
  assert.equal(budgetVal(SCRIPT), 200000);
  assert.equal(budgetVal({mode: 'AMOUNT'}), undefined);
  assert.equal(budgetVal(odd({val: '5000', mode: 'AMOUNT'})), undefined);
  assert.equal(budgetVal(odd({val: Number.NaN})), undefined);
  assert.equal(budgetVal(null), undefined);
});

test('isScriptBudget: a type and no mode, or an allocate whatever else is there', () => {
  assert.equal(isScriptBudget(SCRIPT), true);
  assert.equal(isScriptBudget({val: 5, mode: 'AMOUNT', allocate: '25%'}), true);
  assert.equal(isScriptBudget({val: 5, type: 'AMOUNT'}), true);
  assert.equal(isScriptBudget({val: 5, mode: 'AMOUNT', type: 'AMOUNT'}), false);
  assert.equal(isScriptBudget({val: 50000}), false);
  assert.equal(isScriptBudget(null), false);
});

test('isScriptStrategy: by the budget shape, or by having no mode, FSM or rules', () => {
  assert.equal(isScriptStrategy(athenaRow()), true);
  assert.equal(isScriptStrategy(sparseRow()), true);
  // Positive by shape: it stays one after gaining a mode, an FSM or rules.
  assert.equal(
    isScriptStrategy(
      athenaRow({
        budget_config: {val: 200000, mode: 'AMOUNT', allocate: '25%'},
        fsm: {states: {IDLE: {}}, variables: [], initial_state: 'IDLE'},
      }),
    ),
    true,
  );
  const normal = strategy({strategy_id: UUID_A});
  assert.equal(isScriptStrategy(normal), false);
  assert.equal(strategyPositionSize(normal), 100000);
  // A normal row that lost its mode has neither FSM nor rules here: a script by what it lacks.
  const modeless = strategy({strategy_id: UUID_A, budget_config: {val: 5}});
  assert.equal(isScriptStrategy(modeless), true);
  assert.equal(strategyPositionSize(modeless), undefined);
  // With rules it is a rule strategy whose mode is the default.
  const ruled = strategy({
    strategy_id: UUID_A,
    budget_config: {val: 5},
    rules: {entry: [{condition: 'rsi14 < 30'}], exit: []},
  });
  assert.equal(isScriptStrategy(ruled), false);
  assert.equal(strategyPositionSize(ruled), 5);
  assert.equal(strategyPositionSize(athenaRow()), undefined);
});

test('normalizeStrategyRow fills what the backend dropped and leaves the budget and FSM as sent', () => {
  const row = normalizeStrategyRow(sparseRow());
  assert.equal(row.symbol, '');
  assert.equal(row.original_query, '');
  assert.equal(row.timeframe, '');
  assert.equal(row.execution_mode, '');
  assert.equal(row.market, 'IN');
  assert.equal(row.target_scope, null);
  assert.deepEqual(
    [row.is_parent, row.is_intraday, row.is_backtest, row.is_fno],
    [false, false, false, false],
  );
  assert.equal(row.budget_config, null);
  assert.equal('fsm' in row, false);
  assert.equal(row.status, 'ACTIVE');
  const full = strategy({strategy_id: UUID_A, is_fno: true});
  assert.deepEqual(normalizeStrategyRow(full), full);

  const status = normalizeTradeStatus({
    message: false,
    key: 'IN',
    is_mock: true,
    strategies: [sparseRow()],
  });
  assert.equal(status.strategies[0]?.symbol, '');
  assert.deepEqual(
    normalizeTradeStatus({message: false, key: 'IN', is_mock: true}).strategies,
    [],
  );
});

test('a script budget sized by quantity reads as QTY with its qty, never AMOUNT of its val', () => {
  assert.equal(budgetMode(SCRIPT_QTY), 'QTY');
  assert.equal(budgetMode(odd({val: 100000, type: 'qty', qty: 2})), 'QTY');
  assert.equal(budgetSizingMode(SCRIPT_QTY), 'QTY');
  assert.equal(budgetVal(SCRIPT_QTY), 2);
  assert.equal(isScriptBudget(SCRIPT_QTY), true);
  // No readable qty is no size: the 1,00,000 capital pool is never read as a count.
  assert.equal(budgetVal({val: 100000, type: 'QTY'}), undefined);
  assert.equal(budgetVal(odd({val: 100000, type: 'QTY', qty: '2'})), undefined);
  // A mode the row writes wins over the type.
  assert.equal(budgetMode({val: 50000, mode: 'AMOUNT', type: 'QTY'}), 'AMOUNT');
  assert.equal(
    budgetVal({val: 50000, mode: 'AMOUNT', type: 'QTY', qty: 2}),
    50000,
  );
  // An odd type is no QTY.
  assert.equal(budgetMode(odd({val: 100000, type: 7, qty: 2})), 'AMOUNT');

  const row = athenaRow({budget_config: SCRIPT_QTY, is_fno: true});
  assert.equal(isScriptStrategy(row), true);
  assert.equal(strategyPositionSize(row), 2);
  assert.equal(
    strategyPositionSize(
      athenaRow({budget_config: {val: 100000, type: 'QTY'}}),
    ),
    undefined,
  );
});

test('budgetHasRealCapital: only an AMOUNT budget with a positive figure', () => {
  assert.equal(budgetHasRealCapital({val: 50000, mode: 'AMOUNT'}), true);
  assert.equal(budgetHasRealCapital({val: 50000}), true);
  assert.equal(budgetHasRealCapital(SCRIPT), true);
  assert.equal(budgetHasRealCapital(SCRIPT_QTY), false);
  assert.equal(budgetHasRealCapital({val: 5, mode: 'QTY'}), false);
  assert.equal(
    budgetHasRealCapital({val: 10, mode: 'PERCENT', total: 1}),
    false,
  );
  assert.equal(budgetHasRealCapital({val: 0, mode: 'AMOUNT'}), false);
  assert.equal(budgetHasRealCapital(null), false);
});
