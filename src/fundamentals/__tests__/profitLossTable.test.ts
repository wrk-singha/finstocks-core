import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  averageOf,
  buildProfitLossTable,
  cagr,
  materialCost,
  priceCagr,
} from '../profitLossTable.ts';
import type {QuarterTable} from '../quarterlyResults.ts';
import {row, type Col} from '../statementRows.ts';
import {
  childIds,
  childValues,
  GENERAL_PL,
  GENERAL_RATIOS,
  round,
  rowOf,
  series,
  valuesOf,
} from './filings.ts';

const pct = (part: number, whole: number): number => (part / whole) * 100;

test("the profit & loss reads Screener's way, oldest year first", () => {
  const table = buildProfitLossTable(GENERAL_PL, GENERAL_RATIOS, 'general');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(table.periods, [202403, 202503, 202603]);
  assert.equal(table.ttm, false);
  assert.ok(!('ttmPair' in table));
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
      'payout',
    ],
  );

  assert.deepEqual(valuesOf(rows, 'sales'), [800, 900, 1000]);
  assert.deepEqual(
    childValues(rows, 'sales', 'sales_growth'),
    round([null, 12.5, pct(100, 900)]),
  );
  assert.deepEqual(valuesOf(rows, 'expenses'), [650, 720, 800]);
  assert.deepEqual(childIds(rows, 'expenses'), [
    'material_pct',
    'manufacturing_pct',
    'employee_pct',
    'other_cost_pct',
  ]);
  // Raw material already carries purchases of finished goods; the change in
  // inventory is added, and an unfiled change reads as none.
  assert.deepEqual(
    childValues(rows, 'expenses', 'material_pct'),
    round([50, pct(455, 900), 49]),
  );
  assert.deepEqual(
    childValues(rows, 'expenses', 'manufacturing_pct'),
    [6, 6, 6],
  );
  assert.deepEqual(childValues(rows, 'expenses', 'employee_pct'), [10, 10, 10]);
  assert.deepEqual(
    childValues(rows, 'expenses', 'other_cost_pct'),
    round([pct(122, 800), pct(121, 900), 15]),
  );
  assert.deepEqual(valuesOf(rows, 'operating_profit'), [150, 180, 200]);
  assert.deepEqual(valuesOf(rows, 'opm'), [18.75, 20, 20]);

  // Other income is the balancing line, so FY25's exceptional gain lands in it
  // and the column adds up to the profit before tax that was filed.
  assert.deepEqual(valuesOf(rows, 'other_income'), [30, 50, 50]);
  assert.deepEqual(childValues(rows, 'other_income', 'oi_filed'), [30, 40, 50]);
  assert.deepEqual(
    childValues(rows, 'other_income', 'exceptional'),
    [0, 10, 0],
  );
  assert.deepEqual(valuesOf(rows, 'pbt'), [138, 184, 200]);
  assert.deepEqual(valuesOf(rows, 'tax_pct'), round([pct(34, 138), 25, 25]));

  // The group's profit before minority interest, which is filed negative.
  assert.deepEqual(valuesOf(rows, 'net_profit'), [107, 142, 155]);
  assert.deepEqual(
    childValues(rows, 'net_profit', 'np_owners'),
    [101, 134, 145],
  );
  assert.deepEqual(childValues(rows, 'net_profit', 'np_minority'), [6, 8, 10]);
  assert.deepEqual(childValues(rows, 'net_profit', 'np_associates'), [3, 4, 5]);
  // Adjusted EPS, not the as-filed one the bonus halved.
  assert.deepEqual(valuesOf(rows, 'eps'), [10.1, 13.4, 14.5]);
  assert.equal(rowOf(rows, 'eps').kind, 'rupees');
  assert.deepEqual(valuesOf(rows, 'payout'), [15, 18, 20]);

  assert.deepEqual(table.annual, {
    sales: [800, 900, 1000],
    netProfit: [107, 142, 155],
    roe: [12, 14, 15],
  });
});

test('interest and depreciation filed inside total expenditure are not counted twice', () => {
  const table = buildProfitLossTable(
    series([202603], {
      Net_sales: [1000],
      Total_income: [1050],
      Total_expendiure: [850],
      Interest: [20],
      Depreciation: [30],
      Profit_before_tax: [200],
    }),
    undefined,
    'general',
  );
  assert.ok(table);
  assert.deepEqual(valuesOf(table.rows, 'expenses'), [800]);
  assert.deepEqual(valuesOf(table.rows, 'operating_profit'), [200]);
  assert.deepEqual(valuesOf(table.rows, 'other_income'), [50]);
});

