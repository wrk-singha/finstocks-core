import assert from 'node:assert/strict';

import type {
  FundamentalsSeries,
  FundamentalsStatements,
} from '../../types/fundamentalsDetail.ts';
import type {StatementRow} from '../statementRows.ts';

type Items = Record<string, (number | null)[]>;

/** A series as the endpoint sends it: periods and every line newest first. */
export const series = (
  periods: number[],
  items: Items,
): FundamentalsSeries => ({
  periods,
  items,
});

/** Rounds away float residue so a derived column compares by value. */
export const round = (values: readonly (number | null)[]): (number | null)[] =>
  values.map(v => (v == null ? null : Math.round(v * 1e6) / 1e6));

export function rowOf(rows: StatementRow[], id: string): StatementRow {
  const found = rows.find(r => r.id === id);
  assert.ok(found, `no ${id} row`);
  return found;
}

export function valuesOf(rows: StatementRow[], id: string): (number | null)[] {
  return round(rowOf(rows, id).values);
}

export function childIds(rows: StatementRow[], id: string): string[] {
  return (rowOf(rows, id).children ?? []).map(c => c.id);
}

export function childValues(
  rows: StatementRow[],
  id: string,
  childId: string,
): (number | null)[] {
  return valuesOf(rowOf(rows, id).children ?? [], childId);
}

// Three years of a manufacturer's consolidated profit & loss, newest first. It
// adds up the way the vendor files it: profit before tax is total income less
// expenditure, interest and depreciation, plus the FY25 exceptional gain.
export const ANNUAL_PERIODS = [202603, 202503, 202403];

export const GENERAL_PL = series(ANNUAL_PERIODS, {
  Net_sales: [1000, 900, 800],
  Other_income: [50, 40, 30],
  Total_income: [1050, 940, 830],
  Total_expendiure: [800, 720, 650],
  Raw_matrs_consumed: [500, 450, 400],
  Inc_Dec_Inventory: [-10, 5, null],
  Power_Fuel: [40, 36, 32],
  Other_Mfg_Exps: [20, 18, 16],
  Employees: [100, 90, 80],
  Interest: [20, 18, 16],
  Depreciation: [30, 28, 26],
  ExceptionalIncome_Expenses: [0, 10, 0],
  Profit_before_tax: [200, 184, 138],
  Taxation: [50, 46, 34],
  Profit_after_tax: [150, 138, 104],
  Share_Associate: [5, 4, 3],
  // Filed negative: the minority's share comes out of the group's profit.
  Minority_interest: [-10, -8, -6],
  Consolidated_NetProfit: [145, 134, 101],
  Adj_Eps: [14.5, 13.4, 10.1],
  Reported_EPS: [14.5, 26.8, 20.2],
});

export const GENERAL_RATIOS = series(ANNUAL_PERIODS, {
  Dividend_Payout_Per: [20, 18, 15],
  Return_On_Equity: [15, 14, 12],
});

export const GENERAL_BS = series(ANNUAL_PERIODS, {
  Total_Applications_Nf: [1000, 900, 800],
  Sharehoders_funds: [500, 450, 400],
  Share_Capital: [50, 50, 50],
  Reserve: [440, 395, 345],
  Net_Block: [400, 380, 360],
  Gross_block: [700, 650, 600],
  Acc_Depreciation: [300, 270, 240],
  CWIP: [50, 40, 30],
  Long_Term_Investments_Nf: [100, 90, 80],
  Current_Investments: [20, 10, null],
  Minority_Interest: [30, 25, 20],
  Total_Debt_Inclst_Nf: [200, 180, 160],
  St_Borrowings: [50, 40, 30],
  Trade_Payables: [100, 90, 80],
  Adv_Customers: [20, 15, 10],
  Inventory: [150, 140, 130],
  Debtors: [80, 70, 60],
  Cash_Bank: [60, 50, 40],
  Loans_Adv: [40, 30, 20],
  Currant_Assets_Nf: [400, 350, 300],
  Current_Laib_Prov_Nf: [180, 160, 140],
});

// Operating cash is profit before tax, the non-cash add-backs, the working
// capital movement and the tax paid, to the crore.
export const GENERAL_CF = series(ANNUAL_PERIODS, {
  Profit_bef_tax: [200, 184, 138],
  Adjustment_total: [60, 50, 40],
  Change_WC_total: [-6, -3, 4],
  Tax_paid: [-44, -41, -32],
  Cash_from_Operation: [210, 190, 150],
  Cash_from_Investment: [-135, -137, -90],
  Cash_from_Financing: [-22, -16, -30],
  Net_Cash_inflow_outflow: [53, 37, 30],
});

export const GENERAL_STATEMENTS: FundamentalsStatements = {
  basis: 'C',
  basis_available: ['C', 'S'],
  profit_loss: GENERAL_PL,
  balance_sheet: GENERAL_BS,
  cash_flow: GENERAL_CF,
  ratios: GENERAL_RATIOS,
  cash_flow_basis: 'C',
};
