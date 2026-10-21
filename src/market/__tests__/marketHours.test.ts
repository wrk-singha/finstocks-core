import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  addMarketDays,
  FNO_HISTORY_START,
  formatSessionDate,
  hasHolidayCalendar,
  isMarketOpen,
  isTradingDay,
  lastSessionOpen,
  latestSession,
  MARKET_TIMEZONE,
  marketDateString,
  marketDaysUntil,
  marketMinutesNow,
  marketMoment,
  marketSession,
  marketToday,
  minuteLabel,
  nextTradingDay,
  PRE_OPEN_START,
  SESSION_CLOSE,
  SESSION_OPEN,
  sessionFor,
  stepSession,
} from '../marketHours.ts';

// 2026-09-11 is a Friday; 2026-09-14 (Monday) is an exchange holiday.
const fridayOpen = new Date('2026-09-11T05:00:00Z'); // 10:30 IST
const fridayEvening = new Date('2026-09-11T11:00:00Z'); // 16:30 IST
const fridayPreOpen = new Date('2026-09-11T03:00:00Z'); // 08:30 IST
const saturday = new Date('2026-09-12T05:00:00Z');

test('session bounds and the market clock are in IST minutes', () => {
  assert.equal(MARKET_TIMEZONE, 'Asia/Kolkata');
  assert.equal(SESSION_OPEN, 555);
  assert.equal(SESSION_CLOSE, 930);
  assert.equal(marketMinutesNow(fridayOpen), 630);
  // 23:30 UTC is 05:00 IST the next day: the date rolls, the hour reads 5.
  assert.equal(marketMinutesNow(new Date('2026-09-11T23:30:00Z')), 300);
  assert.equal(
    marketDateString(marketToday(new Date('2026-09-11T23:30:00Z'))),
    '2026-09-12',
  );
});

test('market days are UTC-midnight dates that shift without drifting', () => {
  const today = marketToday(fridayOpen);
  assert.equal(today.toISOString(), '2026-09-11T00:00:00.000Z');
  assert.equal(marketDateString(addMarketDays(today, 3)), '2026-09-14');
  assert.equal(marketDaysUntil('2026-09-16', fridayOpen), 5);
  assert.equal(marketDaysUntil('2026-09-01', fridayOpen), -10);
  assert.equal(marketDaysUntil('nope', fridayOpen), null);
});

test('trading days exclude weekends and the holiday table', () => {
  assert.equal(isTradingDay(new Date('2026-09-11T00:00:00Z')), true);
  assert.equal(isTradingDay(new Date('2026-09-12T00:00:00Z')), false);
  assert.equal(isTradingDay(new Date('2026-09-14T00:00:00Z')), false);
  assert.equal(isTradingDay(new Date('2026-09-14T00:00:00Z'), 'XX'), true);
});

test('the holiday table covers whole years, and a date outside them is not a known session day', () => {
  assert.equal(hasHolidayCalendar(new Date('2026-09-11T00:00:00Z')), true);
  assert.equal(hasHolidayCalendar(new Date('2030-01-01T00:00:00Z')), false);
  assert.equal(
    hasHolidayCalendar(new Date('2026-09-11T00:00:00Z'), 'XX'),
    false,
  );
});

test('the market is open only inside the session on a trading day', () => {
  assert.equal(isMarketOpen('IN', fridayOpen), true);
  assert.equal(isMarketOpen('IN', fridayEvening), false);
  assert.equal(isMarketOpen('IN', fridayPreOpen), false);
  assert.equal(isMarketOpen('IN', saturday), false);
  assert.equal(isMarketOpen('IN', new Date('2026-09-14T05:00:00Z')), false);
});

test('the session is pre-open from 09:00, open from 09:15 to 15:30, and closed otherwise', () => {
  assert.equal(PRE_OPEN_START, 540);
  assert.equal(marketSession('IN', fridayOpen), 'open');
  // 09:00 and 09:14 IST are the auction; 09:15 is the bell.
  assert.equal(
    marketSession('IN', new Date('2026-09-11T03:30:00Z')),
    'preopen',
  );
  assert.equal(
    marketSession('IN', new Date('2026-09-11T03:44:00Z')),
    'preopen',
  );
  assert.equal(marketSession('IN', new Date('2026-09-11T03:45:00Z')), 'open');
  assert.equal(marketSession('IN', fridayPreOpen), 'closed');
  assert.equal(marketSession('IN', fridayEvening), 'closed');
  assert.equal(marketSession('IN', saturday), 'closed');
  // A holiday has no auction either.
  assert.equal(marketSession('IN', new Date('2026-09-14T03:30:00Z')), 'closed');
});

test('the last session open walks back over pre-open, weekends and holidays', () => {
  assert.equal(
    lastSessionOpen('IN', fridayOpen).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', fridayPreOpen).toISOString(),
    '2026-09-10T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', saturday).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', new Date('2026-09-14T05:00:00Z')).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
});

test('the next trading day counts today only while its session is ahead', () => {
  assert.equal(nextTradingDay('IN', fridayOpen), '2026-09-11');
  assert.equal(nextTradingDay('IN', fridayEvening), '2026-09-15');
  assert.equal(nextTradingDay('IN', saturday), '2026-09-15');
});

