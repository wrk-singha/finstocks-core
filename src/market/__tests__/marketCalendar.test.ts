import assert from 'node:assert/strict';
import {test} from 'node:test';

import {setHolidayTable} from '../../data/holidayTable.ts';
import {
  addMarketDays,
  exchangeSessionRun,
  hasHolidayCalendar,
  holidaysIn,
  IST_OFFSET_MS,
  IST_OFFSET_SECONDS,
  istDateOf,
  istInstant,
  isMarketOpen,
  isMcxSessionOpen,
  isMcxTradingDay,
  isTradingDay,
  isUsDaylightDate,
  lastSessionOpen,
  marketDateString,
  marketMoment,
  marketSession,
  MCX_CLOSE_US_DAYLIGHT,
  MCX_CLOSE_US_STANDARD,
  MCX_SESSION_OPEN,
  mcxSessionClose,
  nextTradingDay,
  previousSessionClose,
  previousTradingDay,
  SESSION_CLOSE,
  SESSION_OPEN,
} from '../marketHours.ts';

/** An IST wall-clock time as an instant, whatever zone the machine is in. */
const ist = (stamp: string): Date => new Date(`${stamp}+05:30`);
/** A UTC-midnight market date. */
const day = (date: string): Date => new Date(`${date}T00:00:00Z`);
const at = (date: string, minutes: number): number =>
  istInstant(day(date), minutes);

const TRADING_DAY = '2026-10-29'; // a Thursday
const HOLIDAY = '2026-10-20'; // a Tuesday, on the bundled 2026 list

test('IST offsets agree in seconds and milliseconds', () => {
  assert.equal(IST_OFFSET_SECONDS, 19_800);
  assert.equal(IST_OFFSET_MS, 19_800_000);
});

test('instants and market dates move in IST, whatever the machine zone', () => {
  assert.equal(
    istDateOf(ist(`${TRADING_DAY}T00:00`).getTime()).getTime(),
    day(TRADING_DAY).getTime(),
  );
  // 02:00 IST is still yesterday in UTC.
  assert.equal(
    istDateOf(ist(`${TRADING_DAY}T02:00`).getTime()).getTime(),
    day(TRADING_DAY).getTime(),
  );
  assert.equal(
    istDateOf(ist(`${TRADING_DAY}T23:59`).getTime()).getTime(),
    day(TRADING_DAY).getTime(),
  );
  assert.equal(
    istInstant(day(TRADING_DAY), SESSION_OPEN),
    ist(`${TRADING_DAY}T09:15`).getTime(),
  );
});

test('holidaysIn names a year from the table, and nothing for one it does not cover', () => {
  assert.equal(holidaysIn('2026').includes(HOLIDAY), true);
  assert.equal(holidaysIn(2026).includes(HOLIDAY), true);
  assert.deepEqual(holidaysIn('2099'), []);
});

test('the previous trading day steps over a holiday and a weekend', () => {
  assert.equal(
    previousTradingDay('IN', ist(`${TRADING_DAY}T10:00`)),
    '2026-10-28',
  );
  assert.equal(previousTradingDay('IN', ist(`${HOLIDAY}T12:00`)), '2026-10-19');
  assert.equal(previousTradingDay('IN', ist('2026-10-21T08:00')), '2026-10-19');
  assert.equal(previousTradingDay('IN', ist('2026-10-31T12:00')), '2026-10-30');
  assert.equal(previousTradingDay('IN', ist('2026-10-19T16:00')), '2026-10-16');
});

test('the close before a session is the trading day before it, across a holiday and a weekend', () => {
  assert.equal(
    previousSessionClose(at(TRADING_DAY, SESSION_OPEN)),
    at('2026-10-28', SESSION_CLOSE),
  );
  assert.equal(
    previousSessionClose(at('2026-10-21', SESSION_OPEN)),
    at('2026-10-19', SESSION_CLOSE),
  );
  assert.equal(
    previousSessionClose(at('2026-11-02', SESSION_OPEN)),
    at('2026-10-30', SESSION_CLOSE),
  );
});

