import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  formatChartLongDate,
  formatChatListTime,
  formatDateTime,
  formatDateTimeStamp,
  formatDayMonthYear,
  formatDurationMins,
  formatEventDayHeading,
  formatLastUpdatedIST,
  formatExpiryDate,
  formatNetWorthChartDate,
  formatNotificationTime,
  formatOrderDayHeading,
  formatOrderTime,
  formatRelativeFromNow,
  formatSessionDay,
  formatShortDate,
  formatShortDateIST,
  formatShortDateTime,
  formatShortDateTimeLocal,
  formatSignalAge,
  formatTradeTimeShort,
  formatYyyymmdd,
  getChatDateGroup,
  istDateTimeParts,
  istDayKey,
  parseApiDate,
  parseTimestamp,
} from '../date.ts';

// 9 Aug 2026 09:05 IST is 03:35 UTC. Every instant below is built in UTC so the assertions hold
// under any machine timezone.
const utc = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date =>
  new Date(Date.UTC(y, mo - 1, d, h, mi, s));
const AUG_9_0905_IST = utc(2026, 8, 9, 3, 35);
const NOW = utc(2026, 8, 9, 10, 0);

test('istDayKey is the IST calendar day, not the UTC one', () => {
  // 20:00 UTC on the 31st is 01:30 IST on the 1st.
  assert.equal(
    istDayKey(new Date(Date.UTC(2026, 7, 31, 20, 0, 0))),
    '2026-09-01',
  );
  assert.equal(
    istDayKey(new Date(Date.UTC(2026, 7, 31, 12, 0, 0))),
    '2026-08-31',
  );
});

test('parseApiDate reads the Postgres text form Hermes rejects', () => {
  assert.equal(
    parseApiDate('2026-08-31 20:00:24+00')?.toISOString(),
    '2026-08-31T20:00:24.000Z',
  );
  assert.equal(
    parseApiDate('2026-08-31T20:00:24Z')?.toISOString(),
    '2026-08-31T20:00:24.000Z',
  );
  assert.equal(parseApiDate('garbage'), null);
  assert.equal(parseApiDate(null), null);
});

test('parseTimestamp normalises microseconds and every offset spelling', () => {
  assert.equal(
    parseTimestamp('2026-08-26 10:00:00.827232+00')?.toISOString(),
    '2026-08-26T10:00:00.827Z',
  );
  assert.equal(
    parseTimestamp('2026-08-26 15:30:00.5+0530')?.toISOString(),
    '2026-08-26T10:00:00.500Z',
  );
  assert.equal(
    parseTimestamp('2026-08-26 15:30:00-05')?.toISOString(),
    '2026-08-26T20:30:00.000Z',
  );
  assert.equal(
    parseTimestamp('2026-08-26T10:00:00.1Z')?.toISOString(),
    '2026-08-26T10:00:00.100Z',
  );
  assert.equal(parseTimestamp(''), null);
  assert.equal(parseTimestamp(undefined), null);
  assert.equal(parseTimestamp('2026-13-45 99:99:99'), null);
});

test('formatYyyymmdd reads the vendor integer date', () => {
  assert.equal(formatYyyymmdd(20210331), '31 Mar 2021');
  assert.equal(formatYyyymmdd(20211331), null);
  assert.equal(formatYyyymmdd(2021033), null);
  assert.equal(formatYyyymmdd(null), null);
});

test('istDateTimeParts splits an IST stamp and blanks midnight', () => {
  assert.deepEqual(istDateTimeParts('2026-08-09T03:35:00Z'), {
    date: 'Aug 9',
    time: '9:05 AM',
  });
  assert.deepEqual(istDateTimeParts('2026-08-09T03:35:00Z', true), {
    date: 'Aug 09',
    time: '9:05 AM',
  });
  // 18:30 UTC on the 8th is exactly midnight IST on the 9th.
  assert.deepEqual(istDateTimeParts('2026-08-08T18:30:00Z'), {
    date: 'Aug 9',
    time: '',
  });
  assert.deepEqual(istDateTimeParts(AUG_9_0905_IST.getTime() / 1000), {
    date: 'Aug 9',
    time: '9:05 AM',
  });
  assert.equal(istDateTimeParts(''), null);
  assert.equal(istDateTimeParts('garbage'), null);
  assert.equal(istDateTimeParts(undefined), null);
});

test('formatShortDateTime is the IST freshness stamp without a fabricated midnight', () => {
  assert.equal(formatShortDateTime('2026-08-09T03:35:00Z'), 'Aug 9 9:05 AM');
  assert.equal(formatShortDateTime('2026-08-09 15:45:00+00'), 'Aug 9 9:15 PM');
  assert.equal(formatShortDateTime('2026-08-08T18:30:00Z'), 'Aug 9');
  assert.equal(formatShortDateTime(null), '—');
  assert.equal(formatTradeTimeShort('2026-08-09T03:35:00Z'), 'Aug 9 9:05 AM');
  assert.equal(formatTradeTimeShort(undefined), '—');
});

