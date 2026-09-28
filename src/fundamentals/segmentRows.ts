import type {SegmentsResponse} from '../types/segments.ts';
import {
  type Col,
  pctOf,
  row,
  type StatementRow,
  withChildren,
  zip,
} from './statementRows.ts';

/** The three blocks, by row id. The view opens with each of them showing its segments. */
export const SEGMENT_BLOCKS = ['sales', 'profit_pct', 'roce'] as const;

// Past ±500% the capital base is too small for the ratio to mean anything (Reliance Oil & Gas FY20
// read −2,100%); blank beats absurd.
const ROCE_LIMIT = 500;
const QUARTERS_PER_YEAR = 4;

/** Each column's sum over the series that filed a figure for it; null where none did. */
const sumOf = (cols: Col[], width: number): Col =>
  Array.from({length: width}, (_, i) => {
    const filed = cols.map(c => c[i]).filter((v): v is number => v != null);
    return filed.length ? filed.reduce((a, b) => a + b, 0) : null;
  });

/**
 * Screener's three segment blocks. Sales is each segment's revenue, the inter-segment elimination
 * included so the block adds up to the filing. Profit % is the segment result (profit before
 * interest and tax) over its revenue. ROCE % is the result over capital employed — segment assets
 * less segment liabilities — which leaves out the unallocated remainder, whose "capital" is mostly
 * the company's own equity and debt.
 *
 * A segment that was renamed or retired keeps its own row, with a gap where it was not reported,
 * and a block none of whose segments filed a figure is left out.
 */
export function buildSegmentRows(data: SegmentsResponse): StatementRow[] {
  const width = data.periods.length;
  const annualise = data.period === 'quarterly' ? QUARTERS_PER_YEAR : 1;
  const operating = data.segments.filter(s => !s.is_intersegment);
  const reportable = operating.filter(s => !s.is_unallocated);

  const salesTotal = sumOf(
    data.segments.map(s => s.revenue),
    width,
  );
  const resultTotal = sumOf(
    operating.map(s => s.result),
    width,
  );

  const roceOf = (result: Col, capital: Col): Col =>
    zip([result, capital], (r, c) => {
      if (c <= 0) return null;
      const pct = ((r * annualise) / c) * 100;
      return Math.abs(pct) > ROCE_LIMIT ? null : pct;
    });

  const sales = withChildren(
    row('sales', 'Sales', salesTotal, {
      strong: true,
      hint: 'Revenue by segment, after the inter-segment elimination.',
    }),
    data.segments.map(s => row(`sales_${s.key}`, s.name, s.revenue)),
  );

  const profit = withChildren(
    row('profit_pct', 'Profit %', pctOf(resultTotal, salesTotal), {
      kind: 'pct',
      strong: true,
      hint: 'Segment result (profit before interest and tax) as a share of segment revenue.',
    }),
    operating.map(s =>
      row(`profit_${s.key}`, s.name, pctOf(s.result, s.revenue), {
        kind: 'pct',
      }),
    ),
  );

  const roce = withChildren(
    row(
      'roce',
      'ROCE %',
      roceOf(
        sumOf(
          reportable.map(s => s.result),
          width,
        ),
        sumOf(
          reportable.map(s => s.capital_employed),
          width,
        ),
      ),
      {
        kind: 'pct',
        strong: true,
        hint:
          'Segment result over capital employed (segment assets less segment liabilities) at period end' +
          (annualise > 1 ? ', quarterly results annualised.' : '.'),
      },
    ),
    reportable.map(s =>
      row(`roce_${s.key}`, s.name, roceOf(s.result, s.capital_employed), {
        kind: 'pct',
      }),
    ),
  );

  return [sales, profit, roce].filter(r => r.children?.length);
}
