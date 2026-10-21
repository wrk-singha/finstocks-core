import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {RsColumn, RsSectorMatrix} from '../../types/rsSectorMatrix.ts';
import {
  beatingBenchmark,
  indexName,
  lossesAt,
  pfExtent,
  pfLastColumnBoxes,
  pfRatioChange,
  pfSpans,
  pickRow,
  resolvePair,
  resultsAt,
  rsShortLabel,
  splitResults,
  staleDays,
} from '../rsSectorMatrix.ts';
import {
  parseSectorStrengthPath,
  sectorStrengthPath,
} from '../sectorStrength.ts';

/** Three indices as the backend ranks them: IT beats both, NIFTY beats Pharma, Pharma beats none. */
const matrix: RsSectorMatrix = {
  as_of: '2026-10-05',
  box_pct: 0.25,
  reversal: 3,
  lookback_years: 2,
  stale: [
    {symbol: 'NIFTYMETAL', name: 'Metal', last_day: '2026-10-01'},
    {symbol: 'NIFTYREALTY', name: 'Realty', last_day: '2026-10-01'},
  ],
  missing: [{symbol: 'NIFTYESG', name: 'ESG'}],
  indices: [
    {symbol: 'NIFTYIT', name: 'IT', score: 2},
    {symbol: 'NIFTY', name: '50', score: 1},
    {symbol: 'NIFTYPHARMA', name: 'Pharma', score: 0},
  ],
  matrix: [
    [0, 1, 1],
    [-1, 0, 1],
    [-1, -1, 0],
  ],
  latest_flip: {leader: 'NIFTYIT', laggard: 'NIFTY', day: '2026-10-02'},
};

test('a row is read against every other index, by name', () => {
  assert.equal(indexName(matrix, 'NIFTYPHARMA'), 'Pharma');
  assert.equal(indexName(matrix, 'UNKNOWN'), 'UNKNOWN');
  assert.deepEqual(
    resultsAt(matrix, 1).map(r => [r.index.symbol, r.dir]),
    [
      ['NIFTYIT', -1],
      ['NIFTYPHARMA', 1],
    ],
  );
  assert.deepEqual(
    splitResults(matrix, 'NIFTY').beats.map(ix => ix.symbol),
    ['NIFTYPHARMA'],
  );
  assert.deepEqual(
    splitResults(matrix, 'NIFTY').losesTo.map(ix => ix.symbol),
    ['NIFTYIT'],
  );
  assert.deepEqual(splitResults(matrix, 'NOPE'), {beats: [], losesTo: []});
  assert.equal(lossesAt(matrix, 2), 2);
  assert.equal(lossesAt(matrix, 0), 0);
});

test('the summary counts sectors beating the benchmark, or says it is absent', () => {
  assert.equal(beatingBenchmark(matrix), 1);
  assert.equal(beatingBenchmark(matrix, 'NIFTYPHARMA'), 2);
  assert.equal(beatingBenchmark(matrix, 'INDIAVIX'), null);
});

test('column headings take the short form, else the symbol tail', () => {
  assert.equal(rsShortLabel('NIFTY'), 'N50');
  assert.equal(rsShortLabel('BANKNIFTY'), 'BANK');
  assert.equal(rsShortLabel('NIFTYIT'), 'IT');
  assert.equal(rsShortLabel('NIFTYCONSUMPTION'), 'CONSU');
  assert.equal(rsShortLabel('SENSEX'), 'SENSE');
});