test('New York keeps daylight time from the second Sunday of March to the first Sunday of November', () => {
  // 2026: Sun 8 Mar to Sun 1 Nov.
  assert.equal(isUsDaylightDate(day('2026-03-06')), false);
  assert.equal(isUsDaylightDate(day('2026-03-08')), true);
  assert.equal(isUsDaylightDate(day('2026-03-09')), true);
  assert.equal(isUsDaylightDate(day('2026-10-30')), true);
  assert.equal(isUsDaylightDate(day('2026-11-01')), false);
  assert.equal(isUsDaylightDate(day('2026-11-02')), false);
  // 2027: Sun 14 Mar to Sun 7 Nov.
  assert.equal(isUsDaylightDate(day('2027-03-12')), false);
  assert.equal(isUsDaylightDate(day('2027-03-15')), true);
  assert.equal(isUsDaylightDate(day('2027-11-05')), true);
  assert.equal(isUsDaylightDate(day('2027-11-08')), false);
});

test('MCX closes at 23:30 IST while the US keeps daylight time and at 23:55 while it does not', () => {
  assert.equal(MCX_SESSION_OPEN, 9 * 60);
  assert.equal(MCX_CLOSE_US_DAYLIGHT, 23 * 60 + 30);
  assert.equal(MCX_CLOSE_US_STANDARD, 23 * 60 + 55);
  assert.equal(mcxSessionClose(ist('2026-07-15T12:00')), MCX_CLOSE_US_DAYLIGHT);
  assert.equal(mcxSessionClose(ist('2026-12-15T12:00')), MCX_CLOSE_US_STANDARD);
  assert.equal(mcxSessionClose(ist('2026-10-30T12:00')), MCX_CLOSE_US_DAYLIGHT);
  assert.equal(mcxSessionClose(ist('2026-11-02T12:00')), MCX_CLOSE_US_STANDARD);
  assert.equal(mcxSessionClose(ist('2026-11-02T00:05')), MCX_CLOSE_US_STANDARD);
  // Read on the IST date: 00:30 IST on Mon 9 Mar is still Sun 8 Mar in UTC, and already the week
  // daylight time began.
  assert.equal(mcxSessionClose(ist('2026-03-09T00:30')), MCX_CLOSE_US_DAYLIGHT);
  assert.equal(mcxSessionClose(ist('2026-03-06T12:00')), MCX_CLOSE_US_STANDARD);
});

test('MCX trades 09:00 to its close on a weekday, both minutes in, and never at the weekend', () => {
  // Fri 23 Oct 2026, US daylight time.
  assert.equal(isMcxSessionOpen(ist('2026-10-23T08:59')), false);
  assert.equal(isMcxSessionOpen(ist('2026-10-23T09:00')), true);
  assert.equal(isMcxSessionOpen(ist('2026-10-23T15:31')), true);
  assert.equal(isMcxSessionOpen(ist('2026-10-23T23:30:59')), true);
  assert.equal(isMcxSessionOpen(ist('2026-10-23T23:31')), false);
  // Mon 2 Nov 2026, US standard time: the evening runs to 23:55.
  assert.equal(isMcxSessionOpen(ist('2026-11-02T23:55')), true);
  assert.equal(isMcxSessionOpen(ist('2026-11-02T23:56')), false);
  // Sat 24 and Sun 25 Oct; 00:10 IST Saturday is a Friday evening in UTC.
  assert.equal(isMcxSessionOpen(ist('2026-10-24T12:00')), false);
  assert.equal(isMcxSessionOpen(ist('2026-10-25T20:00')), false);
  assert.equal(isMcxSessionOpen(ist('2026-10-24T00:10')), false);
});

test('MCX trades on an NSE holiday, which NSE does not', () => {
  assert.equal(isMcxTradingDay(day(HOLIDAY)), true);
  assert.equal(isMcxSessionOpen(ist(`${HOLIDAY}T12:00`)), true);
  assert.equal(isMarketOpen('IN', ist(`${HOLIDAY}T12:00`)), false);
  assert.equal(isMcxTradingDay(day('2026-10-31')), false);
});

