import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {OptionChainRow} from '../../types/fno.ts';
import {
  blackScholesGreeks,
  impliedForward,
  normCdf,
  yearsToExpiry,
} from '../greeks.ts';

const row = (
  strike: number,
  ceLtp: number | null,
  peLtp: number | null,
): OptionChainRow => ({strike, ceLtp, peLtp, isAtm: false}) as OptionChainRow;

test('yearsToExpiry counts to the 15:30 IST close and is null once past', () => {
  const now = Date.UTC(2026, 0, 1, 10, 0, 0);
  const oneDay = yearsToExpiry('2026-01-02', now);
  assert.ok(oneDay !== null);
  assert.ok(Math.abs(oneDay * 365 - 1) < 1e-9);
  assert.equal(yearsToExpiry('2025-12-31', now), null);
  assert.equal(yearsToExpiry('not a date', now), null);
  assert.equal(yearsToExpiry(undefined, now), null);
});

test('impliedForward reads the forward out of the tightest call/put pair by parity', () => {
  const rows = [row(24300, 150, 60), row(24400, 100, 98), row(24500, 60, 160)];
  const years = 30 / 365;
  const forward = impliedForward(rows, 24366, years, 0.065);
  assert.ok(Math.abs(forward - (24400 + 2 * Math.exp(0.065 * years))) < 1e-9);
  assert.equal(impliedForward([row(24400, null, 90)], 24366, years), 24366);
});

test('blackScholesGreeks: put-call relations at the money', () => {
  const ce = blackScholesGreeks(24400, 24400, 30 / 365, 0.12, 'CE');
  const pe = blackScholesGreeks(24400, 24400, 30 / 365, 0.12, 'PE');
  assert.ok(ce && pe);
  assert.ok(
    Math.abs(ce.delta - pe.delta - 1) < 1e-9,
    'forward deltas differ by one',
  );
  assert.ok(Math.abs(ce.gamma - pe.gamma) < 1e-12, 'same gamma');
  assert.ok(Math.abs(ce.vega - pe.vega) < 1e-12, 'same vega');
  assert.ok(
    ce.delta > 0.5 && ce.delta < 0.52,
    'ATM call delta just over a half',
  );
  assert.ok(ce.theta < 0 && ce.rho > 0 && pe.rho < 0);
});

test('blackScholesGreeks refuses unquotable inputs', () => {
  assert.equal(blackScholesGreeks(0, 100, 1, 0.2, 'CE'), null);
  assert.equal(blackScholesGreeks(100, 100, 0, 0.2, 'CE'), null);
  assert.equal(blackScholesGreeks(100, 100, 1, 0, 'PE'), null);
});

test('normCdf is the standard normal CDF, to 1.5e-7 and symmetric about zero', () => {
  // The approximation's coefficients sum to 1 - 1e-9, so the middle is 0.5 to 1e-9, not exactly.
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-8);
  // Tabled values of the standard normal: Φ(1) = 0.8413447, Φ(1.96) = 0.9750021, Φ(3) = 0.9986501.
  for (const [x, want] of [
    [1, 0.8413447],
    [1.96, 0.9750021],
    [3, 0.9986501],
    [-1, 0.1586553],
  ] as const) {
    assert.ok(Math.abs(normCdf(x) - want) < 2e-7, `normCdf(${String(x)})`);
  }
  for (const x of [0.1, 0.5, 1.3, 2.7]) {
    assert.ok(Math.abs(normCdf(x) + normCdf(-x) - 1) < 1e-12);
  }
  assert.ok(normCdf(-40) >= 0 && normCdf(-40) < 1e-12);
  assert.ok(normCdf(40) <= 1 && normCdf(40) > 1 - 1e-12);
});
