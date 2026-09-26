import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';
import type {QuarterTable} from './quarterlyResults.ts';
import type {FormatFamily} from './schema.ts';
import {
  filed,
  has,
  oldestFirst,
  or,
  orZero,
  pctOf,
  reader,
  row,
  withChildren,
  yoy,
  zip,
  type Col,
  type StatementRow,
} from './statementRows.ts';

/**
 * The annual profit & loss as Screener lays it out, derived from the filing.
 *
 * Checked line by line against Screener for Reliance (consolidated, FY22-FY26)
 * and against the whole annual table:
 *
 * - `Total_expendiure` excludes interest and depreciation, and
 *   Total_income − Total_expendiure − Interest − Depreciation
 *   + ExceptionalIncome_Expenses = Profit_before_tax on ~90% of filings. The
 *   rest carry other one-offs. Other income is therefore the balancing line
 *   (profit before tax less operating profit, plus interest and depreciation),
 *   as Screener does, so the column always adds up; its "+" shows what was
 *   filed. On the annual row the exceptional line is positive for a GAIN,
 *   which is the opposite of the quarterly feed.
 * - Net profit is the group's, before minority interest:
 *   Consolidated_NetProfit − Minority_interest (minority is filed negative).
 *   That matches Screener in every year, including FY22-23 where the vendor
 *   left the associates' share out of Profit_after_tax.
 * - `Raw_matrs_consumed` already includes purchases of finished goods (98% of
 *   filings), so material cost is that plus the change in inventory.
 * - A bank's Total_expendiure includes interest expended and provisions
 *   (Total_income − Total_expendiure = PBT on every bank row), and its
 *   depreciation sits inside operating expenses.
 * - EPS is `Adj_Eps` (restated for bonuses and splits); dividend payout is the
 *   vendor's `Dividend_Payout_Per` on the ratios row.
 *
 * Sales and expenses can differ from Screener's by ~0.2% where Screener
 * reclassifies a small operating income; interest, depreciation, profit before
 * tax, tax, net profit and EPS match exactly.
 *
 * Values run oldest first; when a trailing twelve months exists it is the last
 * value of every row.
 */

export interface ProfitLossTable {
  periods: number[];
  /** True when the last value of every row is the trailing twelve months. */
  ttm: boolean;
  rows: StatementRow[];
  /** Oldest-first annual columns the growth cards read, without the TTM. */
  annual: {sales: Col; netProfit: Col; roe: Col};
  /** Trailing-twelve-month sums of the last four quarters and the four before. */
  ttmPair?: {
    sales: [number, number] | null;
    netProfit: [number, number] | null;
  };
}

// YYYYMM → a month count, so "three months apart" is a subtraction.
const monthIndex = (p: number): number => Math.floor(p / 100) * 12 + (p % 100);

const contiguous = (periods: number[]): boolean => {
  for (let i = 1; i < periods.length; i++) {
    const prev = periods[i - 1];
    const cur = periods[i];
    if (prev == null || cur == null) return false;
    if (monthIndex(cur) - monthIndex(prev) !== 3) return false;
  }
  return true;
};

const sum = (values: Col): number | null => {
  let total = 0;
  for (const v of values) {
    if (v == null) return null;
    total += v;
  }
  return total;
};

/**
 * Sums the last four quarters of each row the quarterly table carries under
 * the same id. Only offered when those quarters run past the last annual year
 * — otherwise the TTM column would repeat it.
 */
function trailing(
  quarters: QuarterTable | null | undefined,
  lastYear: number,
): {
  ttm: (id: string) => number | null;
  pair: (id: string) => [number, number] | null;
} | null {
  if (!quarters || quarters.periods.length < 4) return null;
  const last4 = quarters.periods.slice(-4);
  const newest = last4[3];
  if (!contiguous(last4) || newest == null || newest <= lastYear) return null;
  const byId = new Map<string, Col>(quarters.rows.map(r => [r.id, r.values]));
  const ttm = (id: string): number | null => {
    const v = byId.get(id);
    return v ? sum(v.slice(-4)) : null;
  };
  const pair = (id: string): [number, number] | null => {
    const v = byId.get(id);
    if (
      !v ||
      quarters.periods.length < 8 ||
      !contiguous(quarters.periods.slice(-8))
    )
      return null;
    const now = sum(v.slice(-4));
    const before = sum(v.slice(-8, -4));
    return now != null && before != null ? [now, before] : null;
  };
  return {ttm, pair};
}

