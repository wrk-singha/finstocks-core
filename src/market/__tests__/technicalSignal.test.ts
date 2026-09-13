import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {TechnicalIndicatorData} from '../../types/indicators.ts';
import {
  buildOscillators,
  computeSignalTally,
  macdHistogram,
  verdictColorKey,
} from '../technicalSignal.ts';

const data: TechnicalIndicatorData = {
  stock_symbol: 'RELIANCE',
  close_price: 2900,
  ema50: 2800,
  ema200: 3000,
  rsi14: 75,
  macd_8_21_9: 4,
  macd_signal: 1,
  macd_histogram: 0,
  stochastic_k_14: 15,
  cci_20: 50,
  williams_r_14: -90,
  mfi14: 85,
};

test('macd histogram is derived from the legs, never the server field', () => {
  assert.equal(macdHistogram(data), 3);
  assert.equal(macdHistogram({stock_symbol: 'X', macd_8_21_9: 4}), null);
  assert.equal(macdHistogram(undefined), null);
});

test('oscillators carry a verdict and a 0–100 gauge position', () => {
  const [rsi, macd, stoch, cci, williams, mfi] = buildOscillators(data);
  assert.deepEqual(rsi, {
    label: 'RSI 14',
    value: 75,
    left: 75,
    verdict: 'Sell',
  });
  assert.deepEqual(macd, {
    label: 'MACD Hist',
    value: 3,
    left: 80,
    verdict: 'Buy',
  });
  assert.equal(stoch?.verdict, 'Buy');
  assert.equal(cci?.verdict, 'Neutral');
  assert.equal(cci?.left, 62.5);
  assert.equal(williams?.verdict, 'Buy');
  assert.equal(williams?.left, 10);
  assert.equal(mfi?.verdict, 'Sell');
  assert.deepEqual(buildOscillators(undefined), []);
  assert.equal(buildOscillators({stock_symbol: 'X'})[0]?.value, null);
});

test('the tally adds the two EMA votes and never divides by zero', () => {
  const tally = computeSignalTally(data);
  assert.deepEqual(tally, {
    buy: 4,
    sell: 3,
    neutral: 1,
    total: 8,
    overall: 'Buy',
  });
  assert.deepEqual(computeSignalTally(undefined), {
    buy: 0,
    sell: 0,
    neutral: 0,
    total: 1,
    overall: 'Neutral',
  });
  const injected = computeSignalTally(data, [
    {label: 'x', value: null, left: 0, verdict: 'Sell'},
  ]);
  assert.equal(injected.total, 3);
  assert.equal(injected.overall, 'Sell');
});

test('verdict tones map to the apps’ profit/loss/muted colours', () => {
  assert.equal(verdictColorKey('Buy'), 'profit');
  assert.equal(verdictColorKey('Sell'), 'loss');
  assert.equal(verdictColorKey('Neutral'), 'muted');
});
