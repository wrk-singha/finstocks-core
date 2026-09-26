import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';
import type {FormatFamily} from './schema.ts';
import {
  annualTable,
  has,
  oldestFirst,
  or,
  orZero,
  reader,
  rest,
  row,
  withChildren,
  zip,
  type AnnualTable,
} from './statementRows.ts';

/**
 * The balance sheet as Screener lays it out, derived from the filing.
 *
 * Checked against Screener for Reliance (consolidated, FY22-FY26):
 *
 * - Total assets is `Total_Applications_Nf`. `Total_Applications` is the NET
 *   application of funds, with current liabilities already netted off.
 * - Reserves is net worth less equity capital, which carries the ESOP
 *   outstanding and share-application lines Screener folds into it (Reserve
 *   alone is 673 short on FY26).
 * - CWIP already includes intangibles under development.
 * - Investments is long-term plus current; the vendor's `Investments` key is a
 *   different aggregate.
 * - Other liabilities and other assets are the balancing lines, as on
 *   Screener, so both columns always add up to the total.
 *
 * Borrowings is the vendor's total debt. Screener's also counts lease
 *   liabilities, which the vendor does not file, so a company with large leases
 *   reads a little lower here (Reliance FY26: 3,74,421 against 4,02,962) and
 *   other liabilities that much higher. Every other line matches exactly.
 */
export function buildBalanceSheetTable(
  bs: FundamentalsSeries | undefined,
  family: FormatFamily,
): AnnualTable | null {
  if (!bs?.periods.length) return null;
  const periods = oldestFirst(bs);
  const col = reader(bs, periods);

  const total = col('Total_Applications_Nf');
  if (!has(total)) return null;
  const netWorth = col('Sharehoders_funds');
  const equity = col('Share_Capital');
  const reserves = or(
    zip([netWorth, equity], (n, e) => n - e),
    col('Reserve'),
  );
  const fixedAssets = col('Net_Block');
  const cwip = col('CWIP');
  const minority = col('Minority_Interest');

  const liabilitiesTotal = row(
    'total_liabilities',
    'Total liabilities',
    total,
    {
      strong: true,
    },
  );
  const assetsTotal = row('total_assets', 'Total assets', total, {
    strong: true,
  });
  const fixedRow = withChildren(
    row('fixed_assets', 'Fixed assets', fixedAssets),
    [
      row('gross_block', 'Gross block', col('Gross_block')),
      row('acc_dep', 'Accumulated depreciation', col('Acc_Depreciation')),
    ],
  );

  if (family === 'bank') {
    const deposits = col('Deposits');
    const borrowings = col('Borrowings');
    const investments = col('Investments');
    const otherLiabilities = zip(
      [total, netWorth, orZero(deposits), orZero(borrowings)],
      (t, n, d, b) => t - n - d - b,
    );
    const otherAssets = rest(total, [fixedAssets, cwip, investments]);
    const advances = col('Advances');
    const cash = col('Cash_balances_RBI');
    const bankBalances = col('Bank_Call_money');
    return annualTable(periods, [
      row('equity', 'Equity capital', equity),
      row('reserves', 'Reserves', reserves),
      row('deposits', 'Deposits', deposits),
      row('borrowings', 'Borrowing', borrowings),
      withChildren(
        row('other_liabilities', 'Other liabilities', otherLiabilities),
        [
          row('ol_minority', 'Non-controlling interest', minority),
          row(
            'ol_other',
            'Other liability items',
            rest(otherLiabilities, [minority]),
          ),
        ],
      ),
      liabilitiesTotal,
      fixedRow,
      row('cwip', 'CWIP', cwip, {
        hint: 'Capital work in progress: assets being built, not yet in use.',
      }),
      row('investments', 'Investments', investments),
      withChildren(row('other_assets', 'Other assets', otherAssets), [
        row('oa_advances', 'Advances', advances, {
          hint: "The bank's loan book.",
        }),
        row('oa_cash', 'Cash and balances with RBI', cash),
        row('oa_banks', 'Balances with banks', bankBalances),
        row(
          'oa_other',
          'Other asset items',
          rest(otherAssets, [advances, cash, bankBalances]),
        ),
      ]),
      assetsTotal,
    ]);
  }

  const borrowings = col('Total_Debt_Inclst_Nf');
  const shortTerm = col('St_Borrowings');
  const otherLiabilities = zip(
    [total, netWorth, orZero(borrowings)],
    (t, n, b) => t - n - b,
  );
  const payables = col('Trade_Payables');
  const advancesIn = col('Adv_Customers');
  const investments = zip(
    [
      or(col('Long_Term_Investments_Nf'), col('Investments_Nf')),
      orZero(col('Current_Investments')),
    ],
    (lt, ct) => lt + ct,
  );
  const otherAssets = rest(total, [fixedAssets, cwip, investments]);
  const inventory = col('Inventory');
  const receivables = col('Debtors');
  const cash = col('Cash_Bank');
  const loans = col('Loans_Adv');

  return annualTable(periods, [
    row('equity', 'Equity capital', equity),
    row('reserves', 'Reserves', reserves),
    withChildren(row('borrowings', 'Borrowings', borrowings), [
      row('b_long', 'Long-term borrowings', rest(borrowings, [shortTerm])),
      row('b_short', 'Short-term borrowings', shortTerm),
    ]),
    withChildren(
      row('other_liabilities', 'Other liabilities', otherLiabilities),
      [
        row('ol_minority', 'Non-controlling interest', minority),
        row('ol_payables', 'Trade payables', payables),
        row('ol_advances', 'Advance from customers', advancesIn),
        row(
          'ol_other',
          'Other liability items',
          rest(otherLiabilities, [minority, payables, advancesIn]),
        ),
      ],
    ),
    liabilitiesTotal,
    fixedRow,
    row('cwip', 'CWIP', cwip, {
      hint: 'Capital work in progress: assets being built, not yet in use.',
    }),
    row('investments', 'Investments', investments),
    withChildren(row('other_assets', 'Other assets', otherAssets), [
      row('oa_inventory', 'Inventories', inventory),
      row('oa_receivables', 'Trade receivables', receivables),
      row('oa_cash', 'Cash equivalents', cash),
      row('oa_loans', 'Loans and advances', loans),
      row(
        'oa_other',
        'Other asset items',
        rest(otherAssets, [inventory, receivables, cash, loans]),
      ),
    ]),
    assetsTotal,
  ]);
}
