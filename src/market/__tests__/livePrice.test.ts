import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StockGraphData} from '../../types/graphData.ts';
import {livePriceFor, priceSymbolFor} from '../livePrice.ts';

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
