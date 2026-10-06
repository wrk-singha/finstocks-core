import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  ManualReportPayload,
  ReportFact,
} from '../../types/manualReport.ts';
import {
  bareLabel,
  capBandLabel,
  citesLine,
  coverageGroups,
  coveragePct,
  factText,
  factUnit,
  factUnitWord,
  figureRows,
  fiscalYears,
  gapStatusWord,
  gateTally,
  historyTable,
  kpiGapLine,
  kpiTrail,
  kpiValueText,
  monitorChips,
  partTally,
  partTitle,
  reportBenchmark,
  reportDay,
  reportFactIndex,
  reportKeyFigures,
  reportNumber,
  reportSector,
  reportShortName,
  riskChainSteps,
  signedChangeText,
  sparkPoints,
} from '../manualReport.ts';

const ROCE: ReportFact = {
  key: 'f.roce',
  label: 'ROCE (%)',
  period: '2026-03-31',
  value: 18.42,
  history: [
    {period: 'FY22', value: 14.1},
    {period: 'FY23', value: 15.8},
    {period: 'FY24', value: 17.2},
    {period: 'FY25', value: 18.42},
  ],
};
const DEBT: ReportFact = {
  key: 'f.debt',
  label: 'Net debt (₹ cr)',
  period: '2026-03-31',
  value: -1240.5,
  history: [
    {period: 'FY24', value: 820},
    {period: 'FY25', value: -1240.5},
  ],
};
const FACTS: ReportFact[] = [
  ROCE,
  {key: 'f.pe', label: 'P/E (x)', period: '2026-09-30', value: 24.6},
  DEBT,
];

test('figures print with Indian grouping, a typographic minus and the unit their label ends in', () => {
  assert.equal(reportNumber(1234567.891), '12,34,567.89');
  assert.equal(reportNumber(1234567.891, 0), '12,34,568');
  assert.equal(factUnit('ROCE (%)'), '%');
  assert.equal(factUnit('P/E (x)'), 'x');
  assert.equal(factUnit('Net debt (₹ cr)'), '');
  assert.equal(factUnitWord('Net debt (₹ cr)'), '₹ cr');
  assert.equal(factUnitWord('ROCE (%)'), undefined);
  assert.equal(bareLabel('Net debt (₹ cr)'), 'Net debt');
  assert.equal(factText(ROCE), '18.42%');
  assert.equal(factText(DEBT), '−1,240.5');
  assert.equal(kpiValueText(18.42, '%'), '18.42%');
  assert.equal(kpiValueText(2.1, 'x'), '2.1x');
  assert.equal(kpiValueText(1240, '₹ cr'), '1,240 ₹ cr');
  assert.equal(kpiValueText(-3), '−3');
  assert.equal(signedChangeText(3.25), '+3.25%');
  assert.equal(signedChangeText(-1.4), '−1.4%');
});

test('a date prints as a day, and anything else as it came', () => {
  assert.equal(reportDay('2026-09-30'), '30 Sep 2026');
  assert.equal(reportDay('2026-01-05'), '5 Jan 2026');
  assert.equal(reportDay('FY25'), 'FY25');
  assert.equal(reportDay(undefined), '');
  assert.equal(reportDay(null), '');
});

test('names: the short company, the cap band, the benchmark used and the sector line', () => {
  assert.equal(
    reportShortName('Reliance Industries Limited'),
    'Reliance Industries',
  );
  assert.equal(reportShortName('Infosys'), 'Infosys');
  assert.equal(capBandLabel('large'), 'Large cap');
  assert.equal(capBandLabel('mid'), 'Mid cap');
  assert.equal(capBandLabel('unknown'), '');
  assert.equal(
    reportBenchmark({benchmark: 'NIFTY 50', available: true, checks: []}),
    'NIFTY 50',
  );
  assert.equal(
    reportBenchmark({
      benchmark: 'NIFTY ENERGY',
      available: true,
      checks: [],
      used: {requested: 'NIFTY ENERGY', used: 'NIFTY 50', priced: false},
    }),
    'NIFTY 50',
  );
  assert.equal(
    reportSector({
      name: 'Oil & gas',
      parent: {id: 'e', name: 'Energy', page: ''},
    }),
    'Energy · Oil & gas',
  );
  assert.equal(reportSector({name: 'Oil & gas'}), 'Oil & gas');
  assert.equal(reportSector({}), '');
});

test('citations name each fact the report carries, with its value and day, and skip the rest', () => {
  const index = reportFactIndex(FACTS);
  assert.equal(
    citesLine(index, ['f.roce', 'f.missing', 'f.pe']),
    'Based on ROCE 18.42% (31 Mar 2026) · P/E 24.6x (30 Sep 2026)',
  );
  assert.equal(citesLine(index, ['f.missing']), '');
  assert.equal(citesLine(index, undefined), '');
});

