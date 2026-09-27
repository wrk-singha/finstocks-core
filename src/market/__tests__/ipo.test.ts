import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {FinancialPeriodRow} from '../../types/fundamentals.ts';
import {
  buildFinancialSeries,
  buildIPOSchedule,
  FINANCIAL_METRIC_KEYS,
  findManagingDirector,
  IPO_CATEGORIES,
  IPO_CATEGORY_CAPS,
  ipoIssueSizeCrore,
  ipoLotSize,
  ipoMinInvestment,
  isBiddable,
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
