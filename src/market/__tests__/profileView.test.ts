import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  ProfileLevels,
  ProfileRow,
  ProfileScreenStatus,
} from '../../types/marketProfile.ts';
import {
  cvdPath,
  groupScreens,
  ladderMarkers,
  ladderRows,
  latestReading,
  nearestLevels,
  profileInstrumentKey,
  rowContains,
  rowInValue,
  spreadLabels,
  VALUE_POSITION_COPY,
  valuePosition,
} from '../profileView.ts';

const row = (price: number, volume: number, tpo: number): ProfileRow => ({
  price,
  volume,
  tpo,
});

/** Five one-rupee rows, highest first, as the endpoint serves them. */
const ROWS: ProfileRow[] = [
  row(104, 10, 1),
  row(103, 40, 3),
  row(102, 90, 6),
  row(101, 50, 4),
  row(100, 20, 2),
];

// The value-area high is the top edge of its highest row: rows 101 to 103 are in value.
const LEVELS: ProfileLevels = {poc: 102, val: 101, vah: 104};

test('an instrument keys by its symbol, a future by its underlying and month', () => {
  assert.equal(profileInstrumentKey({symbol: 'TCS'}), 'TCS');
  assert.equal(
    profileInstrumentKey({underlying: 'NIFTY', month: '2026-10'}),
    'NIFTY:2026-10',
  );
});

test('a price sits above, inside or below the value area, edges inside', () => {
  assert.equal(valuePosition(104.5, LEVELS), 'above');
  assert.equal(valuePosition(104, LEVELS), 'inside');
  assert.equal(valuePosition(102, LEVELS), 'inside');
  assert.equal(valuePosition(101, LEVELS), 'inside');
  assert.equal(valuePosition(100.95, LEVELS), 'below');
});

test('no price, or a value area with an edge missing, has no position', () => {
  assert.equal(valuePosition(null, LEVELS), null);
  assert.equal(valuePosition(102, {poc: 102, val: null, vah: 104}), null);
  assert.equal(valuePosition(102, {poc: 102, val: 101, vah: null}), null);
  assert.deepEqual(Object.keys(VALUE_POSITION_COPY), [
    'above',
    'inside',
    'below',
  ]);
});

test('setups split by status in the order served, and an unknown status joins no group', () => {
  const screen = (id: string, status: string) => ({
    id,
    status: status as ProfileScreenStatus,
  });
  const screens = [
    screen('va_breakout', 'none'),
    screen('poc_reclaim', 'triggered'),
    screen('absorption', 'insufficient'),
    screen('rising_value', 'triggered'),
    screen('later', 'pending'),
    screen('distribution', 'none'),
  ];
  const {triggered, quiet, waiting} = groupScreens(screens);
  assert.deepEqual(
    triggered.map(s => s.id),
    ['poc_reclaim', 'rising_value'],
  );
  assert.deepEqual(
    quiet.map(s => s.id),
    ['va_breakout', 'distribution'],
  );
  assert.deepEqual(
    waiting.map(s => s.id),
    ['absorption'],
  );
  assert.deepEqual(groupScreens([]), {triggered: [], quiet: [], waiting: []});
});

test('a ladder within its cap keeps every row and gives each its top edge on the price grid', () => {
  const ladder = ladderRows(ROWS, 1, 80);
  assert.deepEqual(
    ladder.map(r => [r.price, r.top, r.volume, r.tpo]),
    [
      [104, 105, 10, 1],
      [103, 104, 40, 3],
      [102, 103, 90, 6],
      [101, 102, 50, 4],
      [100, 101, 20, 2],
    ],
  );
  // 100.1 + 0.05 is 100.14999999999999 in floating point; the edge is the price the grid has.
  assert.equal(ladderRows([row(100.1, 1, 1)], 0.05, 80)[0]?.top, 100.15);
  assert.deepEqual(ladderRows([], 1, 80), []);
});

test('a ladder past its cap sums neighbours, each bucket from its lowest price to its highest top', () => {
  // Five rows into at most two: buckets of three.
  assert.deepEqual(ladderRows(ROWS, 1, 2), [
    {price: 102, top: 105, volume: 140, tpo: 10},
    {price: 100, top: 102, volume: 70, tpo: 6},
  ]);
  // Exactly at the cap nothing is merged.
  assert.equal(ladderRows(ROWS, 1, 5).length, 5);
  assert.equal(ladderRows(ROWS, 1, 4).length, 3);
});