test('a key metric’s gap says what it needs, where it is published, the refresh and a proxy that is one', () => {
  assert.equal(
    kpiGapLine({
      status: 'B',
      label: 'Filings',
      needs: 'Segment revenue',
      sources: ['Annual report', 'Investor deck'],
      proxy: 'None',
      refresh: 'Yearly',
    }),
    'Needs segment revenue. Exchange filings, not yet read: Annual report, Investor deck · Yearly',
  );
  assert.equal(
    kpiGapLine({
      status: 'E',
      label: 'Paid',
      needs: 'Order book',
      sources: ['Vendor'],
      proxy: 'Management commentary',
      refresh: '',
    }),
    'Needs order book. Paid data; free proxy: Vendor · Proxy: Management commentary',
  );
});

test('a watch item’s history table takes the last three periods of the facts that have one', () => {
  const index = reportFactIndex(FACTS);
  const table = historyTable(index, ['f.pe', 'f.roce', 'f.debt']);
  assert.deepEqual(table?.periods, ['FY23', 'FY24', 'FY25']);
  assert.deepEqual(
    table?.rows.map(row => [row.label, ...row.values]),
    [
      ['ROCE', '15.8%', '17.2%', '18.42%'],
      ['Net debt', '820', '−1,240.5'],
    ],
  );
  assert.equal(historyTable(index, ['f.pe']), null);
});

const REPORT = {
  symbol: 'RELIANCE',
  company: 'Reliance Industries Limited',
  industry: 'Oil & gas',
  manual: {name: 'Oil & gas', rev: '3'},
  cap: {
    band: 'large',
    rank: 1,
    ranked_of: 1980,
    mcap_cr: 1_950_000,
    as_of: '2026-09-30',
    rule: '',
    cards: [],
  },
  scorecard: [
    {
      id: 'k1',
      text: 'ROCE above 15%',
      mark: 'pass',
      facts: ['f.roce'],
      note: '',
      name: 'ROCE',
      formula: 'EBIT / capital employed',
      good: '> 15%',
      warn: '< 10%',
      why: '',
      value: 18.42,
      unit: '%',
      period: 'FY25',
    },
    {
      id: 'k2',
      text: 'Order book cover',
      mark: 'not_available',
      facts: [],
      note: '',
      name: 'Order book cover',
      formula: '',
      good: '',
      warn: '',
      why: '',
      gap: {
        status: 'E',
        label: 'Paid',
        needs: 'Order book',
        sources: ['Vendor'],
        proxy: 'None',
        refresh: 'Quarterly',
      },
    },
  ],
  parts: [
    {
      no: '1',
      title: 'Business',
      cards: [
        {
          num: '1.1',
          title: 'Moat',
          checks: [
            {id: 'a', text: 'x', mark: 'pass', facts: [], note: ''},
            {id: 'b', text: 'y', mark: 'not_available', facts: [], note: ''},
            {id: 'c', text: 'z', mark: 'fail', facts: [], note: ''},
          ],
        },
      ],
    },
    {no: '2', cards: []},
  ],
  inversion: {text: '', checks: []},
  stage: {
    benchmark: 'NIFTY 50',
    available: true,
    checks: [],
    result: {
      as_of: '2026-09-30',
      stage: 2,
      confirmed: true,
      close: 2950.5,
      ma50: 2900,
      ma200: 2800,
      conditions: [],
    },
  },
  gate: {
    stop: [],
    go: [],
    summary: {
      stops_hit: ['Promoter pledge'],
      stops_total: 6,
      stops_unchecked: 1,
      go_met: 3,
      go_total: 5,
      go_unchecked: 1,
      go_missed: ['Rising ROCE'],
    },
  },
  data_requirements: [
    {item: 'Quarterly results', served: true},
    {
      item: 'Segment revenue',
      served: false,
      gap: {
        status: 'B',
        label: 'Filings',
        needs: 'Segments',
        sources: ['Annual report'],
        proxy: 'None',
        refresh: 'Yearly',
      },
    },
  ],
  coverage: {items: 40, settled: 30, not_available: 10},
  facts: FACTS,
} satisfies ManualReportPayload;

test('coverage groups every metric and input by where what is missing is published, A first', () => {
  const groups = coverageGroups(REPORT);
  assert.deepEqual(
    groups.map(group => [
      group.status,
      group.rows.map(row => `${row.kind}:${row.name}=${row.have}`),
    ]),
    [
      ['A', ['Metric:ROCE=18.42% · FY25', 'Input:Quarterly results=Served']],
      ['B', ['Input:Segment revenue=']],
      ['E', ['Metric:Order book cover=']],
    ],
  );
  assert.equal(coveragePct(REPORT.coverage), 75);
  assert.equal(coveragePct({items: 0, settled: 0, not_available: 0}), 0);
});