test("each exchange's sessions tile to the Day P&L day they belong to", () => {
  const open = at(TRADING_DAY, SESSION_OPEN);
  assert.deepEqual(exchangeSessionRun('NSE', open), {
    prevOpen: at('2026-10-28', SESSION_OPEN),
    prevClose: at('2026-10-28', SESSION_CLOSE),
    open,
    close: at(TRADING_DAY, SESSION_CLOSE),
  });
  assert.deepEqual(exchangeSessionRun('MCX', open), {
    prevOpen: at('2026-10-28', MCX_SESSION_OPEN),
    prevClose: at('2026-10-28', MCX_CLOSE_US_DAYLIGHT),
    open: at(TRADING_DAY, MCX_SESSION_OPEN),
    close: at(TRADING_DAY, MCX_CLOSE_US_DAYLIGHT),
  });
  // The Monday before the Tuesday holiday owns MCX's Tuesday evening too.
  assert.deepEqual(exchangeSessionRun('MCX', at('2026-10-19', SESSION_OPEN)), {
    prevOpen: at('2026-10-16', MCX_SESSION_OPEN),
    prevClose: at('2026-10-16', MCX_CLOSE_US_DAYLIGHT),
    open: at('2026-10-19', MCX_SESSION_OPEN),
    close: at(HOLIDAY, MCX_CLOSE_US_DAYLIGHT),
  });
  // Across the US switch: Friday closes at 23:30, the Monday after at 23:55.
  assert.deepEqual(exchangeSessionRun('MCX', at('2026-11-02', SESSION_OPEN)), {
    prevOpen: at('2026-10-30', MCX_SESSION_OPEN),
    prevClose: at('2026-10-30', MCX_CLOSE_US_DAYLIGHT),
    open: at('2026-11-02', MCX_SESSION_OPEN),
    close: at('2026-11-02', MCX_CLOSE_US_STANDARD),
  });
  // NSE's run before a holiday-shifted session: Wednesday's open reaches back to Monday's close.
  assert.deepEqual(exchangeSessionRun('NSE', at('2026-10-21', SESSION_OPEN)), {
    prevOpen: at('2026-10-19', SESSION_OPEN),
    prevClose: at('2026-10-19', SESSION_CLOSE),
    open: at('2026-10-21', SESSION_OPEN),
    close: at('2026-10-21', SESSION_CLOSE),
  });
});

test('the session edges: open at 09:15 and at 15:30, the next day from 15:30, the last open from 09:15', () => {
  assert.equal(marketSession('IN', ist(`${TRADING_DAY}T09:14`)), 'preopen');
  assert.equal(marketSession('IN', ist(`${TRADING_DAY}T09:15`)), 'open');
  assert.equal(marketSession('IN', ist(`${TRADING_DAY}T15:30`)), 'open');
  assert.equal(marketSession('IN', ist(`${TRADING_DAY}T15:31`)), 'closed');
  assert.equal(nextTradingDay('IN', ist(`${TRADING_DAY}T15:29`)), TRADING_DAY);
  assert.equal(nextTradingDay('IN', ist(`${TRADING_DAY}T15:30`)), '2026-10-30');
  assert.equal(
    lastSessionOpen('IN', ist(`${TRADING_DAY}T09:14`)).getTime(),
    at('2026-10-28', SESSION_OPEN),
  );
  assert.equal(
    lastSessionOpen('IN', ist(`${TRADING_DAY}T09:15`)).getTime(),
    at(TRADING_DAY, SESSION_OPEN),
  );
});

// Last: these replace the bundled table for the rest of this file.
test("every calendar answer follows the backend's table once a client hands it over", () => {
  const shortNotice = '2026-10-29';
  assert.equal(isTradingDay(day(shortNotice)), true);
  assert.equal(hasHolidayCalendar(day('2027-03-10')), false);
  assert.equal(marketMoment(ist('2027-03-10T10:00')), 'unknown');

  // A closure announced at short notice, and next year listed before core lists it.
  const bundled2026 = holidaysIn('2026');
  assert.equal(
    setHolidayTable({
      IN: {'2026': [...bundled2026, shortNotice], '2027': ['2027-01-26']},
    }),
    true,
  );
  assert.equal(isTradingDay(day(shortNotice)), false);
  assert.equal(marketSession('IN', ist(`${shortNotice}T10:00`)), 'closed');
  assert.equal(isMarketOpen('IN', ist(`${shortNotice}T10:00`)), false);
  assert.equal(marketMoment(ist(`${shortNotice}T10:00`)), 'holiday');
  assert.equal(nextTradingDay('IN', ist('2026-10-28T16:00')), '2026-10-30');
  assert.equal(
    lastSessionOpen('IN', ist(`${shortNotice}T10:00`)).getTime(),
    at('2026-10-28', SESSION_OPEN),
  );
  assert.equal(previousTradingDay('IN', ist('2026-10-30T10:00')), '2026-10-28');
  assert.equal(hasHolidayCalendar(day('2027-03-10')), true);
  assert.equal(marketMoment(ist('2027-03-10T10:00')), 'live');
  assert.equal(isTradingDay(day('2027-01-26')), false);
  // MCX keeps its own days: an NSE closure is still an MCX session.
  assert.equal(isMcxSessionOpen(ist(`${shortNotice}T10:00`)), true);
  assert.equal(
    marketDateString(addMarketDays(day(shortNotice), 1)),
    '2026-10-30',
  );
});
