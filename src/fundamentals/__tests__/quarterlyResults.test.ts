import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildQuarterTable} from '../quarterlyResults.ts';
import {childIds, childValues, round, series, valuesOf} from './filings.ts';

// Four quarters of a manufacturer, newest first. `Expenditure` carries interest
// and depreciation, `Exception_Items` is positive for a loss, and a 1:1 bonus
// in the December quarter halves the as-filed EPS while the adjusted one runs on.
const ITEMS = {
  Net_Sales: [250, 240, 230, 220],
  Gross_Sale: [255, 245, 235, 225],
  Excise_Duty: [5, 5, 5, 5],
  Expenditure: [215, 208, 200, 195],
  Raw_Material_Cost: [100, 96, 92, 88],
  PURCHASE_FIN_GOOD: [20, 19, 18, 17],
  Inc_Dec_Inventory: [-2, 1, 0, -1],
  Exployee_Cost: [25, 24, 23, 22],
  Electricity_Power_Fuel: [8, 8, 7, 7],
  Mfg_Exps: [5, 5, 5, 5],
  Job_Works: [1, 1, 1, 1],
  Interest: [5, 5, 4, 4],
  Depreciation: [10, 10, 9, 9],
  Other_Income: [6, 5, 4, 3],
  Exception_Items: [0, 2, 0, 0],
  Tax: [10, 9, 8, 7],
  Pat: [31, 26, 26, 21],
  NetProfit_OwnOfParent: [28, 24, 24, 19],
  NetProfit_NonContInt: [3, 2, 2, 2],
  Adj_eps_abs: [3.1, 2.6, 2.6, 2.1],
  eps_basic: [3.1, 2.6, 5.2, 4.2],
};
const QUARTERS = [202606, 202603, 202512, 202509];

const pct = (part: number, whole: number): number => (part / whole) * 100;

test("the quarterly results read Screener's way, oldest quarter first", () => {
  const table = buildQuarterTable(series(QUARTERS, ITEMS), 'general');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202509, 202512, 202603, 202606]);
  assert.deepEqual(table.chartable, [
    'sales',
    'operating_profit',
    'net_profit',
    'opm',
    'eps',
  ]);
  assert.deepEqual(
    rows.map(r => r.id),
    [
      'sales',
      'expenses',
      'operating_profit',
      'opm',
      'other_income',
      'interest',
      'depreciation',
      'pbt',
      'tax_pct',
      'net_profit',
      'eps',
    ],
  );

  assert.deepEqual(valuesOf(rows, 'sales'), [220, 230, 240, 250]);
  assert.deepEqual(
    childValues(rows, 'sales', 'gross_sales'),
    [225, 235, 245, 255],
  );
  assert.deepEqual(childValues(rows, 'sales', 'excise'), [-5, -5, -5, -5]);
  // Expenditure less the interest and depreciation it already carries.
  assert.deepEqual(valuesOf(rows, 'expenses'), [182, 187, 193, 200]);
  assert.deepEqual(valuesOf(rows, 'operating_profit'), [38, 43, 47, 50]);
  assert.deepEqual(
    valuesOf(rows, 'opm'),
    round([pct(38, 220), pct(43, 230), pct(47, 240), pct(50, 250)]),
  );
  assert.deepEqual(
    childValues(rows, 'expenses', 'material_pct'),
    round([pct(104, 220), pct(110, 230), pct(116, 240), pct(118, 250)]),
  );
  assert.deepEqual(
    childValues(rows, 'expenses', 'employee_pct'),
    [10, 10, 10, 10],
  );
  assert.deepEqual(
    childValues(rows, 'expenses', 'manufacturing_pct'),
    round([pct(13, 220), pct(13, 230), pct(14, 240), pct(14, 250)]),
  );
  assert.deepEqual(
    childValues(rows, 'expenses', 'other_cost_pct'),
    round([pct(43, 220), pct(41, 230), pct(39, 240), pct(43, 250)]),
  );

  // The March quarter's exceptional loss comes out of other income.
  assert.deepEqual(valuesOf(rows, 'other_income'), [3, 4, 3, 6]);
  assert.deepEqual(childValues(rows, 'other_income', 'oi_filed'), [3, 4, 5, 6]);
  assert.deepEqual(childValues(rows, 'other_income', 'exceptional'), [
    null,
    null,
    -2,
    null,
  ]);
  assert.deepEqual(valuesOf(rows, 'interest'), [4, 4, 5, 5]);
  assert.deepEqual(valuesOf(rows, 'depreciation'), [9, 9, 10, 10]);
  // Profit before tax adds up to the vendor's own identity: sales less
  // expenditure, plus other income, less the exceptional loss.
  assert.deepEqual(valuesOf(rows, 'pbt'), [28, 34, 35, 41]);
  assert.deepEqual(
    valuesOf(rows, 'tax_pct'),
    round([pct(7, 28), pct(8, 34), pct(9, 35), pct(10, 41)]),
  );

  assert.deepEqual(valuesOf(rows, 'net_profit'), [21, 26, 26, 31]);
  assert.deepEqual(childIds(rows, 'net_profit'), ['np_owners', 'np_minority']);
  assert.deepEqual(
    childValues(rows, 'net_profit', 'np_minority'),
    [2, 2, 2, 3],
  );
});