test('without a filed profit before tax it is worked out, and a standalone net profit adds associates', () => {
  const table = buildProfitLossTable(
    series([202603], {
      Net_sales: [1000],
      Total_income: [1050],
      Total_expendiure: [800],
      Interest: [20],
      Depreciation: [30],
      ExceptionalIncome_Expenses: [15],
      Profit_after_tax: [150],
      Share_Associate: [5],
    }),
    undefined,
    'general',
  );
  assert.ok(table);
  assert.deepEqual(valuesOf(table.rows, 'other_income'), [65]);
  assert.deepEqual(valuesOf(table.rows, 'pbt'), [215]);
  assert.deepEqual(valuesOf(table.rows, 'net_profit'), [155]);
  // No minority filed: only the associates open under net profit.
  assert.deepEqual(childIds(table.rows, 'net_profit'), ['np_associates']);
});

test('a lender has no factory, so no material or manufacturing split', () => {
  const table = buildProfitLossTable(GENERAL_PL, GENERAL_RATIOS, 'lender');
  assert.ok(table);
  assert.deepEqual(childIds(table.rows, 'expenses'), [
    'employee_pct',
    'other_cost_pct',
  ]);
});

const BANK_PL = series([202603, 202503], {
  Interest_earned: [1000, 900],
  Interest_advances_Bills: [700, 630],
  Interest_investment: [250, 220],
  Other_interest_income: [50, 50],
  Total_income: [1150, 1030],
  Interest: [500, 450],
  // A bank's expenditure carries interest expended and provisions.
  Total_expendiure: [800, 720],
  Operating_expenses: [220, 200],
  Profit_before_tax: [350, 310],
  Taxation: [90, 80],
  Profit_after_tax: [260, 230],
  Adj_Eps: [26, 23],
});

test("a bank's year reads interest earned, financing profit and provisions", () => {
  const table = buildProfitLossTable(BANK_PL, undefined, 'bank');
  assert.ok(table);
  const {rows} = table;
  assert.deepEqual(
    rows.map(r => r.id),
    [
      'revenue',
      'interest',
      'expenses',
      'financing_profit',
      'financing_margin',
      'other_income',
      'pbt',
      'tax_pct',
      'net_profit',
      'eps',
    ],
  );
  assert.deepEqual(valuesOf(rows, 'revenue'), [900, 1000]);
  assert.deepEqual(childIds(rows, 'revenue'), [
    'rev_growth',
    'rev_advances',
    'rev_investments',
    'rev_other',
  ]);
  assert.deepEqual(valuesOf(rows, 'expenses'), [270, 300]);
  assert.deepEqual(childValues(rows, 'expenses', 'exp_operating'), [200, 220]);
  assert.deepEqual(childValues(rows, 'expenses', 'exp_provisions'), [70, 80]);
  assert.deepEqual(valuesOf(rows, 'financing_profit'), [180, 200]);
  assert.deepEqual(valuesOf(rows, 'financing_margin'), [20, 20]);
  assert.deepEqual(valuesOf(rows, 'other_income'), [130, 150]);
  assert.deepEqual(valuesOf(rows, 'pbt'), [310, 350]);
  assert.deepEqual(valuesOf(rows, 'net_profit'), [230, 260]);
  assert.equal(rowOf(rows, 'net_profit').children, undefined);
  assert.deepEqual(table.annual.sales, [900, 1000]);
});

test('a bank that files net sales in place of interest earned still leads with it', () => {
  const items = Object.fromEntries(
    Object.entries(BANK_PL.items).filter(([key]) => key !== 'Interest_earned'),
  );
  const table = buildProfitLossTable(
    series(BANK_PL.periods, {...items, Net_sales: [1000, 900]}),
    undefined,
    'bank',
  );
  assert.ok(table);
  assert.deepEqual(valuesOf(table.rows, 'revenue'), [900, 1000]);
  assert.deepEqual(valuesOf(table.rows, 'financing_profit'), [180, 200]);
});

const quarterTable = (
  periods: number[],
  rows: Record<string, Col>,
): QuarterTable => ({
  periods,
  chartable: [],
  rows: Object.entries(rows).map(([id, values]) => row(id, id, values)),
});

const EIGHT_QUARTERS = [
  202409, 202412, 202503, 202506, 202509, 202512, 202603, 202606,
];

