import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {DepthInterpretation} from '../../types/market.ts';
import {
  depthBookStatus,
  depthRefusal,
  fairLimitPrice,
} from '../depthReading.ts';

const READING: DepthInterpretation = {
  last_price: 1305.95,
  best_bid: 1305.9,
  best_ask: 1306.1,
  midpoint: 1306,
  spread: 0.2,
  total_buy_quantity: 52_000,
  total_sell_quantity: 48_000,
  visible_buy_quantity: 30_000,
  visible_sell_quantity: 22_000,
  total_book_imbalance: 0.04,
  top5_imbalance: 0.1538,
  weighted_top5_imbalance: 0.2,
  total_book_imbalance_pct: 4,
  top5_imbalance_pct: 15.38,
  weighted_top5_imbalance_pct: 20,
  best_level_microprice: 1306.0142857,
  rough_iep: 1306.0142857,
  rough_iep_rounded: 1306.05,
  tick_size: 0.05,
  neutral_band: 0.2,
  stale_spread_multiple: 3,
  ltp_distance_from_mid: -0.05,
  ltp_distance_in_spreads: 0.25,
  data_quality: 'valid',
  signal_valid: true,
  broader_bias: 'neutral',
  immediate_bias: 'bullish',
  final_interpretation: 'Balanced book, buyers nearer the price.',
};

test('the fair limit price is the rounded IEP at two decimals', () => {
  assert.equal(fairLimitPrice(READING), 1306.05);
  assert.equal(
    fairLimitPrice({...READING, rough_iep_rounded: 1306.1000000001}),
    1306.1,
  );
});

test('a refusal is either a crossed book or too thin a one', () => {
  assert.equal(
    depthRefusal('crossed book: best ask below best bid'),
    'crossed',
  );
  assert.equal(depthRefusal('no priced levels on one side'), 'thin');
  assert.equal(depthRefusal('empty touch'), 'thin');
});

test('only a book served live in session is live; an earlier day’s book in session is stored', () => {
  assert.equal(depthBookStatus('open', {session: 'open'}), 'live');
  assert.equal(depthBookStatus('open', {}), 'live');
  assert.equal(depthBookStatus('open', {session: 'closed'}), 'stored');
  assert.equal(depthBookStatus('preopen', {session: 'preopen'}), 'preopen');
  assert.equal(depthBookStatus('closed', {session: 'closed'}), 'closed');
  assert.equal(depthBookStatus('closed', {session: 'open'}), 'closed');
});
