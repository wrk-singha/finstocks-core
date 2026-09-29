import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {FinancialPeriodRow} from '../../types/fundamentals.ts';
import {
  bidValue,
  blockedAmount,
  buildFinancialSeries,
  buildIPOSchedule,
  clampShares,
  FINANCIAL_METRIC_KEYS,
  findManagingDirector,
  IPO_CATEGORIES,
  IPO_CATEGORY_CAPS,
  ipoIssueSizeCrore,
  ipoLotSize,
  ipoMinInvestment,
  isBiddable,
  lotValue,
  MAX_BIDS,
  maxLotsFor,
  minLotsFor,
} from '../ipo.ts';

test('the lot size reads min_investment before market_lot and trusts neither at 1', () => {
  assert.equal(ipoLotSize({min_investment: 54, market_lot: 1}), 54);
  assert.equal(ipoLotSize({min_investment: 1, market_lot: 1200}), 1200);
  assert.equal(ipoLotSize({min_investment: 54, market_lot: 1200}), 54);
  assert.equal(ipoLotSize({min_investment: 1, market_lot: 1}), undefined);
  assert.equal(ipoLotSize({min_investment: null, market_lot: 0}), undefined);
  assert.equal(ipoLotSize({}), undefined);
});

test('the minimum investment is one lot at the floor of the band', () => {
  assert.equal(ipoMinInvestment(54, 260), 14_040);
});

test('an issue is biddable only with a lot size and the top of the band', () => {
  assert.equal(isBiddable(54, 270), true);
  assert.equal(isBiddable(undefined, 270), false);
  assert.equal(isBiddable(54, undefined), false);
  assert.equal(isBiddable(54, 0), false);
  assert.equal(isBiddable(0, 270), false);
  assert.equal(isBiddable(null, null), false);
});

test('the category caps stop at the UPI mandate limit, retail first', () => {
  assert.deepEqual(IPO_CATEGORIES, ['regular', 'hni']);
  assert.deepEqual(IPO_CATEGORY_CAPS.regular, {min: 0, max: 200_000});
  assert.deepEqual(IPO_CATEGORY_CAPS.hni, {min: 200_000, max: 500_000});
});

// A 54-share lot at the ₹270 top of the band is worth ₹14,580.
const LOT = 54;
const TOP = 270;

test('a lot is valued at the top of the band, and three bids is the limit', () => {
  assert.equal(lotValue(LOT, TOP), 14_580);
  assert.equal(MAX_BIDS, 3);
});

test('each category tops out at the most whole lots its cap holds', () => {
  // 13 lots is ₹1,89,540; a 14th would cross ₹2L.
  assert.equal(maxLotsFor('regular', LOT, TOP), 13);
  // 34 lots is ₹4,95,720; a 35th would cross the ₹5L mandate limit.
  assert.equal(maxLotsFor('hni', LOT, TOP), 34);
  // An SME lot of 1,200 at ₹100 is ₹1.2L: one retail lot, four HNI ones.
  assert.equal(maxLotsFor('regular', 1200, 100), 1);
  assert.equal(maxLotsFor('hni', 1200, 100), 4);
});

test('a category never offers fewer than one lot, even when one lot is over its cap', () => {
  assert.equal(maxLotsFor('regular', 1000, 300), 1);
  assert.equal(maxLotsFor('hni', 1000, 600), 1);
  assert.equal(maxLotsFor('hni', 0, TOP), 1);
  assert.equal(maxLotsFor('regular', LOT, 0), 1);
});

test('retail starts at one lot and HNI at the first lot worth more than ₹2L', () => {
  assert.equal(minLotsFor('regular', LOT, TOP), 1);
  // 13 lots is still retail; the 14th, ₹2,04,120, is the first HNI bid.
  assert.equal(minLotsFor('hni', LOT, TOP), 14);
  assert.equal(minLotsFor('hni', 1200, 100), 2);
  // Exactly ₹2L is the top of retail, so HNI begins a lot above it.
  assert.equal(minLotsFor('hni', 100, 200), 11);
  assert.equal(minLotsFor('hni', 0, TOP), 1);
  assert.equal(minLotsFor('hni', LOT, 0), 1);
});

test('the HNI floor never passes its ceiling, whatever a lot is worth', () => {
  for (let per = 1_000; per <= 800_000; per += 1_000) {
    assert.ok(
      minLotsFor('hni', per, 1) <= maxLotsFor('hni', per, 1),
      `a lot worth ₹${String(per)}`,
    );
  }
});

