import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildFuturesSymbol,
  futuresPath,
  futuresTitle,
  futuresTitleParts,
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

test('futures title parts carry the day only when the date is usable', () => {
  const jindal = parseFuturesSymbol('JINDALSTEL26AUGFUT');
  assert.ok(jindal);
  assert.deepEqual(futuresTitleParts(jindal, '2026-08-25'), {
    underlying: 'JINDALSTEL',
    day: 25,
    monthIndex: 7,
  });
  for (const missing of [undefined, null, '', 'not-a-date']) {
    assert.deepEqual(futuresTitleParts(jindal, missing), {
      underlying: 'JINDALSTEL',
      day: null,
      monthIndex: 7,
    });
  }
  const mm = parseFuturesSymbol('M&M26JANFUT');
  assert.ok(mm);
  assert.equal(futuresTitleParts(mm).monthIndex, 0);
});

// Recorded from the v0.2.4 implementation before futuresTitle was rebuilt on futuresTitleParts.
test('futures title reads exactly as v0.2.4 did', () => {
  const jindal = parseFuturesSymbol('JINDALSTEL26AUGFUT');
  const mm = parseFuturesSymbol('M&M26SEPFUT');
  assert.ok(jindal && mm);
  assert.deepEqual(
    [
      futuresTitle(jindal, '2026-08-25'),
      futuresTitle(jindal),
      futuresTitle(jindal, null),
      futuresTitle(jindal, ''),
      futuresTitle(jindal, 'not-a-date'),
      futuresTitle(mm, '2026-09-29'),
    ],
    [
      'JINDALSTEL 25 Aug Fut',
      'JINDALSTEL Aug Fut',
      'JINDALSTEL Aug Fut',
      'JINDALSTEL Aug Fut',
      'JINDALSTEL Aug Fut',
      'M&M 29 Sep Fut',
    ],
  );
});
