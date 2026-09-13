import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildFuturesSymbol,
  futuresPath,
  futuresTitle,
  isFuturesSymbol,
  parseFuturesSymbol,
  underlyingOf,
} from '../futuresSymbol.ts';

test('build and parse round-trip the exchange futures dialect', () => {
  assert.equal(
    buildFuturesSymbol('jindalstel', '2026-08-27'),
    'JINDALSTEL26AUGFUT',
  );
  assert.equal(buildFuturesSymbol('NIFTY', undefined), null);
  assert.equal(buildFuturesSymbol('NIFTY', '2026'), null);
  assert.equal(buildFuturesSymbol('NIFTY', '2026-13-01'), null);

  const parsed = parseFuturesSymbol(' jindalstel26augfut ');
  assert.deepEqual(parsed, {
    symbol: 'JINDALSTEL26AUGFUT',
    underlying: 'JINDALSTEL',
    expiryMonth: '2026-08',
    monthLabel: 'AUG',
    year: 2026,
  });
  assert.equal(parseFuturesSymbol('NIFTY26XYZFUT'), null);
  assert.equal(parseFuturesSymbol('NIFTY2681824400PE'), null);
  assert.equal(parseFuturesSymbol(undefined), null);
});

test('futures symbols are recognised and reduced to their underlying', () => {
  assert.equal(isFuturesSymbol('M&M26SEPFUT'), true);
  assert.equal(isFuturesSymbol('BAJAJ-AUTO26SEPFUT'), true);
  assert.equal(isFuturesSymbol('RELIANCE'), false);
  assert.equal(underlyingOf('JINDALSTEL26AUGFUT'), 'JINDALSTEL');
  assert.equal(underlyingOf('NIFTY2681824400PE'), 'NIFTY');
  assert.equal(underlyingOf('reliance-eq'), 'RELIANCE');
  assert.equal(futuresPath(' nifty26sepfut '), '/futures/NIFTY26SEPFUT');
});

test('the title carries the expiry day only when the chain reported one', () => {
  const parsed = parseFuturesSymbol('JINDALSTEL26AUGFUT');
  assert.ok(parsed);
  assert.equal(futuresTitle(parsed, '2026-08-25'), 'JINDALSTEL 25 Aug Fut');
  assert.equal(futuresTitle(parsed), 'JINDALSTEL Aug Fut');
  assert.equal(futuresTitle(parsed, null), 'JINDALSTEL Aug Fut');
});
