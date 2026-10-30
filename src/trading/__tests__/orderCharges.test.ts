import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  addCharges,
  chargeGroups,
  chargeSegmentFor,
  estimateOrderCharges,
  estimateSegmentedCharges,
  NO_CHARGES,
} from '../orderCharges.ts';
import {calculateBrokerage} from '../brokerageCalculator.ts';

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

test('a leg that carries its own segment is charged at that segment’s rates', () => {
  // A cash-and-carry: delivery shares bought, the future sold against them, an option bought.
  const est = estimateSegmentedCharges(
    [
      {side: 'BUY', qty: 250, price: 2471.35, segment: 'delivery'},
      {side: 'SELL', qty: 250, price: 2489.9, segment: 'futures'},
      {side: 'BUY', qty: 250, price: 21.4, segment: 'options'},
      {side: 'BUY', qty: 0, price: 10, segment: 'options'},
    ],
    'dhann',
  );
  assert.ok(est);
  const legs = [
    calculateBrokerage(2471.35, 0, 250, 'delivery', 'dhann'),
    calculateBrokerage(0, 2489.9, 250, 'futures', 'dhann'),
    calculateBrokerage(21.4, 0, 250, 'options', 'dhann'),
  ];
  assert.equal(
    est.totalCharges,
    legs.reduce((sum, c) => addCharges(sum, c), NO_CHARGES).totalCharges,
  );
  // Zero brokerage on Dhan delivery, ₹20 an order on the future and the option.
  assert.equal(est.groups[0]?.lines[0]?.value, 40);
  // The shares are bought, not sold, so no DP row.
  assert.equal(est.groups[1]?.lines.length, 4);
  assert.equal(est.tradeValueDetail, '3 legs');
  assert.ok(Math.abs(est.tradeValue - 250 * (2471.35 - 2489.9 + 21.4)) < 1e-9);
});

test('one segment for every leg reads exactly as estimateOrderCharges', () => {
  const legs = [
    {side: 'SELL' as const, qty: 75, price: 142.15},
    {side: 'BUY' as const, qty: 75, price: 41.05},
  ];
  for (const segment of [
    'intraday',
    'delivery',
    'futures',
    'options',
  ] as const) {
    assert.deepEqual(
      estimateSegmentedCharges(
        legs.map(leg => ({...leg, segment})),
        null,
      ),
      estimateOrderCharges(legs, segment, null),
    );
  }
  assert.equal(
    estimateSegmentedCharges(
      [{side: 'BUY', qty: 10, price: 0, segment: 'futures'}],
      'zerodha',
    ),
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