test('a bid is priced at the top of the band at cutoff, else at its own price', () => {
  assert.equal(bidValue({shares: 108, price: 262, cutoff: true}, TOP), 29_160);
  assert.equal(bidValue({shares: 108, price: 262, cutoff: false}, TOP), 28_296);
});

test('the bank blocks the largest bid, not the sum of them', () => {
  const bids = [
    {shares: 162, price: 270, cutoff: true},
    {shares: 108, price: 262, cutoff: false},
    {shares: 216, price: 260, cutoff: false},
  ];
  // 216 x 260 = 56,160 outbids 162 at cutoff (43,740) and 108 x 262 (28,296).
  assert.equal(blockedAmount(bids, TOP), 56_160);
  // A cheaper second bid leaves the figure where it was.
  assert.equal(blockedAmount(bids.slice(0, 2), TOP), 43_740);
  assert.equal(blockedAmount([], TOP), 0);
});

test('a share count snaps to the nearest lot and into the category', () => {
  // 100 shares is nearer two lots than one; 80 is nearer one.
  assert.equal(clampShares(100, LOT, 'regular', TOP), 108);
  assert.equal(clampShares(80, LOT, 'regular', TOP), 54);
  assert.equal(clampShares(10_000, LOT, 'regular', TOP), 13 * LOT);
  // One lot is below HNI's floor, so it lifts to the first HNI bid.
  assert.equal(clampShares(LOT, LOT, 'hni', TOP), 14 * LOT);
  assert.equal(clampShares(10_000, LOT, 'hni', TOP), 34 * LOT);
  // Nothing typed, or less than half a lot, is the category's smallest bid rather than none.
  assert.equal(clampShares(0, LOT, 'regular', TOP), LOT);
  assert.equal(clampShares(20, LOT, 'hni', TOP), 14 * LOT);
  assert.equal(clampShares(Number.NaN, LOT, 'regular', TOP), LOT);
});

test('the issue size prices the share count at the top of the band, else the struck price', () => {
  assert.equal(
    ipoIssueSizeCrore({
      issue_size: 10_000_000,
      price_max: 270,
      issue_price: 250,
    }),
    270,
  );
  assert.equal(
    ipoIssueSizeCrore({issue_size: 10_000_000, price_max: 0, issue_price: 250}),
    250,
  );
  assert.equal(ipoIssueSizeCrore({issue_size: 10_000_000}), null);
  assert.equal(ipoIssueSizeCrore({price_max: 270}), null);
});

// 2026-09-11 is a Friday and 2026-09-14 (Monday) an exchange holiday, so T+1 from a Friday close
// is the Tuesday and T+3 the Thursday.
const ISSUE = {
  open_date: '2026-09-09',
  close_date: '2026-09-11T00:00:00',
  list_date: null,
};
const at = (iso: string) => new Date(iso);

test('the schedule derives allotment and listing from the T+3 timeline, skipping holidays', () => {
  const steps = buildIPOSchedule(ISSUE, at('2026-09-10T06:00:00Z'));
  assert.deepEqual(
    steps.map(step => [step.key, step.date, step.derived]),
    [
      ['open', '2026-09-09', false],
      ['close', '2026-09-11', false],
      ['allotment', '2026-09-15', true],
      ['unblock', '2026-09-15', true],
      ['listing', '2026-09-17', true],
    ],
  );
});

test('the first step not yet behind today is current', () => {
  const states = (iso: string) =>
    buildIPOSchedule(ISSUE, at(iso)).map(step => step.state);
  // Mid-book: the close is today or ahead.
  assert.deepEqual(states('2026-09-10T06:00:00Z'), [
    'done',
    'current',
    'future',
    'future',
    'future',
  ]);
  // The weekend after the close: allotment is next, and unblock shares its date but waits.
  assert.deepEqual(states('2026-09-12T06:00:00Z'), [
    'done',
    'done',
    'current',
    'future',
    'future',
  ]);
  // Listed.
  assert.deepEqual(states('2026-09-20T06:00:00Z'), [
    'done',
    'done',
    'done',
    'done',
    'done',
  ]);
  // Before the book opens, the open date itself is the step in progress.
  assert.equal(states('2026-09-01T06:00:00Z')[0], 'current');
});

