import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {SegmentSeries, SegmentsResponse} from '../../types/segments.ts';
import {buildSegmentRows, SEGMENT_BLOCKS} from '../segmentRows.ts';
import type {StatementRow} from '../statementRows.ts';
import {round, rowOf} from './filings.ts';

const segment = (
  key: string,
  series: Pick<SegmentSeries, 'revenue' | 'result' | 'capital_employed'>,
  flags: Partial<
    Pick<SegmentSeries, 'is_unallocated' | 'is_intersegment'>
  > = {},
): SegmentSeries => ({
  name: key.toUpperCase(),
  key,
  is_unallocated: false,
  is_intersegment: false,
  ...series,
  ...flags,
});

const note = (fields: Partial<SegmentsResponse>): SegmentsResponse => ({
  symbol: 'RELIANCE',
  fincode: 100_325,
  basis: 'C',
  basis_available: ['C', 'S'],
  period: 'annual',
  period_available: ['annual', 'quarterly'],
  periods: [202503, 202603],
  segments: [],
  filings: [],
  ...fields,
});

const shape = (r: StatementRow) => ({
  id: r.id,
  label: r.label,
  values: round(r.values),
  children: r.children?.map(c => ({
    id: c.id,
    label: c.label,
    values: round(c.values),
  })),
});

// Two reportable segments, one retired after FY25, the unallocated remainder and the
// inter-segment elimination, as a results filing lays them out.
const ANNUAL = note({
  segments: [
    segment('o2c', {
      revenue: [100, 120],
      result: [10, 15],
      capital_employed: [50, 60],
    }),
    segment('gas', {
      revenue: [40, null],
      result: [4, null],
      capital_employed: [20, null],
    }),
    segment(
      'unallocated',
      {
        revenue: [null, null],
        result: [-2, 1],
        capital_employed: [500, 600],
      },
      {is_unallocated: true},
    ),
    segment(
      'elimination',
      {
        revenue: [-10, -20],
        result: [null, null],
        capital_employed: [null, null],
      },
      {is_intersegment: true},
    ),
  ],
});

test('sales adds every segment, the inter-segment elimination included, and lists the ones that filed revenue', () => {
  assert.deepEqual(shape(rowOf(buildSegmentRows(ANNUAL), 'sales')), {
    id: 'sales',
    label: 'Sales',
    values: [130, 100],
    children: [
      {id: 'sales_o2c', label: 'O2C', values: [100, 120]},
      // A retired segment keeps its row, with a gap where it was not reported.
      {id: 'sales_gas', label: 'GAS', values: [40, null]},
      {id: 'sales_elimination', label: 'ELIMINATION', values: [-10, -20]},
    ],
  });
});

test('profit % is the operating result over sales, the unallocated result in the total but not a row of its own', () => {
  const profit = rowOf(buildSegmentRows(ANNUAL), 'profit_pct');
  assert.equal(profit.kind, 'pct');
  assert.deepEqual(shape(profit), {
    id: 'profit_pct',
    label: 'Profit %',
    // (10 + 4 - 2) / 130 and (15 + 1) / 100.
    values: round([(12 / 130) * 100, 16]),
    children: [
      {id: 'profit_o2c', label: 'O2C', values: [10, 12.5]},
      {id: 'profit_gas', label: 'GAS', values: [10, null]},
    ],
  });
});

test('ROCE % reads the reportable segments alone, leaving out the unallocated capital', () => {
  const roce = rowOf(buildSegmentRows(ANNUAL), 'roce');
  assert.equal(roce.kind, 'pct');
  assert.equal(
    roce.hint,
    'Segment result over capital employed (segment assets less segment liabilities) at period end.',
  );
  assert.deepEqual(shape(roce), {
    id: 'roce',
    label: 'ROCE %',
    // (10 + 4) / (50 + 20) and 15 / 60; the unallocated 500 and 600 would halve both.
    values: [20, 25],
    children: [
      {id: 'roce_o2c', label: 'O2C', values: [20, 25]},
      {id: 'roce_gas', label: 'GAS', values: [20, null]},
    ],
  });
});

test('the blocks come in order, strong, each opening on its segments', () => {
  const rows = buildSegmentRows(ANNUAL);
  assert.deepEqual(
    rows.map(r => r.id),
    [...SEGMENT_BLOCKS],
  );
  assert.equal(
    rows.every(r => r.strong === true && r.hint !== undefined),
    true,
  );
});

test('a quarter is annualised, and a ROCE past 500% or on no capital is left blank', () => {
  const quarterly = note({
    period: 'quarterly',
    periods: [202603, 202606],
    segments: [
      segment('retail', {
        revenue: [100, 100],
        result: [30, 30],
        capital_employed: [100, 20],
      }),
      segment('digital', {
        revenue: [50, 50],
        result: [5, 5],
        capital_employed: [0, -40],
      }),
    ],
  });
  const roce = rowOf(buildSegmentRows(quarterly), 'roce');
  assert.equal(
    roce.hint,
    'Segment result over capital employed (segment assets less segment liabilities) at period end, quarterly results annualised.',
  );
  assert.deepEqual(shape(roce), {
    id: 'roce',
    label: 'ROCE %',
    // 35 × 4 / 100 and 35 × 4 / -20: a negative base has no return to give.
    values: [140, null],
    children: [
      // 30 × 4 / 100, then 30 × 4 / 20 = 600%, which says the base is too small to mean anything.
      {id: 'roce_retail', label: 'RETAIL', values: [120, null]},
    ],
  });
});

test('a block no segment filed a figure for is left out, and so is everything for an empty note', () => {
  const salesOnly = note({
    segments: [
      segment('o2c', {
        revenue: [100, 120],
        result: [null, null],
        capital_employed: [null, null],
      }),
    ],
  });
  assert.deepEqual(
    buildSegmentRows(salesOnly).map(r => r.id),
    ['sales'],
  );
  assert.deepEqual(buildSegmentRows(note({periods: [], segments: []})), []);
});
