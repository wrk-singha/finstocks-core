import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {BudgetConfig} from '../../types/trade.ts';
import {
  budgetMode,
  budgetPositionSize,
  budgetSizingMode,
  budgetVal,
  isScriptBudget,
} from '../strategyBudget.ts';

const SCRIPT: BudgetConfig = {val: 200000, type: 'AMOUNT', allocate: '25%'};
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

test('isScriptBudget: a type and no mode; its val is no position size', () => {
  assert.equal(isScriptBudget(SCRIPT), true);
  assert.equal(isScriptBudget({val: 5, mode: 'AMOUNT', type: 'AMOUNT'}), false);
  assert.equal(isScriptBudget({val: 50000}), false);
  assert.equal(isScriptBudget(null), false);
  assert.equal(budgetPositionSize(SCRIPT), undefined);
  assert.equal(budgetPositionSize({val: 50000}), 50000);
  assert.equal(budgetPositionSize({val: 5, mode: 'QTY'}), 5);
});
