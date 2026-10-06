import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {Regime, RegimeRow} from '../../types/regimePulse.ts';
import {
  breadthCounts,
  clockOf,
  hasRegime,
  isBearish,
  isBullish,
  ivPointsOf,
  fractionPct,
  REGIME_LABEL,
  REGIME_ORDER,
  REGIME_SHORT,
  regimeChangedSince,
  regimeDistribution,
  regimeKey,
  regimeMap,
  regimeRowFor,
  regimeStamp,
  regimeTone,
  signed,
  signedFixed,
  zBiasRegime,
} from '../regimePulse.ts';

const row = (underlying: string, regime: Regime): RegimeRow => ({
  ts: '2026-10-06 14:32:20',
  trade_date: '2026-10-06',
  underlying,
  spot: 25000,
  avg_ce_z: 0,
  avg_pe_z: 0,
  z_bias: 0,
  avg_ce_roc: 0,
  avg_pe_roc: 0,
  roc_bias: 0,
  roc_bias_z: null,
  regime,
  atm_ce_iv: 0.12,
  atm_pe_iv: 0.13,
  straddle_iv: 0.125,
  atm_ce_ltp: 100,
  atm_pe_ltp: 110,
  straddle_premium: 210,
  pzr1_signal: '',
  pzr1_position: 0,
  pzr1_entry_ts: '',
  pzr1_entry_spot: 0,
  atm_ce_iv_chg: 0,
  atm_pe_iv_chg: 0,
  straddle_iv_chg: 0,
  atm_ce_value: 0,
  atm_pe_value: 0,
  atm_ce_value_chg_pct: 0,
  atm_pe_value_chg_pct: 0,
  straddle_atp: 0,
  straddle_open: 0,
  straddle_chg: 0,
  straddle_chg_pct: 0,
  expiry: null,
  atm_strike: null,
  regime_since: '2026-10-06 11:05:00',
});

test('every regime has a label, a short label and a tone; the strong ones lean fully', () => {
  for (const regime of [...REGIME_ORDER, 'WARMING_UP'] as const) {
    assert.ok(REGIME_LABEL[regime]);
    assert.ok(REGIME_SHORT[regime]);
  }
  assert.deepEqual(regimeTone('BULLISH'), {
    lean: 'bullish',
    strength: 'strong',
  });
  assert.deepEqual(regimeTone('NEUTRAL-TO-BULLISH'), {
    lean: 'bullish',
    strength: 'mild',
  });
  assert.deepEqual(regimeTone('RANGEBOUND'), {
    lean: 'neutral',
    strength: 'mild',
  });
  assert.deepEqual(regimeTone('NEUTRAL-TO-BEARISH'), {
    lean: 'bearish',
    strength: 'mild',
  });
  assert.deepEqual(regimeTone('BEARISH'), {
    lean: 'bearish',
    strength: 'strong',
  });
  assert.deepEqual(regimeTone('WARMING_UP'), {
    lean: 'warming',
    strength: 'mild',
  });
  assert.equal(isBullish('NEUTRAL-TO-BULLISH'), true);
  assert.equal(isBearish('NEUTRAL-TO-BULLISH'), false);
  assert.equal(isBearish('BEARISH'), true);
  assert.equal(isBullish('RANGEBOUND'), false);
});

test('a bias figure takes the regime colour at web thresholds', () => {
  assert.equal(zBiasRegime(2), 'BULLISH');
  assert.equal(zBiasRegime(0.5), 'NEUTRAL-TO-BULLISH');
  assert.equal(zBiasRegime(0), 'RANGEBOUND');
  assert.equal(zBiasRegime(-0.5), 'NEUTRAL-TO-BEARISH');
  assert.equal(zBiasRegime(-2), 'BEARISH');
});

test('clockOf reads a clock out of any stamp the engine writes', () => {
  assert.equal(clockOf('2026-09-28 14:32:20'), '14:32');
  assert.equal(clockOf('2026-09-28T14:32:20Z', true), '14:32:20');
  assert.equal(clockOf('14:32:20'), '14:32');
  assert.equal(clockOf(null), '');
});