test('a row holds a price from its lower edge up to, not including, its top', () => {
  const [top] = ladderRows(ROWS, 1, 80);
  assert.ok(top);
  assert.equal(rowContains(top, 104), true);
  assert.equal(rowContains(top, 104.99), true);
  assert.equal(rowContains(top, 105), false);
  assert.equal(rowContains(top, 103.99), false);
  assert.equal(rowContains(top, null), false);
});

test('a row is in value when it lies wholly between the value-area edges', () => {
  const ladder = ladderRows(ROWS, 1, 80);
  assert.deepEqual(
    ladder.map(r => rowInValue(r, LEVELS)),
    [false, true, true, true, false],
  );
  assert.deepEqual(
    ladder.map(r => rowInValue(r, {poc: null, val: null, vah: null})),
    [false, false, false, false, false],
  );
});

test('the nearest levels to the price come back highest first, the input untouched', () => {
  const levels = [98, 120, 101.5, 110, 104];
  assert.deepEqual(nearestLevels(levels, 102, 3), [104, 101.5, 98]);
  assert.deepEqual(nearestLevels(levels, 102, 9), [120, 110, 104, 101.5, 98]);
  assert.deepEqual(levels, [98, 120, 101.5, 110, 104]);
  assert.deepEqual(nearestLevels([], 102, 3), []);
});

test('without a price the first levels served are taken, highest first', () => {
  const levels = [98, 120, 101.5, 110, 104];
  assert.deepEqual(nearestLevels(levels, null, 3), [120, 101.5, 98]);
  assert.deepEqual(levels, [98, 120, 101.5, 110, 104]);
});

test('the latest reading is the newest minute that has one', () => {
  const minutes = [{di: 0.2}, {di: -0.31}, {di: null}, {di: null}];
  assert.equal(
    latestReading(minutes, m => m.di),
    -0.31,
  );
  assert.equal(
    latestReading([{di: null}], m => m.di),
    null,
  );
  assert.equal(
    latestReading([] as {di: number | null}[], m => m.di),
    null,
  );
  // Zero is a reading: a balanced book, not a missing one.
  assert.equal(
    latestReading([{di: 0.4}, {di: 0}], m => m.di),
    0,
  );
});

test('markers name the rows the levels and the last price fall in, the value high inside its own row', () => {
  const ladder = ladderRows(ROWS, 1, 80);
  assert.deepEqual(ladderMarkers(ladder, LEVELS, 102.4, 1), [
    {index: 1, price: 103, tags: ['VAH']},
    {index: 2, price: 102, tags: ['POC', 'LTP']},
    {index: 3, price: 101, tags: ['VAL']},
  ]);
});

test('levels sharing a row share one marker, and what is absent or off the ladder has none', () => {
  const ladder = ladderRows(ROWS, 1, 80);
  assert.deepEqual(
    ladderMarkers(ladder, {poc: 100, val: 100, vah: 101}, 100.5, 1),
    [{index: 4, price: 100, tags: ['VAH', 'POC', 'VAL', 'LTP']}],
  );
  assert.deepEqual(
    ladderMarkers(ladder, {poc: null, val: null, vah: null}, null, 1),
    [],
  );
  assert.deepEqual(
    ladderMarkers(ladder, {poc: null, val: null, vah: null}, 250, 1),
    [],
  );
  assert.deepEqual(ladderMarkers([], LEVELS, 102, 1), []);
});

test('labels keep their centres when they have room', () => {
  assert.deepEqual(spreadLabels([10, 150, 300], 14, 320), [10, 150, 300]);
  assert.deepEqual(spreadLabels([], 14, 320), []);
});

test('crowded labels are pushed apart by the gap and held inside the ladder', () => {
  // Pushed down off each other.
  assert.deepEqual(spreadLabels([10, 12, 300], 14, 320), [10, 24, 300]);
  // Pushed back up off the floor: the last centre stops half a gap short of the height.
  assert.deepEqual(spreadLabels([310, 315, 318], 14, 320), [285, 299, 313]);
  // And off the ceiling.
  assert.deepEqual(spreadLabels([2], 14, 320), [7]);
});

test('the delta path runs the width, the highest value at the top of the box', () => {
  assert.equal(cvdPath([0, 10], 100, 50), 'M0.0,50.0 L100.0,0.0');
  assert.equal(
    cvdPath([-20, 20, 0], 320, 56),
    'M0.0,56.0 L160.0,0.0 L320.0,28.0',
  );
  // A flat series has no span to scale by: it draws along the floor.
  assert.equal(cvdPath([5, 5, 5], 100, 50), 'M0.0,50.0 L50.0,50.0 L100.0,50.0');
});

test('fewer than two values draw no path', () => {
  assert.equal(cvdPath([], 100, 50), '');
  assert.equal(cvdPath([42], 100, 50), '');
});
