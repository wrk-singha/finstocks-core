import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';
import type {FormatFamily} from './schema.ts';
import {
  filed,
  has,
  oldestFirst,
  pctOf,
  row,
  withChildren,
  zip,
  type Col,
  type StatementRow,
} from './statementRows.ts';

/**
 * The quarterly results as Screener lays them out, derived from the filing.
 *
 * Three facts about the vendor's quarterly blob decide what is read and how:
 *
 * - `Expenditure` already includes interest and depreciation. Profit before
 *   tax = Net_Sales − Expenditure + Other_Income − Exception_Items (+ share of
 *   associates) on 99% of filings, so the costs of running the business are
 *   Expenditure less those two, and operating profit is sales less that.
 *   Read naively, sales less Expenditure halves Reliance's operating profit.
 * - `Exception_Items` is filed positive for a loss. It is folded into other
 *   income with its sign turned, as Screener does, so profit before tax adds
 *   up down the column.
 * - `eps_basic` is per-share as filed at the time, so a split or bonus makes it
 *   discontinuous mid-window: Reliance's 1:1 bonus drops it from 24.48 to 13.70
 *   between Sep'24 and Dec'24 while net profit rises. `Adj_eps_abs` is the same
 *   figure restated onto the current share count, so the column stays
 *   comparable across the action. Both are filed on every row.
 *
 * Values run oldest first, the way the table reads left to right.
 */

export interface QuarterTable {
  periods: number[];
  rows: StatementRow[];
  /** Rows a chart can plot, in the order its switcher offers them. */
  chartable: string[];
}

