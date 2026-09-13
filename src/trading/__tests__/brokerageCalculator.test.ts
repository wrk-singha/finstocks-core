import assert from 'node:assert/strict';
import {test} from 'node:test';

import {calculateBrokerage} from '../brokerageCalculator.ts';

const near = (a: number, b: number) => {
  assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`);
};

test('delivery round trip on Zerodha: free brokerage, STT on both sides, GST-inclusive DP', () => {
  const c = calculateBrokerage(100, 110, 100, 'delivery', 'zerodha');
  assert.equal(c.brokerage, 0);
  near(c.stt, 21); // 0.1% of ₹21,000 round-trip turnover
  near(c.exchangeCharges, 0.64); // 0.0030699% of 21,000, truncated
  near(c.sebiCharges, 0.02);
  near(c.ipft, 0);
  near(c.stampDuty, 1.5); // 0.015% of the ₹10,000 buy
  near(c.dpCharges, 15.34); // ₹13 + 18% GST
  near(c.gst, 0.11); // 18% on brokerage + exchange + SEBI + IPFT
  near(c.totalCharges, 38.61);
  near(c.grossPnl, 1000);
  near(c.netPnl, 1000 - 38.61);
});

test('intraday charges STT on the sell side only, no DP, brokerage capped at ₹20 per leg', () => {
  const c = calculateBrokerage(5000, 5100, 1000, 'intraday', 'zerodha');
  assert.equal(c.brokerage, 40); // 0.03% of ₹5,000,000 far exceeds the ₹20 cap, twice
  near(c.stt, 1275); // 0.025% of the ₹5,100,000 sell
  near(c.stampDuty, 150); // 0.003% of the ₹5,000,000 buy
  assert.equal(c.dpCharges, 0);
});

test('Dhan is billed its own DP fee, never Zerodha’s (drift resolved 2026-09-13)', () => {
  const dhan = calculateBrokerage(100, 110, 100, 'delivery', 'dhann');
  const zerodha = calculateBrokerage(100, 110, 100, 'delivery', 'zerodha');
  near(dhan.dpCharges, 14.75); // ₹12.50 + 18% GST
  near(zerodha.dpCharges, 15.34);
  near(zerodha.totalCharges - dhan.totalCharges, 0.59);
  // A string that misses the table still prices, at Zerodha's rates.
  const unknown = calculateBrokerage(
    100,
    110,
    100,
    'delivery',
    'dhan' as never,
  );
  near(unknown.dpCharges, 15.34);
});

test('Groww floors brokerage at ₹5 and charges delivery; Upstox flat ₹20 on delivery', () => {
  const groww = calculateBrokerage(1000, 1000, 1, 'delivery', 'groww');
  assert.equal(groww.brokerage, 10); // max(5, 0.1% of ₹1,000) per leg
  const upstox = calculateBrokerage(1000, 1000, 1, 'delivery', 'upstox');
  assert.equal(upstox.brokerage, 40);
  const upstoxIntraday = calculateBrokerage(
    1000,
    1000,
    1,
    'intraday',
    'upstox',
  );
  assert.equal(upstoxIntraday.brokerage, 2); // 0.1% of ₹1,000 per leg
});

test('truncation drops sub-paisa fractions but not float noise', () => {
  // 0.015% of ₹10,000 is exactly ₹1.50 by schedule; the raw double is 1.4999999999999998.
  near(calculateBrokerage(100, 0, 100, 'delivery', 'zerodha').stampDuty, 1.5);
  near(calculateBrokerage(2500, 0, 10, 'delivery', 'zerodha').stampDuty, 3.75);
});

test('a single leg only pays what it executes', () => {
  const buyOnly = calculateBrokerage(2500, 0, 10, 'delivery', 'zerodha');
  assert.equal(buyOnly.dpCharges, 0);
  near(buyOnly.stampDuty, 3.75);
  near(buyOnly.stt, 25);
  const sellOnly = calculateBrokerage(0, 2500, 10, 'delivery', 'zerodha');
  assert.equal(sellOnly.stampDuty, 0);
  near(sellOnly.dpCharges, 15.34);
});

test('F&O is broker-agnostic: flat ₹20 a leg, sell-side STT, no DP', () => {
  const fut = calculateBrokerage(22000, 22100, 65, 'futures', 'groww');
  assert.equal(fut.brokerage, 40);
  near(fut.stt, 718.25); // 0.05% of ₹1,436,500
  near(fut.stampDuty, 28.6); // 0.002% of ₹1,430,000
  assert.equal(fut.dpCharges, 0);
  assert.deepEqual(
    fut,
    calculateBrokerage(22000, 22100, 65, 'futures', 'zerodha'),
  );

  const opt = calculateBrokerage(150, 180, 65, 'options', 'upstox');
  near(opt.stt, 17.55); // 0.15% of the ₹11,700 premium sold
  near(opt.exchangeCharges, 7.62); // 0.0355299% of ₹21,450 premium turnover
  near(opt.stampDuty, 0.29); // 0.003% of ₹9,750 buy premium
  near(opt.gst, 8.57);
});
