import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildRatiosTable} from '../ratiosTable.ts';
import {
  GENERAL_PL,
  GENERAL_STATEMENTS,
  round,
  series,
  valuesOf,
} from './filings.ts';

const days = (part: number, whole: number): number => (part / whole) * 365;

test('the ratios read days off sales and material cost, and ROCE off capital employed', () => {
  const table = buildRatiosTable(GENERAL_STATEMENTS, 'general');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202403, 202503, 202603]);
  assert.deepEqual(
    rows.map(r => r.id),
    ['debtor_days', 'inventory_days', 'payable_days', 'ccc', 'wc_days', 'roce'],
  );
  // Material cost is raw material plus the change in stock: 400, 455, 490.
  const debtor = [days(60, 800), days(70, 900), days(80, 1000)];
  const inventory = [days(130, 400), days(140, 455), days(150, 490)];
  const payable = [days(80, 400), days(90, 455), days(100, 490)];
  assert.deepEqual(valuesOf(rows, 'debtor_days'), round(debtor));
  assert.deepEqual(valuesOf(rows, 'inventory_days'), round(inventory));
  assert.deepEqual(valuesOf(rows, 'payable_days'), round(payable));
  assert.deepEqual(
    valuesOf(rows, 'ccc'),
    round(debtor.map((d, i) => d + (inventory[i] ?? 0) - (payable[i] ?? 0))),
  );
  // Current assets less cash, current investments and current liabilities.
  assert.deepEqual(
    valuesOf(rows, 'wc_days'),
    round([days(120, 800), days(130, 900), days(140, 1000)]),
  );
  // Profit before interest and tax over net worth, minority and borrowings.
  assert.deepEqual(
    valuesOf(rows, 'roce'),
    round([(154 / 580) * 100, (202 / 655) * 100, (220 / 730) * 100]),
  );
  assert.equal(rows.find(r => r.id === 'ccc')?.kind, 'days');
});

test('a company with no material cost cycles on its debtor days alone', () => {
  const items = Object.fromEntries(
    Object.entries(GENERAL_PL.items).filter(
      ([key]) => key !== 'Raw_matrs_consumed',
    ),
  );
  const table = buildRatiosTable(
    {
      ...GENERAL_STATEMENTS,
      profit_loss: series(GENERAL_PL.periods, items),
    },
    'general',
  );
  assert.ok(table);
  const ids = table.rows.map(r => r.id);
  assert.ok(!ids.includes('inventory_days'));
  assert.ok(!ids.includes('payable_days'));
  assert.deepEqual(
    valuesOf(table.rows, 'ccc'),
    valuesOf(table.rows, 'debtor_days'),
  );
});

test('a year only the balance sheet filed drops out of the ratios', () => {
  const table = buildRatiosTable(
    {
      ...GENERAL_STATEMENTS,
      profit_loss: series([202603, 202503], {
        Net_sales: [1000, 900],
        Raw_matrs_consumed: [500, 450],
      }),
    },
    'general',
  );
  assert.ok(table);
  assert.deepEqual(table.periods, [202503, 202603]);
  assert.deepEqual(
    valuesOf(table.rows, 'debtor_days'),
    round([days(70, 900), days(80, 1000)]),
  );
  assert.deepEqual(
    valuesOf(table.rows, 'inventory_days'),
    round([days(140, 450), days(150, 500)]),
  );
  // No profit before tax on file, so no return on capital to work out.
  assert.ok(!table.rows.some(r => r.id === 'roce'));
});

test('a bank reads return on equity alone', () => {
  const table = buildRatiosTable(GENERAL_STATEMENTS, 'bank');
  assert.ok(table);
  assert.deepEqual(table.rows, [
    {
      id: 'roe',
      label: 'ROE %',
      kind: 'pct',
      values: [12, 14, 15],
      strong: true,
    },
  ]);
});

test('nothing to lay out without a balance sheet', () => {
  assert.equal(buildRatiosTable(undefined, 'general'), null);
  assert.equal(
    buildRatiosTable(
      {basis: 'C', basis_available: ['C'], profit_loss: GENERAL_PL},
      'general',
    ),
    null,
  );
  assert.equal(
    buildRatiosTable(
      {...GENERAL_STATEMENTS, balance_sheet: series([], {})},
      'general',
    ),
    null,
  );
});