export function buildQuarterTable(
  series: FundamentalsSeries | undefined,
  family: FormatFamily,
): QuarterTable | null {
  if (!series?.periods.length) return null;
  const order = series.periods.map((_, i) => i).reverse();
  const col = (key: string): Col => {
    const values = series.items[key];
    return order.map(i => values?.[i] ?? null);
  };

  const sales = col('Net_Sales');
  if (!has(sales)) return null;

  const interest = col('Interest');
  const depreciation = col('Depreciation');
  const expenses = zip(
    [col('Expenditure'), interest, depreciation],
    (e, i, d) => e - i - d,
  );
  const exceptional = col('Exception_Items');
  const otherIncome = zip(
    [col('Other_Income'), exceptional],
    (oi, x) => oi - x,
  );
  const tax = col('Tax');
  const netProfit = col('Pat');
  const eps = col('Adj_eps_abs');

  const otherIncomeRow = withChildren(
    row('other_income', 'Other income', otherIncome),
    [
      row('oi_filed', 'Other income', col('Other_Income')),
      row(
        'exceptional',
        'Exceptional items',
        exceptional.map(x => (x ? -x : null)),
        {
          hint: 'One-off gains or losses outside the normal business, such as selling an investment.',
        },
      ),
    ],
  );
  const netProfitRow = withChildren(
    row('net_profit', 'Net profit', netProfit, {strong: true}),
    [
      row('np_owners', "Owners' share", col('NetProfit_OwnOfParent')),
      row('np_minority', 'Minority interest', col('NetProfit_NonContInt')),
      row('np_associates', 'Share of associates', col('Shares_Associate')),
    ],
  );
  const epsRow = row('eps', 'EPS in ₹', eps, {kind: 'rupees'});

  if (family === 'bank') {
    const financingProfit = zip(
      [sales, interest, expenses],
      (s, i, e) => s - i - e,
    );
    const pbt = zip(
      [financingProfit, otherIncome, depreciation],
      (fp, oi, d) => fp + oi - d,
    );
    return {
      periods: oldestFirst(series),
      chartable: ['revenue', 'financing_profit', 'net_profit', 'gross_npa'],
      rows: filed([
        withChildren(
          row('revenue', 'Revenue', sales, {
            hint: 'Interest earned on loans, investments and balances.',
          }),
          [
            row('rev_advances', 'On advances', col('Int_Adv')),
            row('rev_investments', 'On investments', col('Inc_Inv')),
            row('rev_rbi', 'On balances with RBI', col('Int_Bal')),
            row('rev_other', 'Other interest', col('Int_Others')),
          ],
        ),
        row('interest', 'Interest', interest, {
          hint: 'Interest paid to depositors and lenders.',
        }),
        withChildren(
          row('expenses', 'Expenses', expenses, {
            hint: 'Running costs and provisions for bad loans.',
          }),
          [
            row('exp_employee', 'Employee cost', col('Exployee_Cost')),
            row('exp_operating', 'Operating expenses', col('Operating_Ex')),
          ],
        ),
        row('financing_profit', 'Financing profit', financingProfit, {
          strong: true,
        }),
        row(
          'financing_margin',
          'Financing margin %',
          pctOf(financingProfit, sales),
          {kind: 'pct'},
        ),
        otherIncomeRow,
        row('depreciation', 'Depreciation', depreciation),
        row('pbt', 'Profit before tax', pbt, {strong: true}),
        row('tax_pct', 'Tax %', pctOf(tax, pbt), {kind: 'pct'}),
        netProfitRow,
        epsRow,
        row('gross_npa', 'Gross NPA %', col('NPA_Gross_perc'), {kind: 'pct'}),
        row('net_npa', 'Net NPA %', col('NPA_Net_perc'), {kind: 'pct'}),
      ]),
    };
  }

  const operatingProfit = zip([sales, expenses], (s, e) => s - e);
  const pbt = zip(
    [operatingProfit, otherIncome, interest, depreciation],
    (op, oi, i, d) => op + oi - i - d,
  );

  const material = zip(
    [
      col('Raw_Material_Cost'),
      col('PURCHASE_FIN_GOOD'),
      col('Inc_Dec_Inventory'),
    ],
    (r, p, c) => r + p + c,
  );
  const employee = col('Exployee_Cost');
  const manufacturing = zip(
    [col('Electricity_Power_Fuel'), col('Mfg_Exps'), col('Job_Works')],
    (p, m, j) => p + m + j,
  );
  const otherCost = zip(
    [expenses, material, employee, manufacturing],
    (e, m, emp, mfg) => e - m - emp - mfg,
  );

  return {
    periods: oldestFirst(series),
    chartable: ['sales', 'operating_profit', 'net_profit', 'opm', 'eps'],
    rows: filed([
      withChildren(row('sales', 'Sales', sales), [
        row('gross_sales', 'Gross sales', col('Gross_Sale')),
        row(
          'excise',
          'Excise duty',
          col('Excise_Duty').map(v => (v ? -v : null)),
        ),
      ]),
      withChildren(row('expenses', 'Expenses', expenses), [
        row('material_pct', 'Material cost %', pctOf(material, sales), {
          kind: 'pct',
        }),
        row('employee_pct', 'Employee cost %', pctOf(employee, sales), {
          kind: 'pct',
        }),
        row(
          'manufacturing_pct',
          'Manufacturing cost %',
          pctOf(manufacturing, sales),
          {kind: 'pct'},
        ),
        row('other_cost_pct', 'Other cost %', pctOf(otherCost, sales), {
          kind: 'pct',
        }),
      ]),
      row('operating_profit', 'Operating profit', operatingProfit, {
        strong: true,
        hint: 'Sales less the costs of running the business, before interest, depreciation and tax.',
      }),
      row('opm', 'OPM %', pctOf(operatingProfit, sales), {
        kind: 'pct',
        hint: 'Operating profit as a share of sales.',
      }),
      otherIncomeRow,
      row('interest', 'Interest', interest),
      row('depreciation', 'Depreciation', depreciation),
      row('pbt', 'Profit before tax', pbt, {strong: true}),
      row('tax_pct', 'Tax %', pctOf(tax, pbt), {kind: 'pct'}),
      netProfitRow,
      epsRow,
    ]),
  };
}