test('today is the IST calendar day, not the UTC one', () => {
  // 20:00 UTC on the 11th is 01:30 IST on the 12th: the close is behind.
  const [, close] = buildIPOSchedule(ISSUE, at('2026-09-11T20:00:00Z'));
  assert.equal(close?.state, 'done');
});

test('a published listing date wins and is not marked derived', () => {
  const steps = buildIPOSchedule(
    {...ISSUE, list_date: '2026-09-18'},
    at('2026-09-10T06:00:00Z'),
  );
  assert.deepEqual(steps.at(-1), {
    key: 'listing',
    date: '2026-09-18',
    derived: false,
    state: 'future',
  });
});

test('a Thursday close walks past a Friday holiday and the weekend', () => {
  const steps = buildIPOSchedule(
    {open_date: '2026-09-29', close_date: '2026-10-01', list_date: ''},
    at('2026-09-30T06:00:00Z'),
  );
  assert.deepEqual(
    steps.map(step => step.date),
    ['2026-09-29', '2026-10-01', '2026-10-05', '2026-10-05', '2026-10-07'],
  );
});

test('no schedule without both book dates, or with an unreadable close', () => {
  assert.deepEqual(buildIPOSchedule({...ISSUE, open_date: null}), []);
  assert.deepEqual(buildIPOSchedule({...ISSUE, close_date: null}), []);
  assert.deepEqual(buildIPOSchedule({...ISSUE, close_date: 'soon'}), []);
});

const period = (
  periodEnd: number,
  consolidated: boolean,
  metrics: Record<string, number>,
): FinancialPeriodRow => ({period_end: periodEnd, consolidated, metrics});

test('a financial series takes the consolidated row per year and the last three years, oldest first', () => {
  const periods = [
    period(202603, false, {net_sales: 610, profit_after_tax: 48}),
    period(202603, true, {net_sales: 1010, profit_after_tax: 79}),
    period(202303, true, {net_sales: 700, profit_after_tax: -12}),
    period(202503, false, {net_sales: 920}),
    period(202403, true, {net_sales: 850, profit_after_tax: 0}),
  ];
  assert.deepEqual(FINANCIAL_METRIC_KEYS, [
    'net_sales',
    'total_assets',
    'profit_after_tax',
  ]);
  assert.deepEqual(buildFinancialSeries(periods, 'net_sales'), [
    {year: 2024, value: 850},
    {year: 2025, value: 920},
    {year: 2026, value: 1010},
  ]);
  // A zero year is a missing figure, not a flat bar; a loss stays negative.
  assert.deepEqual(buildFinancialSeries(periods, 'profit_after_tax', 5), [
    {year: 2023, value: -12},
    {year: 2026, value: 79},
  ]);
  assert.deepEqual(buildFinancialSeries(periods, 'total_assets'), []);
  assert.deepEqual(buildFinancialSeries(null, 'net_sales'), []);
});

test('a period filed without its metric group is skipped', () => {
  const bare = {period_end: 202603, consolidated: true} as FinancialPeriodRow;
  assert.deepEqual(buildFinancialSeries([bare], 'net_sales'), []);
});

test('the managing director outranks the chief executive and the chairman', () => {
  assert.equal(
    findManagingDirector([
      {name: 'A Chair', designation: 'Chairman'},
      {name: ' B Ceo ', designation: {Value: 'Chief Executive Officer'}},
      {name: 'C Md', designation: 'Chairman & Managing Director'},
    ]),
    'C Md',
  );
  assert.equal(
    findManagingDirector([
      {name: 'A Chair', designation: 'Chairman'},
      {name: ' B Ceo ', designation: {Value: 'Chief Executive Officer'}},
    ]),
    'B Ceo',
  );
  assert.equal(
    findManagingDirector([{name: 'D Dir', designation: 'Director'}]),
    null,
  );
  // A titled row with no name is passed over for the next title.
  assert.equal(
    findManagingDirector([
      {name: ' ', designation: 'Managing Director'},
      {name: 'A Chair', designation: 'Chairman'},
    ]),
    'A Chair',
  );
  assert.equal(findManagingDirector(null), null);
});

test('the IPO keys are the board status and the issue code', () => {
  assert.deepEqual(queryKeys.market.ipoList('open'), ['ipo-list', 'open']);
  assert.deepEqual(queryKeys.market.ipoDetail(4521), ['ipo-detail', 4521]);
});
