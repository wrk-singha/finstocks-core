import type {FundamentalsStatements} from '../types/fundamentalsDetail.ts';
import {buildProfitLossTable} from './profitLossTable.ts';
import type {FormatFamily} from './schema.ts';
import {
  annualTable,
  oldestFirst,
  or,
  orZero,
  pctOf,
  reader,
  rest,
  row,
  withChildren,
  zip,
  type AnnualTable,
} from './statementRows.ts';

/**
 * The cash flows as Screener lays them out, derived from the filing.
 *
 * The three activities and the net flow match Screener exactly for Reliance
 * (consolidated, FY24-FY26). Operating cash opens into what the vendor files
 * behind it: profit before tax with the non-cash items added back, the working
 * capital movement and the tax paid, which add up to it.
 *
 * Screener's free cash flow is operating cash less capital expenditure, and
 * the vendor's cash flow files no capex line, so that row is left out rather
 * than estimated. CFO/OP reads operating profit off the profit & loss table on
 * this page, so it only appears when both statements are on the same basis.
 */
export function buildCashFlowTable(
  statements: FundamentalsStatements | undefined,
  family: FormatFamily,
): AnnualTable | null {
  const cf = statements?.cash_flow;
  if (!statements || !cf?.periods.length) return null;
  const periods = oldestFirst(cf);
  const col = reader(cf, periods);

  const operating = col('Cash_from_Operation');
  const fromOperations = or(
    zip(
      [col('Profit_bef_tax'), orZero(col('Adjustment_total'))],
      (p, a) => p + a,
    ),
    zip(
      [col('Cashflow_after_WC'), orZero(col('Change_WC_total'))],
      (c, w) => c - w,
    ),
  );
  const workingCapital = col('Change_WC_total');
  const taxes = col('Tax_paid');

  const sameBasis =
    (statements.cash_flow_basis ?? statements.basis) === statements.basis;
  const pl = sameBasis
    ? buildProfitLossTable(statements.profit_loss, statements.ratios, family)
    : null;
  const opRow = pl?.rows.find(r => r.id === 'operating_profit');
  const operatingProfit = periods.map(p => {
    const i = pl?.periods.indexOf(p) ?? -1;
    return i < 0 ? null : (opRow?.values[i] ?? null);
  });

  return annualTable(periods, [
    withChildren(row('cfo', 'Cash from operating activity', operating), [
      row('cfo_profit', 'Profit from operations', fromOperations, {
        hint: 'Profit before tax with depreciation and other non-cash charges added back.',
      }),
      row('cfo_wc', 'Working capital changes', workingCapital, {
        hint: 'Cash tied up in, or released from, inventory and receivables less payables.',
      }),
      row('cfo_tax', 'Direct taxes', taxes),
      row(
        'cfo_other',
        'Other operating items',
        rest(operating, [fromOperations, workingCapital, taxes]),
      ),
    ]),
    row('cfi', 'Cash from investing activity', col('Cash_from_Investment')),
    row('cff', 'Cash from financing activity', col('Cash_from_Financing')),
    row('net', 'Net cash flow', col('Net_Cash_inflow_outflow'), {
      strong: true,
    }),
    row('cfo_op', 'CFO/OP', pctOf(operating, operatingProfit), {
      kind: 'pct',
      hint: 'Operating cash as a share of operating profit: how much of the reported profit arrived as cash.',
    }),
  ]);
}
