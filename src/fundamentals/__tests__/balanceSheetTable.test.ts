import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildBalanceSheetTable} from '../balanceSheetTable.ts';
import type {StatementRow} from '../statementRows.ts';
import {
  childIds,
  childValues,
  GENERAL_BS,
  series,
  valuesOf,
} from './filings.ts';

/** Sums the given lines column by column. */
const columnSum = (rows: StatementRow[], ids: string[]): number[] => {
  const columns = ids.map(id => valuesOf(rows, id));
  const width = columns[0]?.length ?? 0;
  return Array.from({length: width}, (_, i) =>
    columns.reduce((total, values) => total + (values[i] ?? 0), 0),
  );
};

const LIABILITIES = ['equity', 'reserves', 'borrowings', 'other_liabilities'];
const ASSETS = ['fixed_assets', 'cwip', 'investments', 'other_assets'];

test("the balance sheet reads Screener's way, and both sides add up to the total", () => {
  const table = buildBalanceSheetTable(GENERAL_BS, 'general');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202403, 202503, 202603]);
  assert.deepEqual(
    rows.map(r => r.id),
    [...LIABILITIES, 'total_liabilities', ...ASSETS, 'total_assets'],
  );

  assert.deepEqual(valuesOf(rows, 'equity'), [50, 50, 50]);
  // Net worth less equity, not the vendor's narrower Reserve line.
  assert.deepEqual(valuesOf(rows, 'reserves'), [350, 400, 450]);
  assert.deepEqual(valuesOf(rows, 'borrowings'), [160, 180, 200]);
  assert.deepEqual(childValues(rows, 'borrowings', 'b_long'), [130, 140, 150]);
  assert.deepEqual(childValues(rows, 'borrowings', 'b_short'), [30, 40, 50]);
  assert.deepEqual(valuesOf(rows, 'other_liabilities'), [240, 270, 300]);
  assert.deepEqual(childIds(rows, 'other_liabilities'), [
    'ol_minority',
    'ol_payables',
    'ol_advances',
    'ol_other',
  ]);
  assert.deepEqual(
    childValues(rows, 'other_liabilities', 'ol_other'),
    [130, 140, 150],
  );

  assert.deepEqual(valuesOf(rows, 'fixed_assets'), [360, 380, 400]);
  assert.deepEqual(childIds(rows, 'fixed_assets'), ['gross_block', 'acc_dep']);
  // Long-term plus current, an unfiled current holding read as none.
  assert.deepEqual(valuesOf(rows, 'investments'), [80, 100, 120]);
  assert.deepEqual(valuesOf(rows, 'other_assets'), [330, 380, 430]);
  assert.deepEqual(childIds(rows, 'other_assets'), [
    'oa_inventory',
    'oa_receivables',
    'oa_cash',
    'oa_loans',
    'oa_other',
  ]);
  assert.deepEqual(
    childValues(rows, 'other_assets', 'oa_other'),
    [80, 90, 100],
  );

  assert.deepEqual(valuesOf(rows, 'total_liabilities'), [800, 900, 1000]);
  assert.deepEqual(valuesOf(rows, 'total_assets'), [800, 900, 1000]);
  assert.deepEqual(columnSum(rows, LIABILITIES), [800, 900, 1000]);
  assert.deepEqual(columnSum(rows, ASSETS), [800, 900, 1000]);
});

test('reserves fall back to the filed line when net worth is missing', () => {
  const items = Object.fromEntries(
    Object.entries(GENERAL_BS.items).filter(
      ([key]) => key !== 'Sharehoders_funds',
    ),
  );
  const table = buildBalanceSheetTable(
    series(GENERAL_BS.periods, items),
    'general',
  );
  assert.ok(table);
  assert.deepEqual(valuesOf(table.rows, 'reserves'), [345, 395, 440]);
});

test('a year with nothing filed is dropped, and no total means no table', () => {
  const table = buildBalanceSheetTable(
    series([...GENERAL_BS.periods, 202303], GENERAL_BS.items),
    'general',
  );
  assert.deepEqual(table?.periods, [202403, 202503, 202603]);
  assert.equal(buildBalanceSheetTable(undefined, 'general'), null);
  assert.equal(
    buildBalanceSheetTable(
      series([202603], {Share_Capital: [50], Total_Applications_Nf: [null]}),
      'general',
    ),
    null,
  );
});

test("a bank's balance sheet reads deposits and opens its loan book under other assets", () => {
  const table = buildBalanceSheetTable(
    series([202603, 202503], {
      Total_Applications_Nf: [2000, 1800],
      Sharehoders_funds: [200, 180],
      Share_Capital: [10, 10],
      Deposits: [1500, 1350],
      Borrowings: [150, 140],
      Minority_Interest: [5, 4],
      Net_Block: [30, 28],
      CWIP: [2, 2],
      Investments: [500, 450],
      Advances: [1300, 1170],
      Cash_balances_RBI: [80, 70],
      Bank_Call_money: [60, 55],
    }),
    'bank',
  );
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(
    rows.map(r => r.id),
    [
      'equity',
      'reserves',
      'deposits',
      'borrowings',
      'other_liabilities',
      'total_liabilities',
      'fixed_assets',
      'cwip',
      'investments',
      'other_assets',
      'total_assets',
    ],
  );
  assert.equal(rows.find(r => r.id === 'borrowings')?.label, 'Borrowing');
  assert.deepEqual(valuesOf(rows, 'reserves'), [170, 190]);
  assert.deepEqual(valuesOf(rows, 'other_liabilities'), [130, 150]);
  assert.deepEqual(
    childValues(rows, 'other_liabilities', 'ol_minority'),
    [4, 5],
  );
  assert.deepEqual(
    childValues(rows, 'other_liabilities', 'ol_other'),
    [126, 145],
  );
  assert.deepEqual(valuesOf(rows, 'other_assets'), [1320, 1468]);
  assert.deepEqual(
    childValues(rows, 'other_assets', 'oa_advances'),
    [1170, 1300],
  );
  assert.deepEqual(childValues(rows, 'other_assets', 'oa_other'), [25, 28]);
  assert.deepEqual(
    columnSum(rows, [
      'equity',
      'reserves',
      'deposits',
      'borrowings',
      'other_liabilities',
    ]),
    [1800, 2000],
  );
  assert.deepEqual(columnSum(rows, ASSETS), [1800, 2000]);
});