test('formatShortDateIST names the IST day of a bare date', () => {
  assert.equal(formatShortDateIST('2026-08-08T18:30:00Z'), 'Aug 9, 2026');
  assert.equal(formatShortDateIST('2026-08-09'), 'Aug 9, 2026');
  assert.equal(formatShortDateIST(''), '—');
  assert.equal(formatShortDateIST('nope'), '—');
});

test('formatShortDate and formatShortDateTimeLocal use the device clock', () => {
  // Noon UTC lands on the same calendar day in every inhabited timezone.
  assert.equal(formatShortDate('2024-01-05T12:00:00Z'), 'Jan 5, 2024');
  assert.equal(formatShortDate(null), '—');
  assert.equal(formatShortDate('bad'), '—');
  // A zone-less ISO string is parsed as local time, so the local formatter reads it back
  // unchanged wherever the test runs.
  assert.equal(
    formatShortDateTimeLocal('2024-01-05T14:30:00'),
    'Jan 5, 02:30 PM',
  );
  assert.equal(formatShortDateTimeLocal(null), 'N/A');
});

test('formatDayMonthYear, formatDateTimeStamp and formatDateTime read local fields', () => {
  assert.equal(formatDayMonthYear(new Date(2024, 0, 5)), '05, Jan 2024');
  assert.equal(
    formatDateTimeStamp('2024-01-05T14:30:00'),
    'Jan 05, 2024 14:30',
  );
  assert.equal(formatDateTimeStamp(null), 'N/A');
  assert.equal(formatDateTimeStamp('bad'), 'N/A');
  assert.equal(formatDateTime(null), 'N/A');
  assert.equal(formatDateTime('bad'), 'N/A');
  assert.match(formatDateTime('2024-01-05T14:30:00'), /2024/);
});

test('formatRelativeFromNow floors at a day', () => {
  assert.equal(formatRelativeFromNow(undefined, NOW), 'Start');
  assert.equal(formatRelativeFromNow('bad', NOW), 'Start');
  assert.equal(formatRelativeFromNow('2026-08-09T09:00:00Z', NOW), 'Recently');
  assert.equal(
    formatRelativeFromNow('2026-08-04T10:00:00Z', NOW),
    '5 days ago',
  );
  assert.equal(
    formatRelativeFromNow('2026-06-09T10:00:00Z', NOW),
    '2 months ago',
  );
  assert.equal(
    formatRelativeFromNow('2024-08-09T10:00:00Z', NOW),
    '2 years ago',
  );
});

test('formatSignalAge keeps minutes, then falls back to the IST date', () => {
  assert.equal(formatSignalAge('2026-08-09T09:59:40Z', NOW), 'now');
  assert.equal(formatSignalAge('2026-08-09T09:48:00Z', NOW), '12m ago');
  assert.equal(formatSignalAge('2026-08-09T05:00:00Z', NOW), '5h ago');
  assert.equal(formatSignalAge('2026-08-06T10:00:00Z', NOW), '3d ago');
  assert.equal(formatSignalAge('2026-07-30T10:00:00Z', NOW), '30 Jul');
  assert.equal(formatSignalAge(null, NOW), '');
});

test('formatDurationMins picks one unit', () => {
  assert.equal(formatDurationMins(0.4), 'under a minute');
  assert.equal(formatDurationMins(Number.NaN), 'under a minute');
  assert.equal(formatDurationMins(40), '40 min');
  assert.equal(formatDurationMins(240), '4 hr');
  assert.equal(formatDurationMins(60 * 24), '24 hr');
  assert.equal(formatDurationMins(60 * 36), '2 days');
  assert.equal(formatDurationMins(60 * 24 * 5), '5 days');
});

test('formatChatListTime shows the clock today and the date otherwise', () => {
  assert.equal(formatChatListTime('2026-08-09T03:35:00Z', NOW), '9:05 AM');
  assert.equal(formatChatListTime('2026-08-03T03:35:00Z', NOW), 'Aug 3');
  // 20:00 UTC on 31 Dec is already 1 Jan in IST — this year, so no year suffix.
  assert.equal(formatChatListTime('2025-12-31T20:00:00Z', NOW), 'Jan 1');
  assert.equal(formatChatListTime('2025-08-03T03:35:00Z', NOW), 'Aug 3, 2025');
  assert.equal(formatChatListTime(undefined, NOW), '');
});

