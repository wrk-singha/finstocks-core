import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  clamp,
  formatAllocation,
  formatCompactINR,
  formatCompactInr,
  formatCrore,
  formatCroreCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatValue,
  signedCurrency,
  signedPct,
  withSign,
} from '../number.ts';

test('formatNumber groups in the Indian style', () => {
  assert.equal(formatNumber(1234567), '12,34,567');
  assert.equal(formatNumber(1234567.891, 2), '12,34,567.89');
  assert.equal(formatNumber(0.5, 1), '0.5');
});

test('formatCurrency leads with the minus so columns align on ₹', () => {
  assert.equal(formatCurrency(-1240), '-₹1,240.00');
  assert.equal(formatCurrency(1234567.891), '₹12,34,567.89');
  assert.equal(formatCurrency(12.5, 0), '₹13');
  assert.equal(formatCurrency(null), '₹0.00');
  assert.equal(formatCurrency(undefined), '₹0.00');
});

test('formatPercent fixes the decimals', () => {
  assert.equal(formatPercent(12.345), '12.35%');
  assert.equal(formatPercent(-0.5), '-0.50%');
  assert.equal(formatPercent(null), '0.00%');
});

test('formatQuantity truncates to whole units', () => {
  assert.equal(formatQuantity(100000), '1,00,000');
  assert.equal(formatQuantity(12.9), '12');
  assert.equal(formatQuantity(null), '0');
});

test('formatCompactInr abbreviates by crore, lakh, thousand', () => {
  assert.equal(formatCompactInr(12_300_000), '₹1.2Cr');
  assert.equal(formatCompactInr(20_000_000), '₹2Cr');
  assert.equal(formatCompactInr(150_000), '₹1.5L');
  assert.equal(formatCompactInr(1_500), '₹1.5K');
  assert.equal(formatCompactInr(999.4), '₹999');
  assert.equal(formatCompactInr(-2_500_000), '-₹25L');
  assert.equal(formatCompactInr(null), '₹0');
});

test('formatCroreCompact takes values already in crore', () => {
  assert.equal(formatCroreCompact(null), 'N/A');
  assert.equal(formatCroreCompact(123_456), '₹1.23L Cr');
  assert.equal(formatCroreCompact(1_234), '₹1.23K Cr');
  assert.equal(formatCroreCompact(12.4), '₹12 Cr');
});

test('withSign only adds a plus', () => {
  assert.equal(withSign('12.35%', 12.35), '+12.35%');
  assert.equal(withSign('-0.50%', -0.5), '-0.50%');
  assert.equal(withSign('0.00%', 0), '0.00%');
});

test('signedCurrency and signedPct show direction, dash when unrepresentable', () => {
  assert.equal(signedCurrency(1240), '+₹1,240');
  assert.equal(signedCurrency(-1240.5, 2), '-₹1,240.50');
  assert.equal(signedPct(2.44), '+2.4%');
  assert.equal(signedPct(-0.5), '-0.5%');
  assert.equal(signedPct(0, 2), '+0.00%');
  assert.equal(signedPct(null), '—');
  assert.equal(signedPct(undefined), '—');
  assert.equal(signedPct(Number.NaN), '—');
});

test('formatCompactINR is the same formatter under the app-facing name', () => {
  assert.equal(formatCompactINR, formatCompactInr);
  assert.equal(formatCompactINR(5_00_000), '₹5L');
});

test('formatCrore keeps the exact grouped figure', () => {
  assert.equal(formatCrore(1973643.47), '1,973,643.47 Cr');
  assert.equal(formatCrore(12), '12.00 Cr');
  assert.equal(formatCrore(null), 'N/A');
  assert.equal(formatCrore(undefined), 'N/A');
});

test('formatValue collapses every spelling of absent to N/A', () => {
  assert.equal(formatValue(null), 'N/A');
  assert.equal(formatValue(undefined), 'N/A');
  assert.equal(formatValue('null'), 'N/A');
  assert.equal(formatValue('N/A'), 'N/A');
  assert.equal(formatValue('12.5x'), '12.5x');
  assert.equal(formatValue(42), '42');
});

test('formatAllocation reads QTY budgets as a share count', () => {
  assert.equal(formatAllocation(1500, 'QTY'), '1,500 qty');
  assert.equal(formatAllocation(1500, 'qty'), '1,500 qty');
  assert.equal(formatAllocation(150000, 'AMOUNT'), '₹1,50,000');
  assert.equal(formatAllocation(150000), '₹1,50,000');
  assert.equal(formatAllocation(null, undefined, 2), '₹0.00');
});

test('clamp holds a value inside its bounds', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});