test('EPS is the adjusted figure, so a bonus does not read as a collapse', () => {
  const table = buildQuarterTable(series(QUARTERS, ITEMS), 'general');
  assert.ok(table);
  assert.deepEqual(valuesOf(table.rows, 'eps'), [2.1, 2.6, 2.6, 3.1]);
  assert.equal(table.rows.find(r => r.id === 'eps')?.kind, 'rupees');
});

test('an unfiled line stays unfiled rather than reading as zero', () => {
  const table = buildQuarterTable(
    series(QUARTERS, {
      ...ITEMS,
      Interest: [5, null, 4, 4],
      Exception_Items: [0, 2, null, 0],
    }),
    'general',
  );
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(valuesOf(rows, 'expenses'), [182, 187, null, 200]);
  assert.deepEqual(valuesOf(rows, 'operating_profit'), [38, 43, null, 50]);
  assert.deepEqual(valuesOf(rows, 'opm').slice(2, 3), [null]);
  assert.deepEqual(valuesOf(rows, 'other_income'), [3, null, 3, 6]);
  assert.deepEqual(valuesOf(rows, 'pbt'), [28, null, null, 41]);
  assert.deepEqual(valuesOf(rows, 'tax_pct').slice(1, 3), [null, null]);
});

test('tax on a pre-tax loss is a percentage worth showing', () => {
  const table = buildQuarterTable(
    series(QUARTERS, {
      ...ITEMS,
      Exception_Items: [60, 2, 0, 0],
      Tax: [-2, 9, 8, 7],
      Pat: [-17, 26, 26, 21],
    }),
    'general',
  );
  assert.ok(table);
  assert.equal(valuesOf(table.rows, 'pbt')[3], -19);
  assert.deepEqual(
    valuesOf(table.rows, 'tax_pct')[3],
    round([pct(-2, -19)])[0],
  );
});

test('nothing to lay out without periods or sales', () => {
  assert.equal(buildQuarterTable(undefined, 'general'), null);
  assert.equal(buildQuarterTable(series([], {}), 'general'), null);
  assert.equal(
    buildQuarterTable(
      series(QUARTERS, {...ITEMS, Net_Sales: [0, 0, 0, 0]}),
      'general',
    ),
    null,
  );
});

test("a bank's quarter leads with interest earned and reads financing profit", () => {
  const table = buildQuarterTable(
    series([202606, 202603], {
      Net_Sales: [1000, 950],
      Int_Adv: [700, 660],
      Inc_Inv: [250, 240],
      Int_Bal: [30, 30],
      Int_Others: [20, 20],
      Interest: [500, 480],
      Expenditure: [800, 760],
      Depreciation: [20, 20],
      Exployee_Cost: [100, 95],
      Operating_Ex: [180, 165],
      Other_Income: [150, 140],
      Exception_Items: [0, 0],
      Tax: [90, 85],
      Pat: [260, 245],
      Adj_eps_abs: [5.2, 4.9],
      NPA_Gross_perc: [2.1, 2.3],
      NPA_Net_perc: [0.5, 0.6],
    }),
    'bank',
  );
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202603, 202606]);
  assert.deepEqual(table.chartable, [
    'revenue',
    'financing_profit',
    'net_profit',
    'gross_npa',
  ]);
  assert.deepEqual(
    rows.map(r => r.id),
    [
      'revenue',
      'interest',
      'expenses',
      'financing_profit',
      'financing_margin',
      'other_income',
      'depreciation',
      'pbt',
      'tax_pct',
      'net_profit',
      'eps',
      'gross_npa',
      'net_npa',
    ],
  );
  assert.deepEqual(childIds(rows, 'revenue'), [
    'rev_advances',
    'rev_investments',
    'rev_rbi',
    'rev_other',
  ]);
  assert.deepEqual(valuesOf(rows, 'expenses'), [260, 280]);
  assert.deepEqual(valuesOf(rows, 'financing_profit'), [210, 220]);
  assert.deepEqual(
    valuesOf(rows, 'financing_margin'),
    round([pct(210, 950), pct(220, 1000)]),
  );
  // No exceptional item was filed, so other income has only what was filed.
  assert.deepEqual(childIds(rows, 'other_income'), ['oi_filed']);
  assert.deepEqual(valuesOf(rows, 'pbt'), [330, 350]);
  assert.deepEqual(valuesOf(rows, 'eps'), [4.9, 5.2]);
  assert.deepEqual(valuesOf(rows, 'gross_npa'), [2.3, 2.1]);
});
