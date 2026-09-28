import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StockGraphData} from '../../types/graphData.ts';
import {livePriceFor, priceSymbolFor} from '../livePrice.ts';
import {isExchangeSymbol} from '../optionContract.ts';

test('a contract prices against its own series; everything else normalises', () => {
  assert.equal(priceSymbolFor('NIFTY2681824400PE'), 'NIFTY2681824400PE');
  assert.equal(priceSymbolFor('nifty26sepfut'), 'NIFTY26SEPFUT');
  assert.equal(
    priceSymbolFor('RELIANCE26SEP2802.5CE'),
    'RELIANCE26SEP2802.5CE',
  );
  assert.equal(priceSymbolFor('RELIANCE-EQ'), 'RELIANCE');
  assert.equal(priceSymbolFor('NIFTY 50'), 'NIFTY');
});

test('a contract ticker is an exchange symbol; a cash or index symbol is not', () => {
  for (const symbol of [
    'NIFTY26SEP24500CE',
    'TATASTEEL26SEP187.5PE',
    'M&M26OCT3100CE',
    'BAJAJ-AUTO26SEPFUT',
    'NIFTYNXT5026SEPFUT',
  ])
    assert.equal(isExchangeSymbol(symbol), true, symbol);
  for (const symbol of ['RELIANCE', 'NIFTY', 'M&M', 'BAJAJ-AUTO', 'NIFTY 50'])
    assert.equal(isExchangeSymbol(symbol), false, symbol);
  // The grammar is upper case, as the feeds are; callers normalise first.
  assert.equal(isExchangeSymbol('nifty26sepfut'), false);
});

const bar = (time: string, close: number) => ({
  time,
  open: close,
  close,
  high: close,
  low: close,
});

test('live price is the newest close, case-tolerant, null when unpriced', () => {
  const data: StockGraphData = {
    reliance: [
      bar('2026-09-11T09:30:00Z', 2810.126),
      bar('2026-09-11T09:15:00Z', 2800),
    ],
    ZERO: [bar('2026-09-11T09:15:00Z', 0)],
  };
  assert.equal(livePriceFor(data, 'RELIANCE'), 2810.13);
  assert.equal(livePriceFor(data, 'reliance'), 2810.13);
  assert.equal(livePriceFor(data, 'ZERO'), null);
  assert.equal(livePriceFor(data, 'TCS'), null);
  assert.equal(livePriceFor(undefined, 'TCS'), null);
});
