import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {FnoTradeIdea, OptionLeg} from '../../types/fno.ts';
import {
  costDrag,
  daysToExpiry,
  describeStructure,
  ivRead,
  legPayoff,
  marginUnlockPct,
  needsSentence,
  nextIndexExpiry,
  payoffAt,
  positionExitState,
  riskedAmount,
  structureMath,
} from '../optionStructures.ts';

const LOT = 65;
const leg = (
  action: OptionLeg['action'],
  right: OptionLeg['right'],
  strike: number,
  premium: number,
  lots = 1,
): OptionLeg => ({action, right, strike, premium, lots});

const bullCallSpread = [
  leg('buy', 'CE', 24000, 100),
  leg('sell', 'CE', 24100, 50),
];

test('leg payoff nets the premium; a future pays linearly off its entry', () => {
  assert.equal(legPayoff(leg('buy', 'CE', 24000, 100), 24300, LOT), 200 * LOT);
  assert.equal(legPayoff(leg('sell', 'PE', 24000, 80), 23500, LOT), -420 * LOT);
  assert.equal(legPayoff(leg('buy', 'FUT', 0, 24000), 24250, LOT), 250 * LOT);
  assert.equal(payoffAt(bullCallSpread, 24050, LOT), 0);
});

test('a debit spread has bounded risk and reward and one breakeven', () => {
  const m = structureMath(bullCallSpread, LOT);
  assert.equal(m.netPremium, -50 * LOT);
  assert.equal(m.maxLoss, 50 * LOT);
  assert.equal(m.maxGain, 50 * LOT);
  assert.deepEqual(m.breakevens, [24050]);
  assert.equal(m.slopeAbove, 0);
  assert.equal(riskedAmount(m), 50 * LOT);
});

test('naked and futures tails are reported as unbounded, not big numbers', () => {
  const shortCall = structureMath([leg('sell', 'CE', 24000, 100)], LOT);
  assert.equal(shortCall.maxLoss, null);
  assert.equal(shortCall.maxGain, 100 * LOT);

  const future = structureMath([leg('buy', 'FUT', 0, 24000)], LOT);
  assert.equal(future.maxLoss, null);
  assert.equal(future.maxGain, null);
  assert.equal(future.netPremium, 0);
  assert.deepEqual(future.breakevens, [24000]);

  const protectivePut = structureMath(
    [leg('buy', 'FUT', 0, 24000), leg('buy', 'PE', 23900, 60)],
    LOT,
  );
  assert.equal(protectivePut.maxLoss, 160 * LOT);
  assert.equal(protectivePut.maxGain, null);

  assert.equal(structureMath([], null), null);
  assert.deepEqual(structureMath([], LOT), {
    netPremium: 0,
    maxLoss: null,
    maxGain: null,
    breakevens: [],
    slopeAbove: 0,
  });
});

test('an iron condor risks the width less the credit, not the credit', () => {
  const condor = [
    leg('sell', 'PE', 23800, 40),
    leg('buy', 'PE', 23700, 20),
    leg('sell', 'CE', 24400, 40),
    leg('buy', 'CE', 24500, 20),
  ];
  const m = structureMath(condor, LOT);
  assert.equal(m.netPremium, 40 * LOT);
  assert.equal(m.maxGain, 40 * LOT);
  assert.equal(m.maxLoss, 60 * LOT);
  assert.deepEqual(m.breakevens, [23760, 24440]);
  assert.equal(riskedAmount(m), 60 * LOT);
});

const idea: FnoTradeIdea = {
  id: 1,
  underlying: 'NIFTY',
  label: 'Bull call spread',
  view: 'Mildly bullish',
  legs: bullCallSpread,
  lotSize: LOT,
  expiry: '2026-09-16',
  spot: 24000,
  capitalRequired: 3250,
  nakedCapitalRequired: 13000,
  ivPercentile: 75,
  convictionPct: 60,
  rationale: '',
};

test('the needs sentence names the breakeven and its distance from spot', () => {
  const m = structureMath(bullCallSpread, LOT);
  assert.equal(needsSentence(idea, m), 'NIFTY above 24,050 (+0.2%)');
  const strangle = [leg('sell', 'PE', 23800, 40), leg('sell', 'CE', 24200, 40)];
  const condor = structureMath(strangle, LOT);
  assert.equal(
    needsSentence({...idea, legs: strangle}, condor),
    'NIFTY between 23,720 (-1.2%) and 24,280 (+1.2%)',
  );
  assert.equal(needsSentence(idea, {...m, breakevens: []}), null);
});

