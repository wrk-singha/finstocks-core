import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  expiryChips,
  expiryInstant,
  expiryRole,
  hasWeeklies,
  liveExpiries,
} from '../expiryKit.ts';

// NIFTY as listed on 4 Oct 2026: Tuesday weeklies, October's monthly on the 27th, and
// November's a day early (Tuesday 24 Nov is a holiday).
const NIFTY = [
  '2026-10-06',
  '2026-10-13',
  '2026-10-20',
  '2026-10-27',
  '2026-11-03',
  '2026-11-10',
  '2026-11-17',
  '2026-11-23',
];

const MONTHLIES = ['2026-10-27', '2026-11-24', '2026-12-29', '2027-01-26'];

/** An instant on an IST calendar day, "HH:MM" IST. */
const ist = (day: string, time = '09:15'): number =>
  Date.parse(`${day}T${time}:00+05:30`);

const read = (expiries: readonly string[], now: number) =>
  expiryChips(expiries, now).map(chip => [chip.expiry, chip.label, chip.kind]);

test('an expiry settles at 15:30 IST on its date', () => {
  assert.equal(expiryInstant('2026-10-06'), ist('2026-10-06', '15:30'));
  assert.deepEqual(liveExpiries(NIFTY, ist('2026-10-06', '15:29')), NIFTY);
  assert.deepEqual(
    liveExpiries(NIFTY, ist('2026-10-06', '15:30')),
    NIFTY.slice(1),
  );
});

test('the live list is the unsettled dates, once each, nearest first', () => {
  assert.deepEqual(
    liveExpiries(
      ['2026-11-03', '2026-10-13', '2026-10-06', '2026-10-13'],
      ist('2026-10-07'),
    ),
    ['2026-10-13', '2026-11-03'],
  );
  assert.deepEqual(liveExpiries([], ist('2026-10-07')), []);
});

test('a weekly underlying offers its next two weeklies and its nearest monthly, in date order', () => {
  assert.deepEqual(read(NIFTY, ist('2026-10-04')), [
    ['2026-10-06', 'Weekly', 'weekly'],
    ['2026-10-13', 'Next weekly', 'nextWeekly'],
    ['2026-10-27', 'Monthly', 'monthly'],
  ]);
});

test("the monthly's chip says Monthly when it is the nearest expiry", () => {
  // The week of the monthly: it comes first, and the weeklies are the two after it.
  assert.deepEqual(read(NIFTY, ist('2026-10-21')), [
    ['2026-10-27', 'Monthly', 'monthly'],
    ['2026-11-03', 'Weekly', 'weekly'],
    ['2026-11-10', 'Next weekly', 'nextWeekly'],
  ]);
  // One weekly left before it.
  assert.deepEqual(read(NIFTY, ist('2026-10-14')), [
    ['2026-10-20', 'Weekly', 'weekly'],
    ['2026-10-27', 'Monthly', 'monthly'],
    ['2026-11-03', 'Next weekly', 'nextWeekly'],
  ]);
});

test('a monthly-only underlying offers this, next and far month', () => {
  assert.deepEqual(read(MONTHLIES, ist('2026-10-04')), [
    ['2026-10-27', 'This month', 'thisMonth'],
    ['2026-11-24', 'Next month', 'nextMonth'],
    ['2026-12-29', 'Far month', 'farMonth'],
  ]);
  // Once October's has settled the three move on.
  assert.deepEqual(read(MONTHLIES, ist('2026-10-27', '15:30')), [
    ['2026-11-24', 'This month', 'thisMonth'],
    ['2026-12-29', 'Next month', 'nextMonth'],
    ['2027-01-26', 'Far month', 'farMonth'],
  ]);
  assert.deepEqual(read(['2026-10-27'], ist('2026-10-04')), [
    ['2026-10-27', 'This month', 'thisMonth'],
  ]);
});

test('no list, or one that has all settled, offers no chips', () => {
  assert.deepEqual(expiryChips([], ist('2026-10-04')), []);
  assert.deepEqual(expiryChips(NIFTY, ist('2026-11-23', '15:30')), []);
});

test('the monthly is judged against the whole list, settled dates included', () => {
  // The 17th has settled. It is still what makes Tuesday the list's weekday, and so what makes
  // Monday the 23rd the moved monthly rather than a date seven days from the month's end.
  const listed = ['2026-11-17', '2026-11-23', '2026-12-29'];
  assert.deepEqual(read(listed, ist('2026-11-17', '15:30')), [
    ['2026-11-23', 'Monthly', 'monthly'],
  ]);
});

test('a list with any date that is not a monthly carries weeklies', () => {
  assert.equal(hasWeeklies(NIFTY), true);
  assert.equal(hasWeeklies(MONTHLIES), false);
  assert.equal(hasWeeklies([]), false);
});

test("a picker's hint is the date's role in its list", () => {
  assert.equal(expiryRole('2026-10-06', NIFTY), 'Weekly');
  assert.equal(expiryRole('2026-10-27', NIFTY), 'Monthly');
  assert.equal(expiryRole('2026-11-23', NIFTY), 'Monthly');
  assert.equal(expiryRole('2026-11-24', MONTHLIES), 'Monthly');
  // Not in the list, or no list to judge by: nothing to say.
  assert.equal(expiryRole('2026-10-08', NIFTY), null);
  assert.equal(expiryRole('2026-10-06', []), null);
  // A monthly-only list never calls a date a weekly.
  assert.equal(expiryRole('2026-10-20', MONTHLIES), null);
});
