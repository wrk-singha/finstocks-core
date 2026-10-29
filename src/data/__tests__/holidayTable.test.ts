import assert from 'node:assert/strict';
import {test} from 'node:test';

import {HOLIDAYS} from '../holidays.ts';
import {
  holidaysFor,
  holidayTableVersion,
  isHoliday,
  setHolidayTable,
  subscribeHolidayTable,
} from '../holidayTable.ts';

// Node's runner gives each test file its own process, so the table starts bundled here; the tests
// below run in order and each states the table it needs.

test('the table starts as the bundled one, so a client that loads nothing still knows its years', () => {
  assert.equal(holidayTableVersion(), 0);
  assert.deepEqual(holidaysFor('IN', 2026), HOLIDAYS.IN?.['2026']);
  assert.deepEqual(holidaysFor('IN', '2025'), HOLIDAYS.IN?.['2025']);
  assert.equal(holidaysFor('IN', 2099), undefined);
  assert.equal(isHoliday('2026-10-20'), true);
  assert.equal(isHoliday('2026-10-21'), false);
});

test('the bundled table handed back unchanged is not a change', () => {
  let heard = 0;
  const stop = subscribeHolidayTable(() => {
    heard += 1;
  });
  assert.equal(setHolidayTable(HOLIDAYS), true);
  assert.equal(heard, 0);
  assert.equal(holidayTableVersion(), 0);
  stop();
});

test("the backend's table replaces the whole table, sorted, and isHoliday follows it", () => {
  assert.equal(
    setHolidayTable({
      IN: {
        '2026': ['2026-12-25', '2026-10-20', '2026-10-22'],
        '2027': ['2027-01-26'],
      },
    }),
    true,
  );
  assert.deepEqual(holidaysFor('IN', 2026), [
    '2026-10-20',
    '2026-10-22',
    '2026-12-25',
  ]);
  assert.deepEqual(holidaysFor('IN', 2027), ['2027-01-26']);
  // Gone with the bundled table it replaced.
  assert.equal(holidaysFor('IN', 2025), undefined);
  assert.equal(isHoliday('2026-10-22'), true);
  assert.equal(isHoliday('2026-11-10'), false);
  assert.equal(isHoliday('2027-01-26'), true);
});

test('a reply with no usable IN year is refused and the last good table kept', () => {
  setHolidayTable({IN: {'2026': ['2026-10-20']}});
  const version = holidayTableVersion();
  for (const bad of [
    null,
    undefined,
    [],
    '2026-10-20',
    42,
    {},
    {IN: {'2026': []}},
    {IN: []},
    {IN: {'2026': '2026-10-20'}},
    {US: {'2026': ['2026-07-03']}},
    {IN: {'2026': ['2026-10-20', '2025-01-01']}},
    {IN: {'26': ['2026-10-20']}},
    {in: {'2026': ['2026-10-20']}},
    {IN: {'2026': ['20 Oct 2026']}},
    {IN: {'2026': ['2026-10-20', 20261020]}},
  ]) {
    assert.equal(setHolidayTable(bad), false, JSON.stringify(bad));
  }
  assert.deepEqual(holidaysFor('IN', 2026), ['2026-10-20']);
  assert.equal(holidayTableVersion(), version);
});

test('a bad year or market is left out and the good ones kept', () => {
  assert.equal(
    setHolidayTable({
      IN: {'2026': ['2026-10-20'], '2027': []},
      US: {'2026': ['July 3']},
      GB: {'2026': ['2026-12-25']},
    }),
    true,
  );
  assert.deepEqual(holidaysFor('IN', 2026), ['2026-10-20']);
  assert.equal(holidaysFor('IN', 2027), undefined);
  assert.equal(holidaysFor('US', 2026), undefined);
  assert.deepEqual(holidaysFor('GB', 2026), ['2026-12-25']);
  assert.equal(isHoliday('2026-12-25', 'GB'), true);
});

test('listeners hear a change, and only a change, until they unsubscribe', () => {
  setHolidayTable({IN: {'2026': ['2026-10-20']}});
  let heard = 0;
  const stop = subscribeHolidayTable(() => {
    heard += 1;
  });
  const version = holidayTableVersion();
  setHolidayTable({IN: {'2026': ['2026-10-20']}});
  assert.equal(heard, 0);
  assert.equal(holidayTableVersion(), version);
  setHolidayTable({IN: {'2026': ['2026-10-20', '2026-11-10']}});
  assert.equal(heard, 1);
  assert.equal(holidayTableVersion(), version + 1);
  stop();
  setHolidayTable({IN: {'2026': ['2026-10-20']}});
  assert.equal(heard, 1);
  assert.equal(holidayTableVersion(), version + 2);
});
