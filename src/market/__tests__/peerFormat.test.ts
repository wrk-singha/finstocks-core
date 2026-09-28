import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatPeerValue, medianTone} from '../peerFormat.ts';

test('a figure takes the precision its unit reads at, grouped the Indian way', () => {
  assert.equal(formatPeerValue(1930000, 'crore'), '19,30,000');
  assert.equal(formatPeerValue(-1250.4, 'crore'), '-1,250');
  assert.equal(formatPeerValue(812.456, 'crore'), '812.46');
  assert.equal(formatPeerValue(12.345, 'pct'), '12.3');
  assert.equal(formatPeerValue(1426, 'rupees'), '1,426.00');
  assert.equal(formatPeerValue(24.137, 'x'), '24.14');
  assert.equal(formatPeerValue(58.6, 'days'), '59');
  assert.equal(formatPeerValue(1234567, 'count'), '12,34,567');
  assert.equal(formatPeerValue(7, 'score'), '7');
});

test('a figure the company does not file is a dash, never 0', () => {
  assert.equal(formatPeerValue(undefined, 'pct'), '—');
  assert.equal(formatPeerValue(null, 'crore'), '—');
  assert.equal(formatPeerValue(Number.NaN, 'x'), '—');
  assert.equal(formatPeerValue(Number.POSITIVE_INFINITY, 'x'), '—');
  assert.equal(formatPeerValue(0, 'pct'), '0.0');
});

test('a figure is judged against the median in the direction its column favours', () => {
  const higher = {better: 1} as const;
  const lower = {better: -1} as const;
  assert.equal(medianTone(18, 12, higher), 'better');
  assert.equal(medianTone(8, 12, higher), 'worse');
  assert.equal(medianTone(18, 24, lower), 'better');
  assert.equal(medianTone(30, 24, lower), 'worse');
  assert.equal(medianTone(-4, -2, higher), 'worse');
});

test('neither side is claimed without a direction, a figure or a median, or on the median itself', () => {
  assert.equal(medianTone(1930000, 85500, {better: 0}), null);
  assert.equal(medianTone(undefined, 12, {better: 1}), null);
  assert.equal(medianTone(12, undefined, {better: 1}), null);
  assert.equal(medianTone(12, null, {better: -1}), null);
  assert.equal(medianTone(12, 12, {better: 1}), null);
});
