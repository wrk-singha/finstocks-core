import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {FlyoneRow} from '../../types/flyone.ts';
import {
  callWallSide,
  disagreesWithRegime,
  GEX_REGIME_LABEL,
  gexTone,
  isThin,
  isWarmingUp,
  levelOf,
  levelsReading,
  nearestWall,
  nearestWallText,
  parseWidthVotes,
  pctAway,
  pendingDirection,
  putWallSide,
} from '../flyone.ts';

const row = (patch: Partial<FlyoneRow> = {}): FlyoneRow => ({
  ts: '2026-10-06 14:32:00',
  trade_date: '2026-10-06',
  underlying: 'NIFTY',
  expiry: '2026-10-08',
  expiry_rank: 'near',
  spot: 25118.4,
  forward: 25140,
  atm_strike: 25100,
  straddle: 312.6,
  sigma_pts: 182,
  dte_days: 2,
  step: 50,
  n_valid_widths: 5,
  price_chg_pct: 0.4,
  skew: 0,
  fear: 0,
  fear_lb: 0,
  fear_chg: 0,
  tail_ratio: 1,
  mode_minus_fwd: 0,
  straddle_lb: 0,
  future_price: 25150,
  future_vwap: 25100,
  future_vwap_slope: 0,
  gamma_flip: 24950,
  call_wall: 25300,
  put_wall: 24800,
  total_gex: 0,
  ngex: 1,
  gdi: 0,
  gex_slope: 0,
  gex_regime: 'POS',
  ce_vol: 0,
  pe_vol: 0,
  net_vol: 0,
  ce_oi: 0,
  pe_oi: 0,
  net_oi: 0,
  ce_chg_oi: 0,
  pe_chg_oi: 0,
  net_chg_oi: 0,
  score: 2,
  direction_raw: 'BULLISH',
  direction: 'BULLISH',
  confidence: 0.8,
  pattern: 'BULL_CONFIRM',
  agree: '',
  width_scores: '50:+1|100:+1|200:-2',
  reason: '',
  oi_source: 'today',
  n_strikes: 40,
  engine_hash: '',
  direction_since: null,
  ...patch,
});

test('a level takes one decimal only on a sub-5 step; distance from spot is a percent of spot', () => {
  assert.equal(levelOf(25300, 50), '25,300');
  assert.equal(levelOf(1392.5, 2.5), '1,392.5');
  assert.equal(levelOf(null, 50), '—');
  assert.equal(pctAway(25000, 25250), 1);
  assert.equal(pctAway(null, 25250), null);
  assert.equal(pctAway(25000, null), null);
  assert.deepEqual(parseWidthVotes('50:+1|100:-2|x:y'), [
    {width: 50, score: 1},
    {width: 100, score: -2},
  ]);
  assert.deepEqual(parseWidthVotes(''), []);
});

test('the reading places spot against the walls and the flip, and falls back to the OI note', () => {
  assert.equal(
    levelsReading(row()),
    'Spot 25,118 sits between support at 24,800 and resistance at 25,300. Above the gamma flip (24,950), dealer hedging damps moves.',
  );
  assert.equal(
    levelsReading(row({spot: 25350, gamma_flip: null})),
    'Spot 25,350 is at or above the call wall (25,300), the level dealers usually defend.',
  );
  assert.equal(
    levelsReading(row({spot: 24700, gamma_flip: 24900})),
    'Spot 24,700 is at or below the put wall (24,800), the usual support. Below the gamma flip (24,900), dealer hedging can speed moves up.',
  );
  assert.equal(
    levelsReading(row({put_wall: 25000, call_wall: 25000, gamma_flip: null})),
    'Both walls sit at 25,000, so price is likely to be pinned near it.',
  );
  assert.equal(
    levelsReading(row({put_wall: null, call_wall: null, oi_source: 'none'})),
    "No open interest yet, so dealer levels can't be drawn.",
  );
  assert.equal(
    levelsReading(row({put_wall: null, call_wall: null, oi_source: 'today'})),
    'Dealer levels appear once options have open interest.',
  );
});

test('a wall is named by its side of spot; the nearer wall is the row text', () => {
  assert.equal(callWallSide(25118, 25300), 'resistance');
  assert.equal(callWallSide(25350, 25300), 'wall');
  assert.equal(callWallSide(25118, null), 'wall');
  assert.equal(putWallSide(25118, 24800), 'support');
  assert.equal(putWallSide(24700, 24800), 'wall');
  assert.deepEqual(nearestWall(row({spot: 25000})), {wall: 'put', pct: -0.8});
  assert.equal(nearestWallText(row({spot: 25000})), 'put −0.8%');
  assert.equal(nearestWallText(row({spot: 25200})), 'call +0.4%');
  assert.equal(nearestWallText(row({put_wall: null, call_wall: null})), '—');
  assert.equal(
    nearestWallText(row({put_wall: null, spot: 25000})),
    'call +1.2%',
  );
});

test('dealer tone, thin chains, warm-up and a pending call read as web reads them', () => {
  assert.equal(gexTone('STRONG_POS'), 'calm');
  assert.equal(gexTone('NEG'), 'fast');
  assert.equal(gexTone(''), 'balanced');
  assert.equal(GEX_REGIME_LABEL.NEUTRAL, 'Balanced');
  assert.equal(isThin(row({n_valid_widths: 2})), true);
  assert.equal(
    isThin(row({n_valid_widths: 2, direction_raw: 'WARMUP'})),
    false,
  );
  assert.equal(isWarmingUp(row({direction_raw: 'WARMUP'})), true);
  assert.equal(pendingDirection(row()), null);
  assert.equal(
    pendingDirection(
      row({direction: 'LEAN_BEARISH', direction_raw: 'NEUTRAL'}),
    ),
    'NEUTRAL',
  );
  assert.equal(disagreesWithRegime('BULLISH', 'BEARISH'), true);
  assert.equal(disagreesWithRegime('LEAN_BEARISH', 'NEUTRAL-TO-BULLISH'), true);
  assert.equal(disagreesWithRegime('BULLISH', 'RANGEBOUND'), false);
  assert.equal(disagreesWithRegime('BULLISH', undefined), false);
});
