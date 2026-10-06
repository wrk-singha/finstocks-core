import assert from 'node:assert/strict';
import {test} from 'node:test';

import {expiryCalendar} from '../expiryDays.ts';

const dates = (days: readonly {date: string}[]) => days.map(d => d.date);

test('no listed expiries is no calendar', () => {
  assert.equal(expiryCalendar([]), null);
  assert.equal(expiryCalendar(undefined), null);
  assert.equal(expiryCalendar(['not a date']), null);
});

test("past Tuesdays are worked out from the rule, moved back over a holiday, the month's last a monthly", () => {
  // 3 and 31 March 2026 are exchange holidays: those expiries move to the Monday before.
  const calendar = expiryCalendar(
    ['2026-04-07', '2026-04-21', '2026-04-28'],
    '2026-03-01',
  );
  assert.equal(calendar?.weekly, true);
  assert.equal(calendar?.ruleFrom, '2026-03-02');
  const worked = calendar?.days.filter(d => !d.listed) ?? [];
  assert.deepEqual(dates(worked), [
    '2026-03-02',
    '2026-03-10',
    '2026-03-17',
    '2026-03-24',
    '2026-03-30',
  ]);
  assert.equal(worked.at(-1)?.cycle, 'monthly');
  assert.equal(worked[0]?.cycle, 'weekly');
  assert.deepEqual(
    calendar?.days.filter(d => d.listed).map(d => [d.date, d.cycle]),
    [
      ['2026-04-07', 'weekly'],
      ['2026-04-21', 'weekly'],
      ['2026-04-28', 'monthly'],
    ],
  );
});

test('a monthly-only list works out monthlies only', () => {
  const calendar = expiryCalendar(['2026-04-28', '2026-05-26'], '2026-02-01');
  assert.equal(calendar?.weekly, false);
  assert.deepEqual(dates(calendar?.days.filter(d => !d.listed) ?? []), [
    '2026-02-24',
    '2026-03-30',
  ]);
});

test('never before the Tuesday rule began, and not at all for a list on another weekday', () => {
  const early = expiryCalendar(['2025-10-07', '2025-10-14'], '2024-01-01');
  assert.equal(early?.days.find(d => !d.listed)?.date, '2025-09-02');
  const thursdays = expiryCalendar(['2026-10-01', '2026-10-29'], '2026-01-01');
  assert.equal(thursdays?.ruleFrom, null);
  assert.deepEqual(dates(thursdays?.days ?? []), ['2026-10-01', '2026-10-29']);
});

test('a month past the holiday table is left out, not guessed', () => {
  const calendar = expiryCalendar(['2027-03-30'], '2026-12-01');
  assert.deepEqual(dates(calendar?.days.filter(d => !d.listed) ?? []), [
    '2026-12-29',
  ]);
});
