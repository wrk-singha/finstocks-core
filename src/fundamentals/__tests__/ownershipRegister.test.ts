import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {OwnershipDeal, OwnershipHolder} from '../../types/ownership.ts';
import {holderConcentration, isBuyDeal} from '../ownershipRegister.ts';

const holder = (name: string, percentage: number): OwnershipHolder => ({
  name,
  category: 'Promoter',
  percentage,
  shares: 0,
  pledge_pct: null,
});

const deal = (dealType: string): OwnershipDeal => ({
  date: '2026-09-04',
  source: 'bulk',
  name: 'Kaveri Capital',
  deal_type: dealType,
  volume: 1_000_000,
  price: 1282.4,
});

test('the register is cut into its largest holder, the rest of the names and everyone undisclosed', () => {
  const bands = holderConcentration([
    holder('Aranya Commercials LLP', 10.44),
    holder('Vistaar Holdings LLP', 9.12),
    holder('Nirmaan Enterprises LLP', 8.37),
    holder('Kaveri Life Insurance Corporation', 5.2),
  ]);
  assert.deepEqual(
    bands.map(b => [b.key, b.pct, b.holders]),
    [
      ['largest', 10.44, 1],
      ['listed', 22.69, 3],
      ['rest', 66.87, null],
    ],
  );
  // On a register short of 100 the track is 100, so each band draws its own stake.
  assert.deepEqual(
    bands.map(b => Math.round(b.share * 100) / 100),
    [10.44, 22.69, 66.87],
  );
});

test('a register that already accounts for everyone has no rest, and one over 100 scales to its own total', () => {
  const whole = holderConcentration([holder('A', 60), holder('B', 39.4)]);
  assert.deepEqual(
    whole.map(b => b.key),
    ['largest', 'listed'],
  );
  // Rounded per holder, the two stakes file at 101.
  const over = holderConcentration([holder('A', 60), holder('B', 41)]);
  assert.deepEqual(
    over.map(b => [b.key, b.pct]),
    [
      ['largest', 60],
      ['listed', 41],
    ],
  );
  const track = over.reduce((sum, b) => sum + b.share, 0);
  assert.ok(Math.abs(track - 100) < 1e-9);
  assert.ok(Math.abs((over[0]?.share ?? 0) - (60 / 101) * 100) < 1e-9);
});

test('one holder or none is not a concentration to draw', () => {
  assert.deepEqual(holderConcentration([]), []);
  assert.deepEqual(holderConcentration([holder('A', 72)]), []);
});

test('a deal bought whenever its side reads as a buy, in any spelling', () => {
  for (const side of ['BUY', 'Buy', ' buy ', 'B']) {
    assert.equal(isBuyDeal(deal(side)), true, side);
  }
  for (const side of ['SELL', 'Sell', 'S', '']) {
    assert.equal(isBuyDeal(deal(side)), false, side);
  }
});