export function buildProfitLossTable(
  pl: FundamentalsSeries | undefined,
  ratios: FundamentalsSeries | undefined,
  family: FormatFamily,
  quarters?: QuarterTable | null,
): ProfitLossTable | null {
  if (!pl) return null;
  const periods = oldestFirst(pl);
  const lastYear = periods.at(-1);
  if (lastYear === undefined) return null;
  const col = reader(pl, periods);
  const ratio = reader(ratios, periods);

  const totalIncome = col('Total_income');
  const interest = col('Interest');
  const depreciation = col('Depreciation');
  const tax = col('Taxation');
  const filedPbt = col('Profit_before_tax');

  const owners = col('Consolidated_NetProfit');
  const minority = col('Minority_interest');
  const associates = col('Share_Associate');
  const profitAfterTax = col('Profit_after_tax');
  const netProfit = periods.map((_, i) => {
    const own = owners[i];
    if (own != null) return own - (minority[i] ?? 0);
    const pat = profitAfterTax[i];
    return pat != null ? pat + (associates[i] ?? 0) : null;
  });
  const netProfitRow = withChildren(
    row('net_profit', 'Net profit', netProfit, {strong: true}),
    [
      ...(has(minority)
        ? [
            row('np_owners', "Owners' share", owners),
            row(
              'np_minority',
              'Minority share',
              minority.map(m => (m ? -m : null)),
            ),
          ]
        : []),
      row('np_associates', 'Share of associates', associates, {
        hint: 'Profit from associates and joint ventures, counted after tax.',
      }),
    ],
  );
  const eps = col('Adj_Eps');
  const payout = ratio('Dividend_Payout_Per');
  const roe = ratio('Return_On_Equity');
  const tr = trailing(quarters, lastYear);

  const finish = (
    rows: StatementRow[],
    ttmOf: Record<string, number | null>,
  ): ProfitLossTable => {
    const shown = filed(rows);
    const withTtm = (r: StatementRow): StatementRow =>
      r.children
        ? {
            ...r,
            values: [...r.values, ttmOf[r.id] ?? null],
            children: r.children.map(withTtm),
          }
        : {...r, values: [...r.values, ttmOf[r.id] ?? null]};
    return {
      periods,
      ttm: tr !== null,
      rows: tr ? shown.map(withTtm) : shown,
      annual: {
        sales:
          rows.find(r => r.id === 'sales' || r.id === 'revenue')?.values ?? [],
        netProfit,
        roe,
      },
      ...(tr
        ? {
            ttmPair: {
              sales: tr.pair(family === 'bank' ? 'revenue' : 'sales'),
              netProfit: tr.pair('net_profit'),
            },
          }
        : {}),
    };
  };

  if (family === 'bank') {
    const revenue = or(col('Interest_earned'), col('Net_sales'));
    const expenses = zip([col('Total_expendiure'), interest], (e, i) => e - i);
    const financingProfit = zip(
      [revenue, interest, expenses],
      (r, i, e) => r - i - e,
    );
    const otherIncome = periods.map((_, i) => {
      const pbt = filedPbt[i];
      const financing = financingProfit[i];
      if (pbt != null && financing != null) return pbt - financing;
      const ti = totalIncome[i];
      const rv = revenue[i];
      return ti != null && rv != null ? ti - rv : null;
    });
    const pbt = or(
      filedPbt,
      zip([financingProfit, otherIncome], (f, o) => f + o),
    );
    const opex = col('Operating_expenses');
    // The quarterly bank table keeps depreciation below financing profit; the
    // annual row files it inside operating expenses. The trailing column is
    // moved onto the annual layout so it reads against the years beside it.
    const ttmDep = tr?.ttm('depreciation') ?? 0;
    const ttmRevenue = tr?.ttm('revenue') ?? null;
    const ttmExpenses = tr?.ttm('expenses');
    const ttmFinancingRaw = tr?.ttm('financing_profit');
    const ttmFinancing =
      ttmFinancingRaw != null ? ttmFinancingRaw - ttmDep : null;

    return finish(
      [
        withChildren(
          row('revenue', 'Revenue', revenue, {
            hint: 'Interest earned on loans, investments and balances.',
          }),
          [
            row('rev_growth', 'Revenue growth %', yoy(revenue), {kind: 'pct'}),
            row('rev_advances', 'On advances', col('Interest_advances_Bills')),
            row(
              'rev_investments',
              'On investments',
              col('Interest_investment'),
            ),
            row('rev_rbi', 'On balances with RBI', col('Interest_RBI')),
            row('rev_other', 'Other interest', col('Other_interest_income')),
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
            row('exp_operating', 'Operating expenses', opex),
            row(
              'exp_provisions',
              'Provisions',
              zip([expenses, opex], (e, o) => e - o),
              {
                hint: 'Set aside against loans and investments that may not be repaid.',
              },
            ),
          ],
        ),
        row('financing_profit', 'Financing profit', financingProfit, {
          strong: true,
        }),
        row(
          'financing_margin',
          'Financing margin %',
          pctOf(financingProfit, revenue),
          {kind: 'pct'},
        ),
        row('other_income', 'Other income', otherIncome, {
          hint: 'Fees, commission, treasury gains and other non-interest income.',
        }),
        row('pbt', 'Profit before tax', pbt, {strong: true}),
        row('tax_pct', 'Tax %', pctOf(tax, pbt), {kind: 'pct'}),
        netProfitRow,
        row('eps', 'EPS in ₹', eps, {kind: 'rupees'}),
        row('payout', 'Dividend payout %', payout, {
          kind: 'pct',
          hint: "Share of the year's profit paid out as dividend.",
        }),
      ],
      tr
        ? {
            revenue: ttmRevenue,
            interest: tr.ttm('interest'),
            expenses: ttmExpenses != null ? ttmExpenses + ttmDep : null,
            financing_profit: ttmFinancing,
            financing_margin:
              ttmRevenue && ttmFinancing != null
                ? (ttmFinancing / ttmRevenue) * 100
                : null,
            other_income: tr.ttm('other_income'),
            pbt: tr.ttm('pbt'),
            net_profit: tr.ttm('net_profit'),
            eps: tr.ttm('eps'),
          }
        : {},
    );
  }

  const sales = col('Net_sales');
  const filedExpenses = col('Total_expendiure');
  // A handful of filings (~0.5%) put interest and depreciation inside total
  // expenditure; left in, they would be counted twice below operating profit.
  const expenses = periods.map((_, i) => {
    const e = filedExpenses[i];
    if (e == null) return null;
    const ti = totalIncome[i];
    const pbt = filedPbt[i];
    const idd = (interest[i] ?? 0) + (depreciation[i] ?? 0);
    const tol = Math.max(1, Math.abs(pbt ?? 0) * 0.005);
    const fitsExcl =
      ti != null && pbt != null && Math.abs(ti - e - idd - pbt) <= tol;
    const fitsIncl = ti != null && pbt != null && Math.abs(ti - e - pbt) <= tol;
    return fitsIncl && !fitsExcl && idd > 0 ? e - idd : e;
  });
  const operatingProfit = zip([sales, expenses], (s, e) => s - e);
  const filedOtherIncome = or(
    zip([totalIncome, sales], (t, s) => t - s),
    col('Other_income'),
  );
  const exceptional = col('ExceptionalIncome_Expenses');
  const otherIncome = periods.map((_, i) => {
    const op = operatingProfit[i];
    const pbt = filedPbt[i];
    if (pbt != null && op != null)
      return pbt - op + (interest[i] ?? 0) + (depreciation[i] ?? 0);
    const oi = filedOtherIncome[i];
    return oi != null ? oi + (exceptional[i] ?? 0) : null;
  });
  const pbt = or(
    filedPbt,
    zip(
      [operatingProfit, otherIncome, orZero(interest), orZero(depreciation)],
      (op, oi, i, d) => op + oi - i - d,
    ),
  );

  const material = materialCost(col);
  const employee = col('Employees');
  const manufacturing = zip(
    [orZero(col('Power_Fuel')), orZero(col('Other_Mfg_Exps'))],
    (p, m) => p + m || null,
  );
  const otherCost = zip(
    [expenses, orZero(material), orZero(employee), orZero(manufacturing)],
    (e, m, emp, mfg) => e - m - emp - mfg,
  );

  const ttmSales = tr?.ttm('sales') ?? null;
  const ttmOp = tr?.ttm('operating_profit') ?? null;

  return finish(
    [
      withChildren(row('sales', 'Sales', sales), [
        row('sales_growth', 'Sales growth %', yoy(sales), {kind: 'pct'}),
      ]),
      withChildren(row('expenses', 'Expenses', expenses), [
        // A lender has no factory: the vendor files its branch and collection
        // costs under the manufacturing keys, which would read as nonsense here.
        ...(family === 'lender'
          ? []
          : [
              row('material_pct', 'Material cost %', pctOf(material, sales), {
                kind: 'pct',
              }),
              row(
                'manufacturing_pct',
                'Manufacturing cost %',
                pctOf(manufacturing, sales),
                {kind: 'pct'},
              ),
            ]),
        row('employee_pct', 'Employee cost %', pctOf(employee, sales), {
          kind: 'pct',
        }),
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
      withChildren(row('other_income', 'Other income', otherIncome), [
        row('oi_filed', 'Other income', filedOtherIncome),
        row('exceptional', 'Exceptional items', exceptional, {
          hint: 'One-off gains or losses outside the normal business, such as selling an investment.',
        }),
      ]),
      row('interest', 'Interest', interest),
      row('depreciation', 'Depreciation', depreciation),
      row('pbt', 'Profit before tax', pbt, {strong: true}),
      row('tax_pct', 'Tax %', pctOf(tax, pbt), {kind: 'pct'}),
      netProfitRow,
      row('eps', 'EPS in ₹', eps, {kind: 'rupees'}),
      row('payout', 'Dividend payout %', payout, {
        kind: 'pct',
        hint: "Share of the year's profit paid out as dividend.",
      }),
    ],
    tr
      ? {
          sales: ttmSales,
          expenses: tr.ttm('expenses'),
          operating_profit: ttmOp,
          opm: ttmSales && ttmOp != null ? (ttmOp / ttmSales) * 100 : null,
          other_income: tr.ttm('other_income'),
          interest: tr.ttm('interest'),
          depreciation: tr.ttm('depreciation'),
          pbt: tr.ttm('pbt'),
          net_profit: tr.ttm('net_profit'),
          eps: tr.ttm('eps'),
        }
      : {},
  );
}

/**
 * Material cost as Screener reads it: raw material consumed (which already
 * includes purchases of finished goods) plus the change in inventory. Also the
 * cost base behind inventory and payable days.
 */
export const materialCost = (col: (key: string) => Col): Col =>
  zip(
    [col('Raw_matrs_consumed'), orZero(col('Inc_Dec_Inventory'))],
    (r, c) => r + c,
  );

/** Compound annual growth from `years` years before the last value to it. */
export function cagr(values: Col, years: number): number | null {
  const end = values[values.length - 1];
  const start = values[values.length - 1 - years];
  if (end == null || start == null || start <= 0 || end <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

/** Plain average of the last `years` values, only when every one is filed. */
export function averageOf(values: Col, years: number): number | null {
  if (values.length < years) return null;
  const total = sum(values.slice(-years));
  return total != null ? total / years : null;
}

type PriceClose = {time: string; close: number};

/** Price CAGR over `years`, reading the close on or just before that date. */
export function priceCagr(
  series: readonly PriceClose[],
  years: number,
): number | null {
  const first = series[0];
  const last = series.at(-1);
  if (series.length < 2 || !first || !last) return null;
  const target = new Date(last.time);
  target.setFullYear(target.getFullYear() - years);
  const t = target.getTime();
  let start: PriceClose | undefined;
  for (const p of series) {
    if (new Date(p.time).getTime() <= t) start = p;
    else break;
  }
  // A history that begins after the target date cannot answer for the span;
  // a week's slack covers holidays and a downsampled series.
  if (!start) {
    if (new Date(first.time).getTime() - t > 7 * 86400000) return null;
    start = first;
  }
  if (start.close <= 0 || last.close <= 0) return null;
  return (Math.pow(last.close / start.close, 1 / years) - 1) * 100;
}
