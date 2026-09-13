import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {OptionChainRow} from '../../types/fno.ts';
import {
  buildOiLadder,
  buildOptionContractSymbol,
  byExpiryDate,
  computeChainSentiment,
  computeMaxPain,
  expiryPickerOptions,
  formatExpiryLabel,
  formatIv,
  formatOi,
  formatPremium,
  ivContext,
  nearestExpiry,
  optionContractLabel,
  payoffGap,
  pcrDelta,
  positionIn,
  positioningReadout,
  positioningVerdict,
  selectAtmWindow,
  tradableChainRows,
} from '../optionChain.ts';

const row = (
  strike: number,
  over: Partial<OptionChainRow> = {},
): OptionChainRow => ({
  strike,
  ceLtp: null,
  peLtp: null,
  isAtm: false,
  ceOi: null,
  peOi: null,
  cePrevOi: null,
  pePrevOi: null,
  ceIv: null,
  peIv: null,
  cePrevClose: null,
  pePrevClose: null,
  ceDelta: null,
  peDelta: null,
  ceGamma: null,
  peGamma: null,
  ceTheta: null,
  peTheta: null,
  ceVolume: null,
  peVolume: null,
  ceStockName: null,
  peStockName: null,
  ceBuyQty: null,
  peBuyQty: null,
  ceSellQty: null,
  peSellQty: null,
  ceDayHighOi: null,
  peDayHighOi: null,
  ceDayLowOi: null,
  peDayLowOi: null,
  ceBestBid: null,
  peBestBid: null,
  ceBestAsk: null,
  peBestAsk: null,
  ceSpreadBps: null,
  peSpreadBps: null,
  ...over,
});

test('contract symbols strip the expiry to alphanumerics', () => {
  assert.equal(
    buildOptionContractSymbol('nifty', '2024-07-25', 21000, 'CE'),
    'NIFTY20240725' + '21000CE',
  );
  assert.equal(
    buildOptionContractSymbol('NIFTY', undefined, 21000, 'PE'),
    'NIFTY21000PE',
  );
});

test('expiries sort chronologically and fall back to lexical for tokens', () => {
  assert.deepEqual(
    ['2026-09-30', '2026-09-16', '2026-10-27'].sort(byExpiryDate),
    ['2026-09-16', '2026-09-30', '2026-10-27'],
  );
  assert.deepEqual(['26OCT', '26AUG'].sort(byExpiryDate), ['26AUG', '26OCT']);
});

test('nearest expiry is the first still ahead, else the furthest listed', () => {
  const now = Date.parse('2026-09-13T06:00:00Z');
  assert.equal(
    nearestExpiry(['2026-09-30', '2026-09-09', '2026-09-16'], now),
    '2026-09-16',
  );
  assert.equal(nearestExpiry(['2026-09-01', '2026-09-09'], now), '2026-09-09');
  assert.equal(nearestExpiry([], now), undefined);
});

test('expiry labels are "DD Mon" with September trimmed to three letters', () => {
  assert.equal(formatExpiryLabel('2026-08-18'), '18 Aug');
  assert.equal(formatExpiryLabel('2026-09-16'), '16 Sep');
  assert.equal(formatExpiryLabel('SEP26W1'), 'SEP26W1');
  assert.equal(formatExpiryLabel(undefined), '—');
  assert.equal(
    optionContractLabel('nifty', '2026-08-18', 24550, 'CE'),
    'NIFTY 18 Aug 24,550 Call',
  );
});

test('picker options carry a DTE hint only for live expiries', () => {
  const now = Date.parse('2026-09-13T00:00:00Z');
  const [past, ahead] = expiryPickerOptions(['2026-09-01', '2026-09-16'], now);
  assert.equal(past?.hint, undefined);
  assert.equal(ahead?.hint, '3 DTE');
  assert.equal(ahead?.label, '16 Sep');
});

test('OI, IV and premium formatters follow the Indian conventions', () => {
  assert.equal(formatOi(12_500_000), '1.25Cr');
  assert.equal(formatOi(250_000), '2.5L');
  assert.equal(formatOi(1_500), '1.5K');
  assert.equal(formatOi(-999), '-999');
  assert.equal(formatIv(0.0943), '9.43%');
  assert.equal(formatIv(0), '—');
  assert.equal(formatPremium(1240.5), '₹1,240.50');
  assert.equal(formatPremium(null), '—');
});

const chain = [
  row(24000, {
    ceOi: 100,
    peOi: 400,
    cePrevOi: 90,
    pePrevOi: 300,
    ceIv: 0.1,
    peIv: 0.2,
  }),
  row(24100, {
    ceOi: 200,
    peOi: 200,
    ceLtp: 120,
    peLtp: 80,
    ceIv: 0.12,
    peIv: 0.14,
  }),
  row(24200, {ceOi: 400, peOi: 100, ceIv: 0.16, peIv: 0.18}),
];

