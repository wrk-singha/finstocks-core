import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {WorldIndexRow} from '../../api/market.ts';
import {
  buildWorldMarkets,
  byRowDate,
  formatIndexLevel,
  globalIndexNameFromParam,
  globalIndexParam,
  globalIndexPath,
  groupByRegion,
  latestWorldClose,
  parseGlobalIndexParam,
  REGION_ORDER,
} from '../worldIndices.ts';

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
  open: close,
  high: close,
  low: close,
  close,
  volume: 0,
  adj_close: close,
  updated_at: date,
  ...fields,
});

const named = (name: string, symbol: string, country: string) => ({
  index_name: name,
  index_symbol: symbol,
  country,
});

test('identity comes from an older named row when the newest rows are blank', () => {
  const [spx] = buildWorldMarkets([
    row(26, '2026-09-24', 6700, {high: 6720, low: 6640}),
    row(26, '2026-09-22', 6600, named('S&P 500', '^GSPC', 'US')),
    row(26, '2026-09-23', 6650),
  ]);
  assert.ok(spx);
  assert.equal(spx.indexId, 26);
  assert.equal(spx.name, 'S&P 500');
  assert.equal(spx.symbol, '^GSPC');
  assert.equal(spx.country, 'United States');
  assert.equal(spx.region, 'Americas');
  assert.equal(spx.close, 6700);
  assert.equal(spx.high, 6720);
  assert.equal(spx.low, 6640);
  assert.equal(spx.change, 50);
  assert.equal(spx.changePct, (50 / 6650) * 100);
  assert.equal(spx.asOf, '2026-09-24');
  // Rebased to the window's first close, oldest first.
  assert.deepEqual(spx.series, [0, 50, 100]);
});

test('a window with no name anywhere is dropped rather than shown blank', () => {
  const rows = buildWorldMarkets([
    row(9, '2026-09-23', 100),
    row(9, '2026-09-24', 101, {index_name: '  '}),
  ]);
  assert.deepEqual(rows, []);
});

test("the vendor's country strings become a label and a region", () => {
  const rows = buildWorldMarkets([
    row(40, '2026-09-24', 61_000, named('IPC Mexico', '^MXX', 'Mexican')),
    row(41, '2026-09-24', 1_300, named('VN Index', '^VNI', 'Vietnam')),
  ]);
  const mexico = rows.find(item => item.indexId === 40);
  const vietnam = rows.find(item => item.indexId === 41);
  assert.equal(mexico?.country, 'Mexico');
  assert.equal(mexico?.region, 'Americas');
  // Unlisted countries still appear, under Asia Pacific with the raw label.
  assert.equal(vietnam?.country, 'Vietnam');
  assert.equal(vietnam?.region, 'Asia Pacific');
});

test('a zero or missing high and low read as the close, and zero closes are skipped', () => {
  const [dax] = buildWorldMarkets([
    row(12, '2026-09-23', 0, named('DAX', '^GDAXI', 'Germany')),
    row(12, '2026-09-24', 23_600, {high: 0, low: Number.NaN}),
  ]);
  assert.ok(dax);
  assert.equal(dax.name, 'DAX');
  assert.equal(dax.high, 23_600);
  assert.equal(dax.low, 23_600);
  // The zero close is not a session, so there is no prior close to measure against.
  assert.equal(dax.change, 0);
  assert.equal(dax.changePct, null);
  assert.deepEqual(dax.series, [0]);
});

test('rows run region by region, biggest mover first within each', () => {
  const rows = buildWorldMarkets([
    row(1, '2026-09-23', 100, named('Nikkei 225', '^N225', 'Japan')),
    row(1, '2026-09-24', 103),
    row(2, '2026-09-23', 100, named('FTSE 100', '^FTSE', 'UK')),
    row(2, '2026-09-24', 99),
    row(3, '2026-09-23', 100, named('Dow Jones', '^DJI', 'US')),
    row(3, '2026-09-24', 100.5),
    row(4, '2026-09-23', 100, named('Nasdaq', '^IXIC', 'US')),
    row(4, '2026-09-24', 98),
  ]);
  assert.deepEqual(
    rows.map(item => item.name),
    ['Nasdaq', 'Dow Jones', 'FTSE 100', 'Nikkei 225'],
  );
});

