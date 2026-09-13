import assert from 'node:assert/strict';
import {test} from 'node:test';

import {extractUnderlyingSymbol, isFnOSymbol} from '../symbols.ts';

test('contracts, index spellings and exchange suffixes reduce to the underlying', () => {
  assert.equal(extractUnderlyingSymbol('NIFTY24JUL22000CE'), 'NIFTY');
  assert.equal(extractUnderlyingSymbol('NIFTY 50'), 'NIFTY');
  assert.equal(extractUnderlyingSymbol('NIFTY BANK'), 'BANKNIFTY');
  assert.equal(extractUnderlyingSymbol('BANKNIFTY26SEPFUT'), 'BANKNIFTY');
  assert.equal(extractUnderlyingSymbol('reliance-eq'), 'RELIANCE');
  assert.equal(extractUnderlyingSymbol('TCS.NS'), 'TCS');
  assert.equal(extractUnderlyingSymbol('RELIANCE 26SEP 2800CE'), 'RELIANCE');
  assert.equal(extractUnderlyingSymbol('NIFTYIT'), 'NIFTYIT');
  assert.equal(extractUnderlyingSymbol(''), '');
});

test('F&O detection is anchored on the contract suffix', () => {
  assert.equal(isFnOSymbol('NIFTY'), true);
  assert.equal(isFnOSymbol('BANKNIFTY 26SEP'), true);
  assert.equal(isFnOSymbol('NIFTY2681824400PE'), true);
  assert.equal(isFnOSymbol('JINDALSTEL26AUGFUT'), true);
  assert.equal(isFnOSymbol('BSE500IETF'), false);
  assert.equal(isFnOSymbol('RELIANCE'), false);
  assert.equal(isFnOSymbol(undefined), false);
});