test('chain sentiment falls back to the atm strike when no row is flagged', () => {
  const s = computeChainSentiment(chain, 24100);
  assert.equal(s.pcr, 700 / 700);
  assert.equal(s.expectedMove, 200);
  assert.equal(s.atmIv, 0.13);
  assert.deepEqual(computeChainSentiment([]), {
    pcr: null,
    expectedMove: null,
    atmIv: null,
    callOi: 0,
    putOi: 0,
  });
  assert.equal(computeChainSentiment(chain).expectedMove, null);
});

test('max pain is the strike with the least writer intrinsic value', () => {
  assert.equal(computeMaxPain(chain), 24100);
  assert.equal(computeMaxPain([row(24000), row(24100)]), null);
  assert.equal(computeMaxPain([]), null);
});

test('tradable rows drop never-traded strikes unless nothing has traded', () => {
  const rows = [
    row(1, {ceLtp: 0, peLtp: 0}),
    row(2, {ceLtp: 5, peLtp: 0}),
    row(3),
  ];
  assert.deepEqual(
    tradableChainRows(rows).map(r => r.strike),
    [2],
  );
  assert.deepEqual(
    tradableChainRows([row(1, {ceLtp: 0}), row(2)]).map(r => r.strike),
    [1],
  );
});

test('the atm window is centred on the pivot and clamped to the ladder', () => {
  const rows = [1, 2, 3, 4, 5, 6].map(k => row(k * 100, {ceOi: 1}));
  assert.deepEqual(
    selectAtmWindow(rows, 310, 3).map(r => r.strike),
    [200, 300, 400],
  );
  assert.deepEqual(
    selectAtmWindow(rows, 600, 4).map(r => r.strike),
    [300, 400, 500, 600],
  );
  assert.deepEqual(selectAtmWindow([row(100)], 100, 3), []);
});

test('payoff gap names the field the trader still has to fill', () => {
  assert.equal(payoffGap(null, true), undefined);
  assert.equal(
    payoffGap({side: 'buy', qty: 1, price: null}, false),
    'Waiting for a quote on this contract',
  );
  assert.equal(
    payoffGap({side: 'buy', qty: 1, price: 0}, true),
    'Please enter a valid limit price',
  );
  assert.equal(
    payoffGap({side: 'buy', qty: 0, price: 10}, true),
    "Enter a quantity to see this trade's payoff",
  );
  assert.equal(payoffGap({side: 'buy', qty: 1, price: 10}, true), undefined);
});

test('the OI ladder spans spot ±4% widened to the walls and shares one peak', () => {
  const rows = [23000, 23500, 24000, 24100, 24200, 25500].map(k =>
    row(k, {ceOi: k === 25500 ? 800 : 100, peOi: k === 23000 ? 50 : 200}),
  );
  const ladder = buildOiLadder(rows, 24100, {resistance: 25500});
  assert.ok(ladder);
  assert.deepEqual(
    ladder.bars.map(b => b.strike),
    [23500, 24000, 24100, 24200, 25500],
  );
  assert.equal(ladder.min, 23500);
  assert.equal(ladder.max, 25500);
  assert.equal(ladder.bars[4]?.callShare, 1);
  assert.equal(ladder.bars[0]?.putShare, 0.25);
  assert.equal(buildOiLadder(rows, null), null);
  assert.equal(buildOiLadder([row(1, {ceOi: 1})], 1), null);
});

test('positioning reads the pcr onto a fixed track', () => {
  assert.equal(positionIn(5, 0, 10), 0.5);
  assert.equal(positionIn(50, 0, 10), 1);
  assert.equal(positionIn(5, 10, 10), null);
  assert.equal(positioningVerdict(1.3)?.stance, 'bullish');
  assert.equal(positioningVerdict(0.7)?.stance, 'bearish');
  assert.equal(positioningVerdict(1.0)?.label, 'Neutral');
  assert.equal(positioningVerdict(2)?.bias, 1);
  assert.equal(positioningVerdict(null), null);
  assert.equal(pcrDelta(chain, 1), 1 - 300 / 90);
  assert.equal(pcrDelta(chain, null), null);
});

test('iv context places the atm within today’s smile', () => {
  const ctx = ivContext(chain, 0.13);
  assert.ok(ctx);
  assert.equal(ctx.low, 0.1);
  assert.equal(ctx.high, 0.2);
  assert.equal(ctx.position, 0.3);
  assert.equal(ivContext(chain.slice(0, 1), 0.13), null);
});

test('the readout names both walls and the nearer constraint', () => {
  const text = positioningReadout({
    verdict: positioningVerdict(0.7),
    spot: 24100,
    maxPain: 24100,
    support: 23800,
    resistance: 24200,
    expectedMove: 200,
  });
  assert.ok(text);
  assert.match(text, /^Writers have 100 points of room/);
  assert.match(text, /Max pain at 24,100 sits inside the ±200/);
  assert.match(text, /A close above 24,200 would force/);
  assert.equal(
    positioningReadout({
      verdict: null,
      spot: 1,
      maxPain: null,
      expectedMove: null,
    }),
    null,
  );
});
