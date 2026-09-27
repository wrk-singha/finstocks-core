import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {PeerColumn, PeerRow} from '../../types/industries.ts';
import {
  industryCrumbs,
  narrowPeerColumnsForPhone,
  PEER_COMPARE_COLUMNS,
  PEER_COMPARE_SECTIONS,
  peerCompareBars,
  peerComparePair,
  peerCompareTally,
  peerCompareWinner,
  peerPinnedFrom,
} from '../peerTable.ts';

const row = (
  symbol: string,
  values: Record<string, number | undefined> = {},
): PeerRow => ({symbol, ticker: symbol, name: symbol, values});

test('a company ranked below the page is the row after it', () => {
  const ranked = Array.from({length: 10}, (_, i) => row(`S${String(i)}`));
  assert.equal(peerPinnedFrom({rows: ranked, per_page: 10}), null);
  assert.equal(
    peerPinnedFrom({rows: [...ranked, row('SELF')], per_page: 10}),
    10,
  );
  assert.equal(peerPinnedFrom({rows: ranked.slice(0, 6), per_page: 10}), null);
});

test('a sector repeating its macro sector is dropped from the path', () => {
  const crumb = (id: string, name: string, level: number) => ({
    id,
    name,
    level,
  });
  assert.deepEqual(
    industryCrumbs([
      crumb('healthcare', 'Healthcare', 1),
      crumb('healthcare/healthcare', 'Healthcare', 2),
      crumb('healthcare/healthcare/pharma', 'Pharmaceuticals', 3),
      crumb('healthcare/healthcare/pharma/pharma', 'Pharmaceuticals', 4),
    ]).map(c => c.id),
    ['healthcare', 'healthcare/healthcare/pharma'],
  );
  const energy = [
    crumb('energy', 'Energy', 1),
    crumb('energy/oil', 'Oil, Gas & Consumable Fuels', 2),
  ];
  assert.deepEqual(industryCrumbs(energy), energy);
  assert.deepEqual(industryCrumbs([]), []);
});

test('a phone keeps four columns, the preferred ones first when chosen', () => {
  const defaults = [
    'price',
    'pe',
    'market_cap',
    'dividend_yield',
    'np_qtr',
    'qtr_profit_var',
    'sales_qtr',
    'qtr_sales_var',
    'roce',
  ];
  assert.deepEqual(narrowPeerColumnsForPhone(defaults), [
    'price',
    'pe',
    'market_cap',
    'roce',
  ]);
  assert.deepEqual(
    narrowPeerColumnsForPhone(['roe', 'roce', 'sales', 'price', 'pat']),
    ['price', 'roce', 'roe', 'sales'],
  );
  assert.deepEqual(
    narrowPeerColumnsForPhone(['roe', 'sales', 'pat', 'opm', 'peg']),
    ['roe', 'sales', 'pat', 'opm'],
  );
  assert.deepEqual(narrowPeerColumnsForPhone(['pe', 'roe']), ['pe', 'roe']);
});

test('the comparison asks for every line of every section, once', () => {
  assert.deepEqual(
    PEER_COMPARE_SECTIONS.map(section => section.id),
    ['valuation', 'growth', 'quality', 'safety', 'size', 'returns'],
  );
  assert.equal(PEER_COMPARE_COLUMNS.length, 22);
  assert.equal(new Set(PEER_COMPARE_COLUMNS).size, 22);
});

test('the pair keeps the order it was asked in, whatever order the server sent', () => {
  const infy = row('INFY');
  const tcs = row('TCS');
  assert.deepEqual(peerComparePair([infy, tcs], ['TCS', 'INFY']), [tcs, infy]);
  assert.deepEqual(peerComparePair([tcs, infy], ['tcs', 'infy']), [tcs, infy]);
  // Symbols the rows do not carry fall back to the server's order.
  assert.deepEqual(peerComparePair([tcs, infy], ['X', 'Y']), [tcs, infy]);
  assert.equal(peerComparePair([tcs], ['TCS', 'INFY']), null);
  assert.equal(peerComparePair([tcs, infy, row('HCL')], ['TCS', 'INFY']), null);
});

test('a line goes to the side its column favours, and to nobody otherwise', () => {
  assert.equal(peerCompareWinner(24, 29, {better: -1}), 0);
  assert.equal(peerCompareWinner(24, 29, {better: 1}), 1);
  assert.equal(peerCompareWinner(24, 24, {better: 1}), null);
  assert.equal(peerCompareWinner(24, 29, {better: 0}), null);
  assert.equal(peerCompareWinner(undefined, 29, {better: 1}), null);
  assert.equal(peerCompareWinner(24, null, {better: 1}), null);
});

test('the tally counts only lines with a direction and both figures', () => {
  const columns = new Map<string, Pick<PeerColumn, 'better'>>([
    ['pe', {better: -1}],
    ['roce', {better: 1}],
    ['roe', {better: 1}],
    ['market_cap', {better: 0}],
    ['return_1y', {better: 1}],
  ]);
  const pair: [PeerRow, PeerRow] = [
    row('RELIANCE', {pe: 24.6, roce: 10.1, roe: 9.4, market_cap: 1732000}),
    row('INFY', {
      pe: 23.4,
      roce: 38.5,
      roe: 31.7,
      market_cap: 620000,
      return_1y: -8.5,
    }),
  ];
  assert.deepEqual(peerCompareTally(pair, columns), [0, 3]);
  // `dividend_yield` has figures on both sides but no catalogue entry, so it counts for neither.
  pair[0].values.dividend_yield = 0.78;
  pair[1].values.dividend_yield = 2.6;
  assert.deepEqual(peerCompareTally(pair, columns), [0, 3]);
  assert.deepEqual(peerCompareTally(pair, new Map()), [0, 0]);
});

test('each line is scaled to its own larger figure, with a sliver for the tiny ones', () => {
  assert.deepEqual(peerCompareBars(50, 100), [
    {pct: 50, isNegative: false},
    {pct: 100, isNegative: false},
  ]);
  assert.deepEqual(peerCompareBars(-20, 10), [
    {pct: 100, isNegative: true},
    {pct: 50, isNegative: false},
  ]);
  assert.deepEqual(peerCompareBars(0.1, 1000), [
    {pct: 2, isNegative: false},
    {pct: 100, isNegative: false},
  ]);
  assert.deepEqual(peerCompareBars(undefined, 4), [
    null,
    {pct: 100, isNegative: false},
  ]);
  assert.deepEqual(peerCompareBars(0, 0), [
    {pct: 2, isNegative: false},
    {pct: 2, isNegative: false},
  ]);
});