test('the fiscal years come from the figures, the last five, and the figures table fills them', () => {
  const years = fiscalYears([
    ...FACTS,
    {
      key: 'f.old',
      label: 'Sales',
      period: '2026-03-31',
      value: 1,
      history: [
        {period: 'FY19', value: 1},
        {period: 'FY20', value: 1},
        {period: 'FY21', value: 1},
        {period: '2026-03-31', value: 1},
      ],
    },
  ]);
  assert.deepEqual(years, ['FY21', 'FY22', 'FY23', 'FY24', 'FY25']);
  const rows = figureRows(FACTS, fiscalYears(FACTS));
  assert.deepEqual(
    rows.map(row => row.label),
    ['ROCE', 'P/E', 'Net debt'],
  );
  assert.deepEqual(rows[0]?.byYear, ['14.1%', '15.8%', '17.2%', '18.42%']);
  assert.deepEqual(rows[1]?.byYear, ['', '', '', '']);
  assert.equal(rows[1]?.latest, '24.6x');
  assert.equal(rows[1]?.latestDay, '30 Sep 2026');
  assert.equal(rows[2]?.unit, '₹ cr');
  assert.deepEqual(rows[2]?.trail, [820, -1240.5]);
});

test('the summary strip leads with the stage, ROCE and P/E where the report has them, then the gate and coverage', () => {
  const figures = reportKeyFigures(REPORT, reportFactIndex(FACTS));
  assert.deepEqual(
    figures.map(figure => [figure.key, figure.value, figure.detail]),
    [
      ['stage', '2 · Advancing', 'Confirmed'],
      ['roce', '18.42%', '31 Mar 2026'],
      ['pe', '24.6x', 'Today'],
      ['redFlags', '1 of 6', '1 not checked'],
      ['supporting', '3 of 5', '1 not checked'],
      ['coverage', '30 of 40', 'items settled'],
    ],
  );
  const bare = reportKeyFigures(
    {...REPORT, stage: {...REPORT.stage, result: null}, facts: []},
    reportFactIndex([]),
  );
  assert.deepEqual(
    bare.map(figure => figure.key),
    ['redFlags', 'supporting', 'coverage'],
  );
});

test('the gate tally, the parts and the note’s small lists read as the page states them', () => {
  assert.equal(
    gateTally(REPORT.gate.summary),
    '1 of 6 red flags present, 1 not checked · 3 of 5 supporting signs met, 1 not checked · Missed: Rising ROCE · Present: Promoter pledge',
  );
  assert.equal(
    gateTally({...REPORT.gate.summary, stops_hit: [], go_missed: []}),
    '0 of 6 red flags present, 1 not checked · 3 of 5 supporting signs met, 1 not checked',
  );
  assert.deepEqual(REPORT.parts.map(partTitle), [
    'Part 1 · Business',
    'Part 2',
  ]);
  assert.deepEqual(REPORT.parts.map(partTally), [
    {meet: 1, noData: 1},
    {meet: 0, noData: 0},
  ]);
  assert.deepEqual(
    monitorChips({
      takeaway: {why: '', why_not: '', monitor: 'ROCE + Pledge +  Cash flow '},
    } as never),
    ['ROCE', 'Pledge', 'Cash flow'],
  );
  assert.deepEqual(
    riskChainSteps('Oil falls → Margins compress → Capex slows'),
    ['Oil falls', 'Margins compress', 'Capex slows'],
  );
});

test('a gap status reads as its words, or as itself when unknown', () => {
  assert.equal(gapStatusWord('B'), 'Exchange filings, not yet read');
  assert.equal(gapStatusWord('Z'), 'Z');
});

test('a null key metric value is absent: not computed, not covered', () => {
  const nulled = REPORT.scorecard.map(kpi => ({...kpi, value: null}));
  assert.deepEqual(
    nulled.map(kpi => kpiTrail(reportFactIndex(FACTS), kpi)),
    [[], []],
  );
  const groups = coverageGroups({...REPORT, scorecard: nulled});
  assert.deepEqual(
    groups.flatMap(group => group.rows.map(row => row.have)),
    ['', 'Served', '', ''],
  );
});

test('a sparkline needs two values and spans the box', () => {
  assert.equal(sparkPoints([1], 88, 24, 3), null);
  const points = sparkPoints([1, 3, 2], 88, 24, 3);
  assert.deepEqual(points?.[0], [3, 21]);
  assert.deepEqual(points?.[1], [44, 3]);
  assert.deepEqual(points?.[2], [85, 12]);
  // A flat line sits on the floor rather than dividing by zero.
  assert.deepEqual(sparkPoints([2, 2], 88, 24, 3), [
    [3, 21],
    [85, 21],
  ]);
});