test('signed figures: zero carries no sign, signedFixed keeps it, fractions read as percent', () => {
  assert.equal(signed(1234.5), '+1,234.50');
  assert.equal(signed(-0.004), '0.00');
  assert.equal(signed(-2.5, 1), '−2.5');
  assert.equal(signed(null), '—');
  assert.equal(signedFixed(0, 2), '+0.00');
  assert.equal(signedFixed(-1.234, 1), '−1.2');
  assert.equal(fractionPct(0.124), '12.4%');
  assert.equal(fractionPct(0), '—');
  assert.equal(ivPointsOf(0.012), '+1.20 pts');
  assert.equal(ivPointsOf(0), '—');
});

test('breadth and distribution count by regime in display order', () => {
  assert.deepEqual(
    breadthCounts({
      ts: '',
      total_symbols: 10,
      bullish: 3,
      nt_bullish: 2,
      rangebound: 1,
      nt_bearish: 1,
      bearish: 3,
      bullish_total: 5,
      bearish_total: 4,
    }),
    {
      BULLISH: 3,
      'NEUTRAL-TO-BULLISH': 2,
      RANGEBOUND: 1,
      'NEUTRAL-TO-BEARISH': 1,
      BEARISH: 3,
      WARMING_UP: 0,
    },
  );
  assert.equal(breadthCounts(null), null);
  const dist = regimeDistribution([
    {regime: 'BULLISH'},
    {regime: 'BULLISH'},
    {regime: 'RANGEBOUND'},
    {regime: 'WARMING_UP'},
  ]);
  assert.deepEqual(
    dist.map(d => [d.regime, d.count, d.pct]),
    [
      ['BULLISH', 2, 50],
      ['NEUTRAL-TO-BULLISH', 0, 0],
      ['RANGEBOUND', 1, 25],
      ['NEUTRAL-TO-BEARISH', 0, 0],
      ['BEARISH', 0, 0],
    ],
  );
});

test('the snapshot keys by underlying; a watchlist spelling finds its row, warming up finds none', () => {
  const map = regimeMap([
    row('NIFTY', 'BULLISH'),
    row('BANKNIFTY', 'WARMING_UP'),
    row('RELIANCE', 'BEARISH'),
  ]);
  assert.deepEqual(Object.keys(map), ['NIFTY', 'BANKNIFTY', 'RELIANCE']);
  assert.equal(regimeKey('NSE:NIFTY 50'), 'NIFTY');
  assert.equal(regimeKey('NIFTY BANK'), 'BANKNIFTY');
  assert.equal(regimeKey('NIFTY50'), 'NIFTY');
  assert.equal(regimeKey('NSE:NIFTYMIDSELECT'), 'MIDCPNIFTY');
  assert.equal(regimeKey('NIFTY MID SELECT'), 'MIDCPNIFTY');
  assert.equal(regimeKey('NIFTYFINANCE'), 'FINNIFTY');
  assert.equal(regimeKey('NIFTY FIN SERVICE'), 'FINNIFTY');
  assert.equal(regimeKey('RELIANCE-EQ'), 'RELIANCE');
  assert.equal(regimeKey('reliance'), 'RELIANCE');
  assert.equal(regimeRowFor(map, 'NIFTY 50')?.regime, 'BULLISH');
  assert.equal(regimeRowFor(map, 'RELIANCE-EQ')?.regime, 'BEARISH');
  assert.equal(regimeRowFor(map, 'NIFTY BANK'), undefined);
  assert.equal(regimeRowFor(map, 'TCS'), undefined);
  assert.equal(hasRegime(map.BANKNIFTY), false);
  assert.equal(hasRegime(undefined), false);
  assert.deepEqual(regimeMap(undefined), {});
});

test('a reading is live only in market hours on its own day; a changed answer is named', () => {
  const live = row('NIFTY', 'BULLISH');
  assert.deepEqual(regimeStamp(live, true, '2026-10-06'), {
    kind: 'live',
    at: '14:32',
  });
  assert.deepEqual(regimeStamp(live, false, '2026-10-06'), {
    kind: 'close',
    date: '2026-10-06',
    at: '14:32',
  });
  assert.deepEqual(regimeStamp(live, true, '2026-10-07'), {
    kind: 'close',
    date: '2026-10-06',
    at: '14:32',
  });
  assert.equal(regimeChangedSince('BEARISH', live), 'BEARISH');
  assert.equal(regimeChangedSince('BULLISH', live), undefined);
  assert.equal(regimeChangedSince(undefined, live), undefined);
  assert.equal(regimeChangedSince('toString', live), undefined);
});
