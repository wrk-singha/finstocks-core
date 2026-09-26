import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildCashFlowTable} from '../cashFlowTable.ts';
import {
  childIds,
  childValues,
  GENERAL_CF,
  GENERAL_PL,
  GENERAL_STATEMENTS,
  round,
  series,
  valuesOf,
} from './filings.ts';

const pct = (part: number, whole: number): number => (part / whole) * 100;

test('the cash flows open operating cash into what the vendor files behind it', () => {
  const table = buildCashFlowTable(GENERAL_STATEMENTS, 'general');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202403, 202503, 202603]);
  assert.deepEqual(
    rows.map(r => r.id),
    ['cfo', 'cfi', 'cff', 'net', 'cfo_op'],
  );
  assert.deepEqual(valuesOf(rows, 'cfo'), [150, 190, 210]);
  // The parts add up to operating cash, so no balancing line is offered.
  assert.deepEqual(childIds(rows, 'cfo'), ['cfo_profit', 'cfo_wc', 'cfo_tax']);
  assert.deepEqual(childValues(rows, 'cfo', 'cfo_profit'), [178, 234, 260]);
  assert.deepEqual(childValues(rows, 'cfo', 'cfo_wc'), [4, -3, -6]);
  assert.deepEqual(childValues(rows, 'cfo', 'cfo_tax'), [-32, -41, -44]);
  assert.deepEqual(valuesOf(rows, 'cfi'), [-90, -137, -135]);
  assert.deepEqual(valuesOf(rows, 'cff'), [-30, -16, -22]);
  assert.deepEqual(valuesOf(rows, 'net'), [30, 37, 53]);
  // Operating cash over the profit & loss table's operating profit.
  assert.deepEqual(valuesOf(rows, 'cfo_op'), round([100, pct(190, 180), 105]));
});

test('profit from operations falls back to cash after working capital, and a gap shows as other items', () => {
  const table = buildCashFlowTable(
    {
      ...GENERAL_STATEMENTS,
      cash_flow: series([202603], {
        Cashflow_after_WC: [254],
        Change_WC_total: [-6],
        Tax_paid: [-44],
        Cash_from_Operation: [215],
      }),
    },
    'general',
  );
  assert.ok(table);
  assert.deepEqual(childValues(table.rows, 'cfo', 'cfo_profit'), [260]);
  assert.deepEqual(childValues(table.rows, 'cfo', 'cfo_other'), [5]);
});

test('CFO/OP is left out when the cash flow was filed on the other basis', () => {
  const table = buildCashFlowTable(
    {...GENERAL_STATEMENTS, cash_flow_basis: 'S'},
    'general',
  );
  assert.ok(table);
  assert.ok(!table.rows.some(r => r.id === 'cfo_op'));
  const withoutProfitLoss = buildCashFlowTable(
    {basis: 'C', basis_available: ['C'], cash_flow: GENERAL_CF},
    'general',
  );
  assert.ok(withoutProfitLoss);
  assert.ok(!withoutProfitLoss.rows.some(r => r.id === 'cfo_op'));
});

test('nothing to lay out without a cash flow', () => {
  assert.equal(buildCashFlowTable(undefined, 'general'), null);
  assert.equal(
    buildCashFlowTable(
      {basis: 'C', basis_available: ['C'], profit_loss: GENERAL_PL},
      'general',
    ),
    null,
  );
  assert.equal(
    buildCashFlowTable(
      {...GENERAL_STATEMENTS, cash_flow: series([], {})},
      'general',
    ),
    null,
  );
});
