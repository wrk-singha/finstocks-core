import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {WorldIndexRow} from '../../api/market.ts';
import {
  barsForIndex,
  type IndexBar,
  INDEX_WINDOWS,
  marketForIndex,
  windowAdvances,
  windowChange,
  windowDays,
  windowRange,
} from '../worldIndexDetail.ts';

const row = (
  indexId: number,
  date: string,
  close: number,
  fields: Partial<WorldIndexRow> = {},
): WorldIndexRow => ({
  index_id: indexId,
  index_symbol: '',
  index_name: '',
  country: '',
  date,
  open: close - 1,
  high: close + 2,
  low: close - 3,
  close,
  volume: 0,
  adj_close: close,
  updated_at: date,
  ...fields,
});

const bar = (close: number, fields: Partial<IndexBar> = {}): IndexBar => ({
  date: '2026-09-24',
  open: close,
  high: close,
  low: close,
  close,
  ...fields,
});

test('the four windows and their day counts', () => {
  assert.deepEqual(
    INDEX_WINDOWS.map(window => [window.value, window.label, window.days]),
    [
      ['1m', '1M', 30],
      ['3m', '3M', 92],
      ['6m', '6M', 183],
      ['1y', '1Y', 365],
    ],
  );
  assert.equal(windowDays('3m'), 92);
  assert.equal(windowDays('1y'), 365);
});

test("one index's bars, oldest first, with a zero OHLC read as the close", () => {
  const bars = barsForIndex(
    [
      row(26, '2026-09-24', 6700, {open: 0, high: Number.NaN, low: -1}),
      row(12, '2026-09-23', 23_600),
      row(26, '2026-09-22', 6600),
      row(26, '2026-09-23', 0),
    ],
    26,
  );
  assert.deepEqual(bars, [
    {date: '2026-09-22', open: 6599, high: 6602, low: 6597, close: 6600},
    {date: '2026-09-24', open: 6700, high: 6700, low: 6700, close: 6700},
  ]);
  assert.deepEqual(barsForIndex([], 26), []);
});

test("the summary is that index's row of the table, or null", () => {
  const rows = [
    row(26, '2026-09-23', 6650, {
      index_name: 'S&P 500',
      index_symbol: '^GSPC',
      country: 'US',
    }),
    row(26, '2026-09-24', 6700),
  ];
  assert.equal(marketForIndex(rows, 26)?.name, 'S&P 500');
  assert.equal(marketForIndex(rows, 26)?.close, 6700);
  assert.equal(marketForIndex(rows, 13), null);
});

test("the window's return runs first close to last", () => {
  assert.deepEqual(windowChange([]), {change: 0, changePct: null});
  assert.deepEqual(windowChange([bar(100)]), {change: 0, changePct: null});
  assert.deepEqual(windowChange([bar(100), bar(120), bar(110)]), {
    change: 10,
    changePct: 10,
  });
  assert.deepEqual(windowChange([bar(0), bar(5)]), {
    change: 5,
    changePct: null,
  });
});

test("the window's range spans every bar's high and low", () => {
  assert.equal(windowRange([]), null);
  assert.deepEqual(
    windowRange([
      bar(100, {high: 104, low: 97}),
      bar(110, {high: 112, low: 99}),
      bar(105, {high: 108, low: 95}),
    ]),
    {high: 112, low: 95},
  );
});

test('advances count the sessions that closed above the one before', () => {
  assert.equal(windowAdvances([]), null);
  assert.equal(windowAdvances([bar(100)]), null);
  assert.deepEqual(
    windowAdvances([bar(100), bar(101), bar(101), bar(100.5), bar(102)]),
    {up: 2, sessions: 4},
  );
});