const GENERAL_QUARTERS = quarterTable(EIGHT_QUARTERS, {
  sales: [200, 210, 220, 230, 240, 250, 260, 270],
  expenses: [160, 168, 176, 184, 192, 200, 208, 216],
  operating_profit: [40, 42, 44, 46, 48, 50, 52, 54],
  other_income: [5, 5, 5, 5, 6, 6, 6, 6],
  interest: [4, 4, 4, 4, 5, 5, 5, 5],
  depreciation: [7, 7, 7, 7, 8, 8, 8, 8],
  pbt: [34, 36, 38, 40, 41, 43, 45, 47],
  net_profit: [26, 27, 29, 30, 31, 33, 34, 36],
  eps: [2.6, 2.7, 2.9, 3.0, 3.1, 3.3, 3.4, 3.6],
});

test('the trailing twelve months is the last four quarters, after the last year', () => {
  const table = buildProfitLossTable(
    GENERAL_PL,
    GENERAL_RATIOS,
    'general',
    GENERAL_QUARTERS,
  );
  assert.ok(table);
  const {rows} = table;
  assert.equal(table.ttm, true);
  assert.deepEqual(table.periods, [202403, 202503, 202603]);
  const trailingOf = (id: string): number | null | undefined =>
    valuesOf(rows, id)[3];
  assert.equal(trailingOf('sales'), 1020);
  assert.equal(trailingOf('expenses'), 816);
  assert.equal(trailingOf('operating_profit'), 204);
  assert.equal(trailingOf('opm'), 20);
  assert.equal(trailingOf('other_income'), 24);
  assert.equal(trailingOf('interest'), 20);
  assert.equal(trailingOf('depreciation'), 32);
  assert.equal(trailingOf('pbt'), 176);
  assert.equal(trailingOf('net_profit'), 134);
  assert.equal(trailingOf('eps'), 13.4);
  // Nothing to sum for these, so the column is empty rather than invented.
  assert.equal(trailingOf('tax_pct'), null);
  assert.equal(trailingOf('payout'), null);
  // Every line keeps one value per column, the "+" lines included.
  for (const r of rows) {
    assert.equal(r.values.length, 4);
    for (const c of r.children ?? []) assert.equal(c.values.length, 4);
  }
  assert.deepEqual(childValues(rows, 'sales', 'sales_growth')[3], null);
  // The growth cards read the years alone.
  assert.deepEqual(table.annual.sales, [800, 900, 1000]);
  assert.deepEqual(table.ttmPair, {sales: [1020, 860], netProfit: [134, 112]});
});

test('no trailing column unless four running quarters reach past the last year', () => {
  const upToYearEnd = quarterTable([202506, 202509, 202512, 202603], {
    sales: [230, 240, 250, 260],
  });
  const withGap = quarterTable([202509, 202512, 202606, 202609], {
    sales: [240, 250, 270, 280],
  });
  const three = quarterTable([202512, 202603, 202606], {
    sales: [250, 260, 270],
  });
  for (const quarters of [upToYearEnd, withGap, three, null, undefined]) {
    const table = buildProfitLossTable(
      GENERAL_PL,
      GENERAL_RATIOS,
      'general',
      quarters,
    );
    assert.ok(table);
    assert.equal(table.ttm, false);
    assert.equal(valuesOf(table.rows, 'sales').length, 3);
    assert.equal(table.ttmPair, undefined);
  }

  // Four running quarters make the column; the growth pair needs eight.
  const four = quarterTable([202509, 202512, 202603, 202606], {
    sales: [240, 250, 260, 270],
  });
  const table = buildProfitLossTable(
    GENERAL_PL,
    GENERAL_RATIOS,
    'general',
    four,
  );
  assert.ok(table);
  assert.equal(table.ttm, true);
  assert.equal(valuesOf(table.rows, 'sales')[3], 1020);
  assert.deepEqual(table.ttmPair, {sales: null, netProfit: null});
});