test('formatLastUpdatedIST buckets today and yesterday on the IST calendar', () => {
  assert.equal(
    formatLastUpdatedIST('2026-08-09T03:45:00Z', NOW),
    'Today 9:15 AM',
  );
  // 20:00 UTC on the 8th is 01:30 IST on the 9th — still today.
  assert.equal(
    formatLastUpdatedIST('2026-08-08T20:00:00Z', NOW),
    'Today 1:30 AM',
  );
  assert.equal(
    formatLastUpdatedIST('2026-08-08T03:45:00Z', NOW),
    'Yesterday 9:15 AM',
  );
  assert.equal(
    formatLastUpdatedIST('2026-08-03T03:45:00Z', NOW),
    'Aug 3, 9:15 AM',
  );
  assert.equal(
    formatLastUpdatedIST('2025-08-03T03:45:00Z', NOW),
    'Aug 3, 2025, 9:15 AM',
  );
  assert.equal(formatLastUpdatedIST(null, NOW), null);
  assert.equal(formatLastUpdatedIST('bad', NOW), null);
});

test('day-key headings render the day they name in every timezone', () => {
  assert.equal(formatOrderDayHeading('2026-08-09'), '09 Aug 2026');
  assert.equal(formatNetWorthChartDate('2026-08-09'), '9 Aug 26');
});

test('the events heading reads day, short month, then weekday', () => {
  assert.equal(formatEventDayHeading('2026-09-21'), '21 Sep, Mon');
  assert.equal(formatEventDayHeading('2026-10-04'), '4 Oct, Sun');
  assert.equal(formatEventDayHeading('2027-01-01'), '1 Jan, Fri');
});

test('a session reads weekday first, on its IST day, and September is "Sep"', () => {
  assert.equal(formatSessionDay('2026-10-02'), 'Fri, 2 Oct');
  assert.equal(formatSessionDay('2026-09-11'), 'Fri, 11 Sep');
  // 01:30 on the 2nd in Kolkata.
  assert.equal(formatSessionDay('2026-10-01T20:00:00Z'), 'Fri, 2 Oct');
  assert.equal(formatSessionDay('soon'), 'soon');
  assert.equal(formatSessionDay(''), '');
});

test('formatOrderTime and formatNotificationTime print the IST clock in uppercase', () => {
  assert.equal(formatOrderTime('2026-08-09T03:35:00Z'), '9:05 AM');
  assert.equal(formatOrderTime('2026-08-09 15:45:00+00'), '9:15 PM');
  assert.equal(formatOrderTime('bad'), '');
  assert.equal(
    formatNotificationTime('2026-08-09T03:35:00Z', NOW),
    '9 Aug, 9:05 AM',
  );
  assert.equal(
    formatNotificationTime('2025-08-09T03:35:00Z', NOW),
    '9 Aug 2025, 9:05 AM',
  );
  assert.equal(formatNotificationTime('', NOW), '');
});

test('getChatDateGroup buckets by IST recency', () => {
  assert.equal(getChatDateGroup('2026-08-08T20:00:00Z', NOW), 'Today');
  assert.equal(getChatDateGroup('2026-08-08T03:00:00Z', NOW), 'Yesterday');
  assert.equal(
    getChatDateGroup('2026-08-02T03:00:00Z', NOW),
    'Previous 7 Days',
  );
  assert.equal(
    getChatDateGroup('2026-07-10T03:00:00Z', NOW),
    'Previous 30 Days',
  );
  assert.equal(getChatDateGroup('2026-06-10T03:00:00Z', NOW), 'June');
  assert.equal(getChatDateGroup('2025-06-10T03:00:00Z', NOW), 'June 2025');
  assert.equal(getChatDateGroup(null, NOW), 'Older');
  assert.equal(getChatDateGroup('bad', NOW), 'Older');
});

test("an expiry reads as web's heading prints it: day, short month, two-digit year, in IST", () => {
  assert.equal(formatExpiryDate('2026-10-08'), '8 Oct 26');
  assert.equal(formatExpiryDate('2026-09-29'), '29 Sept 26');
  assert.equal(formatExpiryDate('2026-10-08T20:00:00Z'), '9 Oct 26');
  assert.equal(formatExpiryDate(''), '');
  assert.equal(formatExpiryDate(null), '');
  assert.equal(formatExpiryDate('not a day'), '');
});

test("the chart's long stamp is the IST day, with its clock for an intraday candle", () => {
  const ms = Date.parse('2026-03-12T04:45:00Z');
  assert.equal(formatChartLongDate(ms, false), '12 Mar 2026');
  assert.equal(formatChartLongDate(ms, true), '12 Mar 2026, 10:15');
  assert.equal(
    formatChartLongDate(Date.parse('2026-03-12T19:00:00Z'), false),
    '13 Mar 2026',
  );
});