test('the market moment reads the IST session, weekend and holiday table', () => {
  assert.equal(marketMoment(fridayPreOpen), 'preOpen');
  // 00:00 IST Friday is still Thursday in UTC.
  assert.equal(marketMoment(new Date('2026-09-10T18:30:00Z')), 'preOpen');
  assert.equal(marketMoment(new Date('2026-09-11T03:44:00Z')), 'preOpen');
  assert.equal(marketMoment(new Date('2026-09-11T03:45:00Z')), 'live');
  assert.equal(marketMoment(fridayOpen), 'live');
  assert.equal(marketMoment(new Date('2026-09-11T10:00:00Z')), 'live');
  assert.equal(marketMoment(new Date('2026-09-11T10:01:00Z')), 'closed');
  assert.equal(marketMoment(fridayEvening), 'closed');
  assert.equal(marketMoment(saturday), 'weekend');
  // 05:00 IST Saturday, Friday evening in UTC.
  assert.equal(marketMoment(new Date('2026-09-11T23:30:00Z')), 'weekend');
  assert.equal(marketMoment(new Date('2026-09-14T05:00:00Z')), 'holiday');
});

test('a weekday past the holiday table is unknown, a weekend there still a weekend', () => {
  assert.equal(marketMoment(new Date('2099-01-05T05:00:00Z')), 'unknown');
  assert.equal(marketMoment(new Date('2099-01-03T05:00:00Z')), 'weekend');
});

const iso = (seconds: number): string => new Date(seconds * 1000).toISOString();

test('a session is its IST date with midnight, open and close as Unix seconds', () => {
  const s = sessionFor('2026-10-16');
  assert.equal(s.date, '2026-10-16');
  assert.equal(iso(s.midnight), '2026-10-15T18:30:00.000Z');
  assert.equal(iso(s.open), '2026-10-16T03:45:00.000Z');
  assert.equal(iso(s.close), '2026-10-16T10:00:00.000Z');
});

test('the latest session is today once it has opened, else the last trading day', () => {
  // 10:30 IST and 17:30 IST on Friday 16 Oct.
  assert.equal(
    latestSession('IN', new Date('2026-10-16T05:00:00Z')).date,
    '2026-10-16',
  );
  assert.equal(
    latestSession('IN', new Date('2026-10-16T12:00:00Z')).date,
    '2026-10-16',
  );
  // Saturday reads Friday.
  assert.equal(
    latestSession('IN', new Date('2026-10-17T05:00:00Z')).date,
    '2026-10-16',
  );
  // 07:30 IST Wednesday 21 Oct, before the open: Tuesday 20 Oct is a holiday, so Monday.
  assert.equal(
    latestSession('IN', new Date('2026-10-21T02:00:00Z')).date,
    '2026-10-19',
  );
  assert.equal(
    iso(latestSession('IN', new Date('2026-10-21T02:00:00Z')).open),
    '2026-10-19T03:45:00.000Z',
  );
});

test('stepping a session skips weekends and holidays either way', () => {
  assert.equal(stepSession('2026-10-21', -1), '2026-10-19');
  assert.equal(stepSession('2026-10-19', 1), '2026-10-21');
  assert.equal(stepSession('2026-10-16', 1), '2026-10-19');
  // Friday 2 Oct is a holiday: Thursday 1 Oct steps to Monday 5 Oct.
  assert.equal(stepSession('2026-10-01', 1), '2026-10-05');
  assert.equal(stepSession('2026-10-05', -1), '2026-10-01');
});

test('minutes since midnight print as a 24-hour clock', () => {
  assert.equal(minuteLabel(SESSION_OPEN), '09:15');
  assert.equal(minuteLabel(SESSION_CLOSE), '15:30');
  assert.equal(minuteLabel(0), '00:00');
  assert.equal(minuteLabel(61), '01:01');
});

test('stored history starts on 2 Jan 2026', () => {
  assert.equal(FNO_HISTORY_START, '2026-01-02');
  assert.equal(isTradingDay(new Date(`${FNO_HISTORY_START}T00:00:00Z`)), true);
});

test('a session date reads "9 Oct", with the year only when it is not this IST year', () => {
  const now = new Date('2026-10-21T06:00:00Z');
  assert.equal(formatSessionDate('2026-10-09', now), '9 Oct');
  assert.equal(formatSessionDate('2026-09-16 09:15:00', now), '16 Sep');
  assert.equal(formatSessionDate('2025-10-16', now), '16 Oct 2025');
  // 00:30 IST on 1 Jan 2027 is still 2026 in UTC: the IST year decides.
  assert.equal(
    formatSessionDate('2026-12-31', new Date('2026-12-31T19:00:00Z')),
    '31 Dec 2026',
  );
  assert.equal(formatSessionDate('', now), '');
  assert.equal(formatSessionDate(null, now), '');
  assert.equal(formatSessionDate(undefined, now), '');
  assert.equal(formatSessionDate('nope', now), '');
  assert.equal(formatSessionDate('2026-02-30', now), '');
});
