import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  INDIAN_INDICES,
  isIndexSymbol,
  nifty100Stocks,
} from '../../data/stocksData.ts';
import {
  matchesStockQuery,
  rankStocksByQuery,
  stockSearchScore,
} from '../stockSearch.ts';

const RELIANCE = {symbol: 'RELIANCE', name: 'Reliance Industries'};
const MM = {symbol: 'M&M', name: 'Mahindra & Mahindra'};
const TCS = {symbol: 'TCS', name: 'Tata Consultancy Services'};
const stocks = [RELIANCE, MM, TCS, {symbol: 'TATASTEEL', name: 'Tata Steel'}];

test('symbol prefix outranks name matches, which outrank fuzzy hits', () => {
  assert.equal(stockSearchScore(RELIANCE, 'rel'), 13);
  assert.equal(stockSearchScore(TCS, 'consultancy'), 7);
  assert.equal(stockSearchScore(TCS, 'tata'), 8);
  assert.equal(stockSearchScore(RELIANCE, 'relaince'), 1);
  assert.equal(stockSearchScore(RELIANCE, ''), 1);
  assert.equal(stockSearchScore(RELIANCE, 'xyz'), 0);
});

test('the symbol typed in full outranks every symbol that only starts with it', () => {
  assert.equal(stockSearchScore(TCS, 'tcs'), 14);
  assert.equal(stockSearchScore(TCS, ' TCS '), 14);
  // Compared as the search normalises both, so the separators do not matter.
  assert.equal(stockSearchScore(MM, 'm&m'), 14);
  assert.equal(stockSearchScore(MM, 'm m'), 14);
  // A prefix is still a prefix, and a name typed in full is not a symbol.
  assert.equal(stockSearchScore(TCS, 'tc'), 13);
  assert.equal(
    stockSearchScore({symbol: 'BSE100', name: 'BSE 100'}, 'bse'),
    13,
  );
  assert.equal(stockSearchScore({symbol: 'XYZ', name: 'TCS'}, 'tcs'), 8);

  // The listed company sits after the indices in every search list; typed in
  // full it leads them, and the indices keep their own order behind it.
  const listed = [
    {symbol: 'BSE100', name: 'BSE 100'},
    {symbol: 'BSE200', name: 'BSE 200'},
    {symbol: 'SENSEX', name: 'BSE SENSEX'},
    {symbol: 'BSE', name: 'BSE'},
  ];
  assert.deepEqual(
    rankStocksByQuery(listed, 'bse').map(s => s.symbol),
    ['BSE', 'BSE100', 'BSE200', 'SENSEX'],
  );
  // One character on, the company is no longer what was typed.
  assert.equal(rankStocksByQuery(listed, 'bse1')[0]?.symbol, 'BSE100');
});

test('over the lists the apps search, "bse" is the listed company and "nifty" the index', () => {
  // Indices lead the list, so on a tie the 24 BSE-prefixed index symbols came
  // first and the company itself sat under them.
  const searchable = [
    ...INDIAN_INDICES,
    ...nifty100Stocks.filter(stock => !isIndexSymbol(stock.symbol)),
  ];
  const bse = rankStocksByQuery(searchable, 'bse').map(s => s.symbol);
  assert.equal(bse[0], 'BSE');
  assert.equal(bse[1], 'BSE100');
  assert.equal(rankStocksByQuery(searchable, 'nifty')[0]?.symbol, 'NIFTY');
  assert.equal(rankStocksByQuery(searchable, 'sensex')[0]?.symbol, 'SENSEX');
});

test('separators are normalised so "m&m" and "m m" both match', () => {
  assert.equal(matchesStockQuery(MM, 'm&m'), true);
  assert.equal(matchesStockQuery(MM, 'm m'), true);
  assert.equal(matchesStockQuery(MM, 'mahindra'), true);
});

test('ranking is by score with the curated order preserved on ties', () => {
  assert.deepEqual(
    rankStocksByQuery(stocks, 'tata').map(s => s.symbol),
    ['TATASTEEL', 'TCS'],
  );
  assert.deepEqual(
    rankStocksByQuery(stocks, '').map(s => s.symbol),
    stocks.map(s => s.symbol),
  );
  assert.deepEqual(rankStocksByQuery(stocks, 'zzz'), []);
});
