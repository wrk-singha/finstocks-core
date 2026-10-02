import assert from 'node:assert/strict';
import {test} from 'node:test';

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