test('the selected pair resolves against the data: leader vs laggard by default', () => {
  assert.deepEqual(resolvePair(matrix, {row: null, col: null}), {
    row: 'NIFTYIT',
    col: 'NIFTYPHARMA',
  });
  assert.deepEqual(resolvePair(matrix, {row: 'NIFTY', col: 'NIFTYIT'}), {
    row: 'NIFTY',
    col: 'NIFTYIT',
  });
  // An unknown column, or the row itself, falls back to the opposite end.
  assert.deepEqual(resolvePair(matrix, {row: 'NIFTY', col: 'NOPE'}), {
    row: 'NIFTY',
    col: 'NIFTYPHARMA',
  });
  assert.deepEqual(
    resolvePair(matrix, {row: 'NIFTYPHARMA', col: 'NIFTYPHARMA'}),
    {row: 'NIFTYPHARMA', col: 'NIFTYIT'},
  );
  assert.deepEqual(pickRow(matrix, 'NIFTY', 'NIFTYIT'), {
    row: 'NIFTY',
    col: 'NIFTYIT',
  });
  assert.deepEqual(pickRow(matrix, 'NIFTYIT', 'NIFTYIT'), {
    row: 'NIFTYIT',
    col: 'NIFTYPHARMA',
  });
});

const columns: RsColumn[] = [
  {dir: 1, from: 1.0, to: 1.02, start: '2026-09-01', end: '2026-09-10'},
  {dir: -1, from: 1.02, to: 1.0075, start: '2026-09-11', end: '2026-09-20'},
  {dir: 1, from: 1.0075, to: 1.01, start: '2026-09-21', end: '2026-10-05'},
];

test('P&F columns are laid out in log boxes, each starting one box past its reversal', () => {
  const spans = pfSpans(columns, 0.25);
  // 0.25% boxes: 1.00 is level 0, 1.02 is level 8, 1.0075 is level 3, 1.01 is level 4.
  assert.deepEqual(spans, [
    {dir: 1, lo: 1, hi: 8},
    {dir: -1, lo: 3, hi: 7},
    {dir: 1, lo: 4, hi: 4},
  ]);
  assert.deepEqual(pfExtent(spans), {lo: 1, hi: 8});
  // A column whose end rounds to its start still fills one box.
  assert.deepEqual(
    pfSpans(
      [{dir: 1, from: 1, to: 1.0001, start: '2026-01-01', end: '2026-01-01'}],
      0.25,
    ),
    [{dir: 1, lo: 1, hi: 1}],
  );
});

test('the pair facts: boxes in the last column and the ratio move since it began', () => {
  assert.equal(pfLastColumnBoxes(columns[2], 0.25), 1);
  assert.equal(pfLastColumnBoxes(columns[0], 0.25), 8);
  assert.equal(pfLastColumnBoxes(undefined, 0.25), 0);
  const change = pfRatioChange(columns[2], 1.012);
  assert.ok(change !== null && Math.abs(change - 0.4466) < 0.001);
  assert.equal(pfRatioChange(undefined, 1), null);
});

test('data notes collapse stale days', () => {
  assert.deepEqual(staleDays(matrix.stale), ['2026-10-01']);
});

test('the sector-strength link round-trips a pair and reads only its own path', () => {
  assert.equal(
    sectorStrengthPath({row: 'NIFTYIT', col: 'NIFTY'}),
    '/market?rs=NIFTYIT&vs=NIFTY#sector-strength',
  );
  assert.equal(sectorStrengthPath(), '/market#sector-strength');
  assert.deepEqual(
    parseSectorStrengthPath('/market?rs=NIFTYIT&vs=NIFTY#sector-strength'),
    {tab: 'stocks', row: 'NIFTYIT', col: 'NIFTY'},
  );
  assert.deepEqual(parseSectorStrengthPath('/market#sector-strength'), {
    tab: 'stocks',
    row: null,
    col: null,
  });
  assert.deepEqual(
    parseSectorStrengthPath('/market/fno?rs=BANKNIFTY#sector-strength'),
    {tab: 'fno', row: 'BANKNIFTY', col: null},
  );
  assert.equal(parseSectorStrengthPath('/market?rs=NIFTYIT&vs=NIFTY'), null);
  assert.equal(parseSectorStrengthPath('/portfolio#sector-strength'), null);
  assert.equal(parseSectorStrengthPath('/market#other'), null);
});