test('cost drag sums the injected per-leg charges against the best case', () => {
  const m = structureMath(bullCallSpread, LOT);
  const drag = costDrag(idea, m, (price, qty) => price * qty * 0.001);
  assert.equal(drag.total, (100 + 50) * LOT * 0.001);
  assert.equal(drag.shareOfMaxGainPct, (drag.total / (50 * LOT)) * 100);
  assert.equal(
    costDrag(idea, {...m, maxGain: null}, () => 1).shareOfMaxGainPct,
    null,
  );
});

test('iv read, margin unlock and the chat description', () => {
  assert.equal(ivRead(75)?.stance, 'rich');
  assert.equal(ivRead(20)?.stance, 'cheap');
  assert.equal(ivRead(50)?.stance, 'fair');
  assert.equal(ivRead(null), null);
  assert.equal(marginUnlockPct(idea), 75);
  assert.equal(marginUnlockPct({...idea, nakedCapitalRequired: 3000}), null);
  assert.equal(
    describeStructure(idea, 'Place'),
    'Place Bull call spread on NIFTY, expiry 2026-09-16. Legs: BUY 1 lot(s) NIFTY 24000 CE @ 100; SELL 1 lot(s) NIFTY 24100 CE @ 50. Lot size 65.',
  );
});

test('exit state measures pnl against the amount risked', () => {
  const legs = [leg('buy', 'CE', 24000, 10)];
  const base = {legs, lotSize: LOT, entryNet: -650, currentNet: -325};
  const state = positionExitState({...base, planExitPct: -40});
  assert.equal(state.pnl, -325);
  assert.equal(state.pnlPct, -50);
  assert.equal(state.breached, true);
  assert.equal(state.nearing, false);

  const nearing = positionExitState({
    ...base,
    currentNet: -455,
    planExitPct: -40,
  });
  assert.equal(nearing.pnlPct, -30);
  assert.equal(nearing.breached, false);
  assert.equal(nearing.nearing, true);

  const unknownLot = positionExitState({
    ...base,
    lotSize: null,
    planExitPct: -40,
  });
  assert.equal(unknownLot.pnl, -325);
  assert.equal(unknownLot.pnlPct, null);
  assert.equal(unknownLot.breached, false);

  const future = positionExitState({
    legs: [leg('buy', 'FUT', 0, 24000)],
    lotSize: LOT,
    entryNet: 0,
    currentNet: 500,
    planExitPct: -10,
  });
  assert.equal(future.pnlPct, null);
  assert.equal(future.breached, false);
});

test('days to expiry counts whole days and rejects non-dates', () => {
  const now = Date.parse('2026-09-13T06:00:00Z');
  assert.equal(daysToExpiry('2026-09-16', now), 3);
  assert.equal(daysToExpiry('2026-09-10', now), -3);
  assert.equal(daysToExpiry('nope', now), null);
});

test('index expiries follow the Tuesday weekly/monthly cadence', () => {
  const friday = new Date('2026-09-11T05:00:00Z');
  assert.equal(nextIndexExpiry('NIFTY', friday), '2026-09-15');
  assert.equal(nextIndexExpiry('BANKNIFTY', friday), '2026-09-29');
  assert.equal(nextIndexExpiry('INDIAVIX', friday), null);
  assert.equal(nextIndexExpiry('NIFTY100', friday), null);

  const tuesdayAfterClose = new Date('2026-09-15T11:00:00Z');
  assert.equal(nextIndexExpiry('nifty', tuesdayAfterClose), '2026-09-22');
  const tuesdayInSession = new Date('2026-09-15T05:00:00Z');
  assert.equal(nextIndexExpiry('NIFTY', tuesdayInSession), '2026-09-15');

  // 2026-11-24 is a Tuesday exchange holiday, so that series settles on the Monday.
  assert.equal(
    nextIndexExpiry('NIFTY', new Date('2026-11-18T05:00:00Z')),
    '2026-11-23',
  );
});
