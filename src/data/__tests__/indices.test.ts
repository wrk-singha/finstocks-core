import assert from 'node:assert/strict';
import {test} from 'node:test';

import {COMMODITIES} from '../commodities.ts';
import {
  BSE_HEADLINE,
  BSE_INDICES,
  displayName,
  exchangeOf,
  INDIAN_INDICES,
  isIndexSymbol,
  NIFTY100_SYMBOLS,
  NSE_INDICES,
} from '../stocksData.ts';

test('the BSE list is the 78 indices the scraper writes, each symbol once', () => {
  const symbols = BSE_INDICES.map(index => index.symbol);
  assert.equal(symbols.length, 78);
  assert.equal(new Set(symbols).size, symbols.length);
  assert.equal(symbols[0], 'SENSEX');
  assert.ok(BSE_INDICES.every(index => index.name.startsWith('BSE ')));
});

test('a BSE symbol is no NSE index, no listed equity and no MCX contract', () => {
  // A shared symbol would turn that equity into an index everywhere
  // `isIndexSymbol` is asked, and relabel it BSE.
  const taken = new Set([
    ...NSE_INDICES.map(index => index.symbol),
    ...NIFTY100_SYMBOLS,
    ...COMMODITIES.map(commodity => commodity.symbol),
  ]);
  assert.deepEqual(
    BSE_INDICES.filter(index => taken.has(index.symbol)),
    [],
  );
});

test('the headline set names seven indices the BSE list carries', () => {
  assert.deepEqual(
    [...BSE_HEADLINE],
    ['SENSEX', 'BANKEX', 'SNSX50', 'SNXN30', 'BSE100', 'FOCIT', 'FOCMID'],
  );
  const listed = new Set(BSE_INDICES.map(index => index.symbol));
  assert.ok([...BSE_HEADLINE].every(symbol => listed.has(symbol)));
});

test('the Indian indices are the NSE list, then the BSE list', () => {
  assert.deepEqual(INDIAN_INDICES, [...NSE_INDICES, ...BSE_INDICES]);
  assert.equal(INDIAN_INDICES[0]?.symbol, 'NIFTY');
});

test('exchangeOf reads MCX for a commodity, BSE for a BSE index and NSE otherwise', () => {
  assert.equal(exchangeOf('GOLD'), 'MCX');
  assert.equal(exchangeOf('crudeoil'), 'MCX');
  assert.equal(exchangeOf('SENSEX'), 'BSE');
  assert.equal(exchangeOf('bankex'), 'BSE');
  assert.equal(exchangeOf('NIFTY'), 'NSE');
  assert.equal(exchangeOf('RELIANCE'), 'NSE');
  // An unknown symbol is assumed to be an NSE listing, as every label was before.
  assert.equal(exchangeOf(''), 'NSE');
});

test('a BSE index counts as an index and is named from its list', () => {
  assert.ok(isIndexSymbol('SENSEX'));
  assert.ok(isIndexSymbol('bse500'));
  assert.ok(BSE_INDICES.every(index => isIndexSymbol(index.symbol)));
  assert.ok(!isIndexSymbol('RELIANCE'));
  assert.equal(displayName('SENSEX'), 'BSE SENSEX');
  assert.equal(displayName('BANKEX'), 'BSE BANKEX');
  assert.equal(displayName('NIFTY'), 'NIFTY 50');
  // The equity list's spelling still wins the one symbol both lists carry.
  assert.equal(displayName('INDIAVIX'), 'India VIX');
});
