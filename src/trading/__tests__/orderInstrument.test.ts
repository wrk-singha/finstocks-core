import assert from 'node:assert/strict';
import {test} from 'node:test';

import {lotSizeForSymbol, productFor} from '../orderInstrument.ts';

test('productFor: intraday is MIS; carried contracts are NRML, carried equity CNC', () => {
  assert.equal(productFor('INFY', 'INTRADAY'), 'MIS');
  assert.equal(productFor('NIFTY24JUL22000CE', 'INTRADAY'), 'MIS');
  assert.equal(productFor('INFY', 'DELIVERY'), 'CNC');
  assert.equal(productFor('NIFTY24JUL22000CE', 'DELIVERY'), 'NRML');
  assert.equal(productFor(undefined, 'DELIVERY'), 'CNC');
});

test('lotSizeForSymbol knows index contracts and nothing else', () => {
  assert.equal(lotSizeForSymbol('NIFTY24JUL22000CE'), 65);
  assert.equal(lotSizeForSymbol('BANKNIFTY24JULFUT'), 30);
  assert.equal(lotSizeForSymbol('RELIANCE24JUL2500CE'), null);
  assert.equal(lotSizeForSymbol('INFY'), null);
  assert.equal(lotSizeForSymbol(undefined), null);
});
