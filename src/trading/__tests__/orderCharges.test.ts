import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  addCharges,
  chargeGroups,
  chargeSegmentFor,
  estimateOrderCharges,
  NO_CHARGES,
} from '../orderCharges.ts';

test('a single delivery buy is itemised like a contract note', () => {
  const est = estimateOrderCharges(
    [{side: 'BUY', qty: 12, price: 339.65}],
    'delivery',
    null,
  );
  assert.ok(est);
  assert.equal(est.tradeValueDetail, '₹339.65 × 12 qty');
  assert.ok(Math.abs(est.tradeValue - 4075.8) < 1e-9);
  assert.equal(est.groups[0]?.title, 'Zerodha charges');
  assert.equal(est.groups[0]?.lines[0]?.value, 0);
  const external = est.groups[1]?.lines ?? [];
  assert.deepEqual(
    external.map(l => l.label),
    [
      'Exchange transaction charges',
      'Stamp duty',
      'SEBI turnover charges',
      'IPFT',
    ],
  );
  assert.equal(external[1]?.value, 0.61); // 0.015% stamp on ₹4,075.80
  const taxes = est.groups[2]?.lines ?? [];
  assert.equal(taxes[1]?.value, 4.07); // 0.1% delivery STT
  assert.ok(
    Math.abs(est.netDebit - (est.tradeValue + est.totalCharges)) < 1e-9,
  );
  assert.ok(
    Math.abs(est.netCredit - (-est.tradeValue - est.totalCharges)) < 1e-9,
  );
});

test('a delivery sell on Dhan adds the DP row at Dhan’s fee', () => {
  const est = estimateOrderCharges(
    [{side: 'SELL', qty: 12, price: 339.65}],
    'delivery',
    'dhann',
  );
  assert.ok(est);
  assert.equal(est.groups[0]?.title, 'Dhan charges');
  const dp = est.groups[1]?.lines.find(l => l.label === 'DP charges');
  assert.equal(dp?.value, 14.75);
  assert.ok(est.tradeValue < 0);
});

test('a multi-leg structure nets the legs and reports a leg count', () => {
  const est = estimateOrderCharges(
    [
      {side: 'BUY', qty: 65, price: 150},
      {side: 'SELL', qty: 65, price: 90},
      {side: 'SELL', qty: 0, price: 50},
    ],
    'options',
    'upstox',
  );
  assert.ok(est);
  assert.equal(est.tradeValueDetail, '2 legs');
  assert.equal(est.tradeValue, 65 * 60);
  assert.equal(est.groups[0]?.lines[0]?.value, 40);
});

test('nothing priced yields null', () => {
  assert.equal(
    estimateOrderCharges([{side: 'BUY', qty: 0, price: 100}], 'delivery', null),
    null,
  );
});

test('chargeSegmentFor maps the pad flags onto a segment', () => {
  assert.equal(chargeSegmentFor('INFY', false, true), 'intraday');
  assert.equal(chargeSegmentFor('INFY', false, false), 'delivery');
  assert.equal(chargeSegmentFor('NIFTY24JULFUT', true, true), 'futures');
  assert.equal(chargeSegmentFor('NIFTY24JUL22000PE', true, false), 'options');
});

test('charges add line by line, and the groups read the same as an estimate’s', () => {
  const a = {...NO_CHARGES, brokerage: 10, gst: 1.8, totalCharges: 11.8};
  const b = {
    ...NO_CHARGES,
    brokerage: 5,
    dpCharges: 15.93,
    totalCharges: 20.93,
  };
  const sum = addCharges(a, b);
  assert.equal(sum.brokerage, 15);
  assert.equal(sum.gst, 1.8);
  assert.equal(sum.dpCharges, 15.93);
  assert.equal(Number(sum.totalCharges.toFixed(2)), 32.73);
  assert.deepEqual(addCharges(NO_CHARGES, NO_CHARGES), NO_CHARGES);

  const groups = chargeGroups(sum, 'zerodha');
  assert.deepEqual(
    groups.map(g => [g.title, g.lines.map(l => l.label)]),
    [
      ['Zerodha charges', ['Brokerage']],
      [
        'External charges',
        [
          'Exchange transaction charges',
          'Stamp duty',
          'SEBI turnover charges',
          'IPFT',
          'DP charges',
        ],
      ],
      ['Taxes', ['GST', 'Securities Transaction Tax']],
    ],
  );
  assert.equal(chargeGroups(a, 'groww')[1]?.lines.length, 4);
});
