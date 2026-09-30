import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

import {formatCompactQuantity} from '../../format/number.ts';
import type {OptionChainRow} from '../../types/fno.ts';
import {
  atmRowOf,
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
  formatStrike,
  ivContext,
  nearestExpiry,
  oiTotals,
  optionContractLabel,
  payoffGap,
  pcrDelta,
  positionIn,
  positioningFacts,
  positioningReadout,
  positioningVerdict,
  selectAtmWindow,
  straddlePremium,
  strikeIv,
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

test('an ISO expiry prints as its own day west of UTC too', () => {
  // A zone is fixed when the process starts, so the check runs in one started west of UTC.
  const module = new URL('../optionChain.ts', import.meta.url).href;
  const printed = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `const {formatExpiryLabel} = await import(${JSON.stringify(module)});
       process.stdout.write(formatExpiryLabel('2026-08-18') + '|' + formatExpiryLabel('18 Aug 2026'));`,
    ],
    {env: {...process.env, TZ: 'America/New_York'}, encoding: 'utf8'},
  );
  assert.equal(printed, '18 Aug|18 Aug');
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

test('a strike prints exactly, keeping the fraction a stepped strike lists at', () => {
  assert.equal(formatStrike(24550), '24,550');
  assert.equal(formatStrike(187.5), '187.5');
  assert.equal(formatStrike(1302.25), '1,302.25');
  // A float that is a hair off its listed step still prints as that step.
  assert.equal(formatStrike(187.50000000000003), '187.5');
  assert.equal(
    optionContractLabel('tatasteel', '2026-09-29', 187.5, 'CE'),
    'TATASTEEL 29 Sep 187.5 Call',
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

test('open interest reads through the one compact count formatter', () => {
  assert.equal(formatOi, formatCompactQuantity);
  assert.equal(formatOi(1_234_567, 1), '12.3L');
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

test('oi totals sum both sides and read the pcr, null without call oi', () => {
  assert.deepEqual(oiTotals(chain), {callOi: 700, putOi: 700, pcr: 1});
  assert.deepEqual(oiTotals(chain.slice(0, 1)), {
    callOi: 100,
    putOi: 400,
    pcr: 4,
  });
  // A side the chain has not reported counts as none, not as a gap.
  assert.deepEqual(oiTotals([row(1, {peOi: 50}), row(2, {ceOi: 25})]), {
    callOi: 25,
    putOi: 50,
    pcr: 2,
  });
  assert.deepEqual(oiTotals([row(1, {peOi: 50})]), {
    callOi: 0,
    putOi: 50,
    pcr: null,
  });
  assert.deepEqual(oiTotals([]), {callOi: 0, putOi: 0, pcr: null});
});

test('the atm row is the flagged one, else the one at the atm strike', () => {
  const flagged = [row(24000), row(24100, {isAtm: true}), row(24200)];
  assert.equal(atmRowOf(flagged, 24200)?.strike, 24100);
  assert.equal(atmRowOf(chain, 24200)?.strike, 24200);
  assert.equal(atmRowOf(chain, 25000), null);
  assert.equal(atmRowOf(chain), null);
  assert.equal(atmRowOf(chain, null), null);
  assert.equal(atmRowOf([], 24100), null);
});

test('the straddle needs both sides quoting', () => {
  assert.equal(straddlePremium(row(1, {ceLtp: 120, peLtp: 80})), 200);
  assert.equal(straddlePremium(row(1, {ceLtp: 120, peLtp: 0})), null);
  assert.equal(straddlePremium(row(1, {ceLtp: null, peLtp: 80})), null);
  assert.equal(straddlePremium(null), null);
});

test('a strike iv is the mean of both sides, or the one side quoting', () => {
  assert.equal(strikeIv(row(1, {ceIv: 0.12, peIv: 0.14})), 0.13);
  assert.equal(strikeIv(row(1, {ceIv: 0, peIv: 0.14})), 0.14);
  assert.equal(strikeIv(row(1, {ceIv: 0.12})), 0.12);
  assert.equal(strikeIv(row(1)), null);
  assert.equal(strikeIv(null), null);
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

const positioningCases = {
  ceilingBinds: {
    verdict: positioningVerdict(0.7),
    spot: 24100,
    maxPain: 24100,
    support: 23800,
    resistance: 24200,
    expectedMove: 200,
  },
  floorNearer: {
    verdict: positioningVerdict(1.3),
    spot: 24100,
    maxPain: 24500,
    support: 24000,
    resistance: 24400,
    expectedMove: 180,
  },
  equalRoom: {
    verdict: positioningVerdict(1.0),
    spot: 24100,
    maxPain: null,
    support: 24000,
    resistance: 24200,
    expectedMove: null,
  },
  callOnlyBearish: {
    verdict: positioningVerdict(0.7),
    spot: 24100.4,
    maxPain: 23700,
    resistance: 24350,
    expectedMove: 150,
  },
  callOnlyBullish: {
    verdict: positioningVerdict(1.3),
    spot: 24100.6,
    maxPain: 24050,
    resistance: 24350,
    expectedMove: 150.5,
  },
  putOnly: {
    verdict: positioningVerdict(1.3),
    spot: 24100,
    maxPain: 24300,
    support: 23850,
    resistance: 24000,
    expectedMove: 150,
  },
  pinNoMove: {
    verdict: positioningVerdict(0.7),
    spot: 24100,
    maxPain: 24120,
    expectedMove: null,
  },
  pullBelowNeutral: {
    verdict: positioningVerdict(1.0),
    spot: 24100,
    maxPain: 23500,
    expectedMove: 100,
  },
  noWalls: {
    verdict: positioningVerdict(1.3),
    spot: 24100,
    maxPain: null,
    support: null,
    resistance: null,
    expectedMove: 100,
  },
  nullVerdict: {verdict: null, spot: 1, maxPain: null, expectedMove: null},
  zeroSpot: {
    verdict: positioningVerdict(1.3),
    spot: 0,
    maxPain: 1,
    expectedMove: 1,
  },
  nullSpot: {
    verdict: positioningVerdict(1.3),
    spot: null,
    maxPain: 1,
    expectedMove: 1,
  },
};

test('positioning facts: both walls, the pin and the bearish invalidation', () => {
  assert.deepEqual(positioningFacts(positioningCases.ceilingBinds), [
    {
      kind: 'ceilingBindsFirst',
      ceiling: 24200,
      floor: 23800,
      room: 100,
      cushion: 300,
    },
    {kind: 'maxPainPin', maxPain: 24100, expectedMove: 200},
    {kind: 'ceilingInvalidates', ceiling: 24200},
  ]);
  assert.deepEqual(positioningFacts(positioningCases.floorNearer), [
    {
      kind: 'floorNearer',
      ceiling: 24400,
      floor: 24000,
      room: 300,
      cushion: 100,
    },
    {kind: 'maxPainPull', distance: 400, direction: 'above', side: 'upside'},
    {kind: 'supportInvalidates', level: 24000, source: 'putWall'},
  ]);
  // Level walls read as the floor being nearer; a neutral lean has nothing to invalidate.
  assert.deepEqual(positioningFacts(positioningCases.equalRoom), [
    {
      kind: 'floorNearer',
      ceiling: 24200,
      floor: 24000,
      room: 100,
      cushion: 100,
    },
  ]);
});

test('positioning facts: one wall, rounded distances, and spot as the fallback support', () => {
  assert.deepEqual(positioningFacts(positioningCases.callOnlyBearish), [
    {kind: 'callWallOnly', ceiling: 24350, distance: 250},
    {kind: 'maxPainPull', distance: 400, direction: 'below', side: 'downside'},
    {kind: 'ceilingInvalidates', ceiling: 24350},
  ]);
  assert.deepEqual(positioningFacts(positioningCases.callOnlyBullish), [
    {kind: 'callWallOnly', ceiling: 24350, distance: 249},
    {kind: 'maxPainPin', maxPain: 24050, expectedMove: 151},
    {kind: 'supportInvalidates', level: 24101, source: 'spot'},
  ]);
  // A resistance below spot is not a ceiling, so only the put wall speaks.
  assert.deepEqual(positioningFacts(positioningCases.putOnly), [
    {kind: 'putWallOnly', floor: 23850, distance: 250},
    {kind: 'maxPainPin', maxPain: 24300, expectedMove: 150},
  ]);
});

test('positioning facts: max pain near spot without a straddle price is a pull', () => {
  assert.deepEqual(positioningFacts(positioningCases.pinNoMove), [
    {kind: 'maxPainPull', distance: 20, direction: 'above', side: 'downside'},
  ]);
  assert.deepEqual(positioningFacts(positioningCases.pullBelowNeutral), [
    {kind: 'maxPainPull', distance: 600, direction: 'below', side: 'upside'},
  ]);
});

test('positioning facts are empty with no walls, no verdict or no usable spot', () => {
  assert.deepEqual(positioningFacts(positioningCases.noWalls), []);
  assert.deepEqual(positioningFacts(positioningCases.nullVerdict), []);
  assert.deepEqual(positioningFacts(positioningCases.zeroSpot), []);
  assert.deepEqual(positioningFacts(positioningCases.nullSpot), []);
});

// Recorded from the v0.2.4 implementation before positioningReadout was rebuilt on positioningFacts.
test('positioning readout reads exactly as v0.2.4 did', () => {
  const readouts = Object.fromEntries(
    Object.entries(positioningCases).map(([name, input]) => [
      name,
      positioningReadout(input),
    ]),
  );
  assert.deepEqual(readouts, {
    ceilingBinds:
      'Writers have 100 points of room to the 24,200 call wall against 300 to the 23,800 put wall, so the ceiling binds first. Max pain at 24,100 sits inside the ±200 the straddle prices, so a pin here is the path of least resistance. A close above 24,200 would force those calls to cover and invalidate the lean.',
    floorNearer:
      'The 24,000 put wall is 100 points below against 300 to the 24,400 call wall, so the floor is the nearer constraint. Max pain 400 points above pulls against the upside. Losing 24,000 would pull the support out from under it.',
    equalRoom:
      'The 24,000 put wall is 100 points below against 100 to the 24,200 call wall, so the floor is the nearer constraint.',
    callOnlyBearish:
      'Call writers are stacked at 24,350, 250 points up — that is the level to clear. Max pain 400 points below pulls against the downside. A close above 24,350 would force those calls to cover and invalidate the lean.',
    callOnlyBullish:
      'Call writers are stacked at 24,350, 249 points up — that is the level to clear. Max pain at 24,050 sits inside the ±151 the straddle prices, so a pin here is the path of least resistance. Losing 24,101 would pull the support out from under it.',
    putOnly:
      'Put writers are defending 23,850, 250 points down. Max pain at 24,300 sits inside the ±150 the straddle prices, so a pin here is the path of least resistance.',
    pinNoMove: 'Max pain 20 points above pulls against the downside.',
    pullBelowNeutral: 'Max pain 600 points below pulls against the upside.',
    noWalls: null,
    nullVerdict: null,
    zeroSpot: null,
    nullSpot: null,
  });
});