test('groups follow the region order and leave out empty regions', () => {
  const rows = buildWorldMarkets([
    row(1, '2026-09-24', 100, named('Nikkei 225', '^N225', 'Japan')),
    row(3, '2026-09-24', 100, named('Dow Jones', '^DJI', 'US')),
  ]);
  const groups = groupByRegion(rows);
  assert.deepEqual(REGION_ORDER, ['Americas', 'Europe', 'Asia Pacific']);
  assert.deepEqual(
    groups.map(group => [group.region, group.rows.map(item => item.name)]),
    [
      ['Americas', ['Dow Jones']],
      ['Asia Pacific', ['Nikkei 225']],
    ],
  );
  assert.deepEqual(groupByRegion([]), []);
});

test('the table is dated by the newest close any row carries', () => {
  const rows = buildWorldMarkets([
    row(1, '2026-09-24', 100, named('Nikkei 225', '^N225', 'Japan')),
    row(3, '2026-09-23', 100, named('Dow Jones', '^DJI', 'US')),
  ]);
  assert.equal(latestWorldClose(rows), '2026-09-24');
  assert.equal(latestWorldClose([]), null);
});

test('rows sort oldest first by their ISO date', () => {
  const dates = ['2026-09-24', '2025-12-31', '2026-09-03', '2026-09-24'].map(
    date => ({date}),
  );
  assert.deepEqual(
    [...dates].sort(byRowDate).map(item => item.date),
    ['2025-12-31', '2026-09-03', '2026-09-24', '2026-09-24'],
  );
});

test('levels drop their decimals from ten thousand up', () => {
  assert.equal(formatIndexLevel(1686.4), '1,686.40');
  assert.equal(formatIndexLevel(9_500.25), '9,500.25');
  assert.equal(formatIndexLevel(10_000), '10,000');
  assert.equal(formatIndexLevel(187_206.4), '1,87,206');
});

test('a benchmark is addressed by a readable slug that ends in its id', () => {
  assert.equal(globalIndexParam(26, 'S&P 500'), 's-p-500-26');
  assert.equal(globalIndexParam(26), '26');
  assert.equal(globalIndexParam(13, ' — '), '13');
  assert.equal(globalIndexPath(26, 'S&P 500'), '/indices/global/s-p-500-26');
  assert.equal(globalIndexPath(13), '/indices/global/13');
});

test('the id is read off the last run of digits, slugged or bare', () => {
  assert.equal(parseGlobalIndexParam('s-p-500-26'), 26);
  assert.equal(parseGlobalIndexParam('26'), 26);
  assert.equal(parseGlobalIndexParam(' 26 '), 26);
  assert.equal(parseGlobalIndexParam('nikkei-225-7'), 7);
  assert.equal(parseGlobalIndexParam('dax'), null);
  assert.equal(parseGlobalIndexParam('0'), null);
  assert.equal(parseGlobalIndexParam(''), null);
  assert.equal(parseGlobalIndexParam(undefined), null);
  for (const [id, name] of [
    [26, 'S&P 500'],
    [7, 'Nikkei 225'],
    [3, 'FTSE Bursa Malaysia KLCI'],
  ] as const) {
    assert.equal(parseGlobalIndexParam(globalIndexParam(id, name)), id);
  }
});

test('the name is read back out of the slug for the header while loading', () => {
  assert.equal(globalIndexNameFromParam('s-p-500-26'), 'S P 500');
  assert.equal(globalIndexNameFromParam('nikkei-225-7'), 'Nikkei 225');
  assert.equal(globalIndexNameFromParam('26'), null);
  assert.equal(globalIndexNameFromParam(''), null);
  assert.equal(globalIndexNameFromParam(undefined), null);
});
