import type {FundamentalsStatements} from '../types/fundamentalsDetail.ts';
import {materialCost} from './profitLossTable.ts';
import type {FormatFamily} from './schema.ts';
import {
  annualTable,
  daysOf,
  oldestFirst,
  orZero,
  pctOf,
  reader,
  row,
  zip,
  type AnnualTable,
} from './statementRows.ts';

/**
 * Screener's ratios, worked out from the balance sheet and the profit & loss.
 *
 * Fitted to Screener for Reliance (consolidated, FY22-FY26):
 *
 * - Debtor days are receivables over sales; inventory and payable days are
 *   inventory and trade payables over material cost (raw material plus the
 *   change in stock), not over sales. All five years match to the day.
 * - The cash conversion cycle is debtor + inventory − payable days, taken
 *   before rounding. A company with no material cost (a software house) has no
 *   inventory or payable days, and its cycle is its debtor days.
 * - Working capital is current assets less cash, current investments and
 *   current liabilities with provisions. Matches every year within a day.
 * - ROCE is profit before interest and tax over net worth, minority interest
 *   and borrowings at the year end. Four of five years match; Screener's
 *   borrowings carry lease liabilities the vendor does not file.
 *
 * A bank has no inventory, payables or working capital in this sense, so it
 *   reads ROE alone, as on Screener.
 */
export function buildRatiosTable(
  statements: FundamentalsStatements | undefined,
  family: FormatFamily,
): AnnualTable | null {
  const bs = statements?.balance_sheet;
  if (!statements || !bs?.periods.length) return null;
  const periods = oldestFirst(bs);
  const col = reader(bs, periods);
  const pl = reader(statements.profit_loss, periods);

  if (family === 'bank') {
    const roe = reader(statements.ratios, periods)('Return_On_Equity');
    return annualTable(periods, [
      row('roe', 'ROE %', roe, {kind: 'pct', strong: true}),
    ]);
  }

  const sales = pl('Net_sales');
  const material = materialCost(pl);
  const debtorDays = daysOf(col('Debtors'), sales);
  const inventoryDays = daysOf(col('Inventory'), material);
  const payableDays = daysOf(col('Trade_Payables'), material);
  const cycle = zip(
    [debtorDays, orZero(inventoryDays), orZero(payableDays)],
    (d, i, p) => d + i - p,
  );
  const workingCapital = zip(
    [
      col('Currant_Assets_Nf'),
      orZero(col('Cash_Bank')),
      orZero(col('Current_Investments')),
      col('Current_Laib_Prov_Nf'),
    ],
    (ca, cash, ci, cl) => ca - cash - ci - cl,
  );
  const ebit = zip(
    [pl('Profit_before_tax'), orZero(pl('Interest'))],
    (p, i) => p + i,
  );
  const capitalEmployed = zip(
    [
      col('Sharehoders_funds'),
      orZero(col('Minority_Interest')),
      orZero(col('Total_Debt_Inclst_Nf')),
    ],
    (n, m, d) => n + m + d,
  );

  return annualTable(periods, [
    row('debtor_days', 'Debtor days', debtorDays, {
      kind: 'days',
      hint: 'Days of sales waiting to be collected from customers.',
    }),
    row('inventory_days', 'Inventory days', inventoryDays, {
      kind: 'days',
      hint: 'Days of material cost sitting in stock.',
    }),
    row('payable_days', 'Days payable', payableDays, {
      kind: 'days',
      hint: 'Days the company takes to pay its suppliers.',
    }),
    row('ccc', 'Cash conversion cycle', cycle, {
      kind: 'days',
      strong: true,
      hint: 'Days between paying for material and collecting the sale. Negative means suppliers fund the business.',
    }),
    row('wc_days', 'Working capital days', daysOf(workingCapital, sales), {
      kind: 'days',
    }),
    row('roce', 'ROCE %', pctOf(ebit, capitalEmployed), {
      kind: 'pct',
      strong: true,
      hint: 'Profit before interest and tax on the capital employed: net worth plus borrowings.',
    }),
  ]);
}