test("a bank's trailing column moves depreciation onto the annual layout", () => {
  const quarters = quarterTable([202509, 202512, 202603, 202606], {
    revenue: [240, 250, 260, 270],
    interest: [120, 125, 130, 135],
    expenses: [70, 72, 74, 76],
    depreciation: [5, 5, 5, 5],
    financing_profit: [50, 53, 56, 59],
    other_income: [30, 30, 30, 30],
    pbt: [75, 78, 81, 84],
    net_profit: [56, 58, 60, 62],
    eps: [5.6, 5.8, 6.0, 6.2],
  });
  const table = buildProfitLossTable(BANK_PL, undefined, 'bank', quarters);
  assert.ok(table);
  const trailingOf = (id: string): number | null | undefined =>
    valuesOf(table.rows, id)[2];
  assert.equal(trailingOf('revenue'), 1020);
  assert.equal(trailingOf('interest'), 510);
  assert.equal(trailingOf('expenses'), 312);
  assert.equal(trailingOf('financing_profit'), 198);
  assert.equal(trailingOf('financing_margin'), round([pct(198, 1020)])[0]);
  assert.equal(trailingOf('other_income'), 120);
  assert.equal(trailingOf('pbt'), 318);
  assert.equal(trailingOf('net_profit'), 236);
  assert.equal(trailingOf('eps'), 23.6);
  assert.deepEqual(table.ttmPair, {sales: null, netProfit: null});
});

test('nothing to lay out without a profit & loss', () => {
  assert.equal(buildProfitLossTable(undefined, undefined, 'general'), null);
  assert.equal(
    buildProfitLossTable(series([], {}), undefined, 'general'),
    null,
  );
});

test('materialCost is raw material plus the change in stock', () => {
  const filing: Record<string, Col> = {
    Raw_matrs_consumed: [400, null, 500],
    Inc_Dec_Inventory: [null, 5, -10],
  };
  const col = (key: string): Col => filing[key] ?? [];
  assert.deepEqual(materialCost(col), [400, null, 490]);
});

test('cagr compounds from `years` before the last value to it', () => {
  assert.deepEqual(round([cagr([100, 110, 121], 2)]), [10]);
  assert.deepEqual(round([cagr([null, 100, 121], 1)]), [21]);
  assert.equal(cagr([100, 121], 2), null);
  assert.equal(cagr([0, 121], 1), null);
  assert.equal(cagr([-50, 121], 1), null);
  assert.equal(cagr([100, -5], 1), null);
  assert.equal(cagr([100, null], 1), null);
});

test('averageOf averages the last `years` values only when each was filed', () => {
  assert.equal(averageOf([10, 12, 14, 16], 3), 14);
  assert.equal(averageOf([10, null, 14, 16], 2), 15);
  assert.equal(averageOf([10, null, 14, 16], 3), null);
  assert.equal(averageOf([10], 3), null);
});

test('priceCagr reads the close on or just before the date `years` back', () => {
  const prices = [
    {time: '2016-06-30T15:30:00+05:30', close: 100},
    {time: '2021-06-30T15:30:00+05:30', close: 200},
    {time: '2025-06-30T15:30:00+05:30', close: 350},
    {time: '2026-06-30T15:30:00+05:30', close: 400},
  ];
  const growth = (ratio: number, years: number): number =>
    (Math.pow(ratio, 1 / years) - 1) * 100;
  assert.deepEqual(
    round([priceCagr(prices, 1)]),
    round([growth(400 / 350, 1)]),
  );
  // Three years back falls between two closes; the earlier one answers.
  assert.deepEqual(round([priceCagr(prices, 3)]), round([growth(2, 3)]));
  assert.deepEqual(round([priceCagr(prices, 5)]), round([growth(2, 5)]));
  assert.deepEqual(round([priceCagr(prices, 10)]), round([growth(4, 10)]));
  // A history that starts well after the date cannot answer for the span.
  assert.equal(priceCagr(prices, 20), null);
});

test('priceCagr allows a week of slack before the first close, and needs real prices', () => {
  const late = [
    {time: '2021-07-05T15:30:00+05:30', close: 200},
    {time: '2026-06-30T15:30:00+05:30', close: 400},
  ];
  assert.deepEqual(
    round([priceCagr(late, 5)]),
    round([(Math.pow(2, 1 / 5) - 1) * 100]),
  );
  assert.equal(
    priceCagr(
      [
        {time: '2021-07-20T15:30:00+05:30', close: 200},
        {time: '2026-06-30T15:30:00+05:30', close: 400},
      ],
      5,
    ),
    null,
  );
  assert.equal(
    priceCagr(
      [
        {time: '2021-06-30T15:30:00+05:30', close: 0},
        {time: '2026-06-30T15:30:00+05:30', close: 400},
      ],
      5,
    ),
    null,
  );
  assert.equal(
    priceCagr([{time: '2026-06-30T15:30:00+05:30', close: 400}], 1),
    null,
  );
  assert.equal(priceCagr([], 1), null);
});
