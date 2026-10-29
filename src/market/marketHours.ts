import {holidaysFor} from '../data/holidayTable.ts';
import {IST} from '../format/date.ts';
import type {MarketSession} from '../types/market.ts';

// NSE regular session: 09:15–15:30 IST, minutes-since-midnight bounds. Exported
// because the chart's scene serializer reports session bounds to the LLM and
// must not restate these hours as a second source of truth.
export const SESSION_OPEN = 9 * 60 + 15;
export const SESSION_CLOSE = 15 * 60 + 30;
/** NSE's equity pre-open call auction: 09:00 until the 09:15 open. */
export const PRE_OPEN_START = 9 * 60;
export const MARKET_TIMEZONE = IST;
/** IST is UTC+05:30 all year (no daylight saving): an IST wall clock is this far ahead of UTC. */
export const IST_OFFSET_SECONDS = 330 * 60;
export const IST_OFFSET_MS = IST_OFFSET_SECONDS * 1000;

const DAY_MS = 86_400_000;

// Hoisted: constructing a DateTimeFormat costs more than the check itself, and
// the chart's scene serializer calls this on every message send.
const marketClock = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// Date-only IST clock. en-CA formats as YYYY-MM-DD, which is the shape the
// holiday list and every date-only API field already use.
const marketDateClock = new Intl.DateTimeFormat('en-CA', {
  timeZone: MARKET_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Today in IST, as a UTC-midnight Date.
 *
 * Every calendar helper below works in UTC on purpose: a Date built from the
 * device's local midnight shifts by a day under ±12h offsets, which would put
 * an expiry on the wrong side of "today" for anyone outside India.
 */
export function marketToday(now: Date = new Date()): Date {
  return new Date(`${marketDateClock.format(now)}T00:00:00Z`);
}

/** YYYY-MM-DD for a UTC-midnight market date. */
export function marketDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The same date shifted by whole days, still UTC-midnight. */
export function addMarketDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Whole IST calendar days from today until a YYYY-MM-DD date; negative once past.
 *
 * Both ends are UTC midnights, so this counts calendar days exactly — unlike
 * dividing an elapsed-millisecond gap, which reports a date-only expiry as a day
 * further out during the IST small hours (00:00–05:30 IST is still "yesterday"
 * in UTC).
 */
export function marketDaysUntil(
  dateStr: string,
  now: Date = new Date(),
): number | null {
  const target = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(target.getTime())) return null;
  return Math.round(
    (target.getTime() - marketToday(now).getTime()) / 86_400_000,
  );
}

/** Minutes since IST midnight — the same scale as SESSION_OPEN/SESSION_CLOSE. */
export function marketMinutesNow(now: Date = new Date()): number {
  const parts = marketClock.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '';
  // hour "24" can surface at midnight under hour12:false; normalise to 0.
  return (Number(get('hour')) % 24) * 60 + Number(get('minute'));
}

/** The market's holiday dates in a year, YYYY-MM-DD; empty for a year the table does not cover. */
export function holidaysIn(
  year: string | number,
  market = 'IN',
): readonly string[] {
  return holidaysFor(market, year) ?? [];
}

/**
 * Whether the holiday table covers this UTC-midnight date's year: outside it a session day is a
 * guess. A year with no dates is not covered, as the backend reads coverage from the dates present.
 */
export function hasHolidayCalendar(date: Date, market = 'IN'): boolean {
  return holidaysIn(date.getUTCFullYear(), market).length > 0;
}

/** Whether a UTC-midnight market date is a session day at all (not a weekend or holiday). */
export function isTradingDay(date: Date, market = 'IN'): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const dateStr = marketDateString(date);
  return !holidaysIn(dateStr.slice(0, 4), market).includes(dateStr);
}

/** The last trading day before today (IST), as YYYY-MM-DD. */
export function previousTradingDay(
  market = 'IN',
  now: Date = new Date(),
): string {
  return stepSession(marketDateString(marketToday(now)), -1, market);
}

/** The UTC-midnight date of the IST day the instant `ms` falls on. */
export const istDateOf = (ms: number): Date =>
  new Date(Math.floor((ms + IST_OFFSET_MS) / DAY_MS) * DAY_MS);

/** IST wall-clock `minutes` on a UTC-midnight market date, as an instant (ms). */
export const istInstant = (day: Date, minutes: number): number =>
  day.getTime() - IST_OFFSET_MS + minutes * 60_000;

/**
 * UTC instant of the most recent session open — the boundary market-derived
 * data goes stale across.
 *
 * Walks back to the last trading day rather than subtracting 24h: on a Sunday
 * the live boundary is Friday's open, because nothing has moved since. Before
 * today's 09:15 the session hasn't started, so the previous trading day still
 * owns the boundary.
 */
export function lastSessionOpen(market = 'IN', now: Date = new Date()): Date {
  let day = marketToday(now);
  if (marketMinutesNow(now) < SESSION_OPEN || !isTradingDay(day, market)) {
    do {
      day = addMarketDays(day, -1);
    } while (!isTradingDay(day, market));
  }
  return new Date(istInstant(day, SESSION_OPEN));
}

/**
 * 15:30 IST on the trading day before the session opening at `openMs`. Anything entered after it
 * (an after-hours fill, the pre-open) is that session's.
 */
export function previousSessionClose(openMs: number, market = 'IN'): number {
  let day = istDateOf(openMs);
  for (let i = 0; i < 14; i++) {
    day = addMarketDays(day, -1);
    if (isTradingDay(day, market)) break;
  }
  return istInstant(day, SESSION_CLOSE);
}

/**
 * The next date the market trades, as YYYY-MM-DD.
 *
 * Today counts only while its session is still ahead — after 15:30, and on a
 * weekend or holiday, the answer is a later day. Walks the same holiday table
 * `isTradingDay` reads, so a Friday evening lands on Monday and a Thursday
 * before a Friday holiday lands on the following Monday.
 *
 * Capped at a fortnight: the holiday table runs out after 2026, and a corrupt
 * table must not spin. Past the cap the last date walked is returned rather
 * than nothing, so callers always have a day to name.
 */
export function nextTradingDay(market = 'IN', now: Date = new Date()): string {
  const today = marketToday(now);
  if (isTradingDay(today, market) && marketMinutesNow(now) < SESSION_CLOSE) {
    return marketDateString(today);
  }
  let day = today;
  for (let i = 0; i < 14; i++) {
    day = addMarketDays(day, 1);
    if (isTradingDay(day, market)) break;
  }
  return marketDateString(day);
}

/**
 * True iff the NSE market is currently open, evaluated in IST regardless of the
 * device's local timezone. Live F&O sections use it to show an honest "streams
 * during market hours" notice off-hours instead of an idle socket.
 */
export function isMarketOpen(market = 'IN', now: Date = new Date()): boolean {
  if (!isTradingDay(marketToday(now), market)) return false;
  const minutes = marketMinutesNow(now);
  return minutes >= SESSION_OPEN && minutes <= SESSION_CLOSE;
}

/**
 * Which part of the NSE day it is — pre-open, open or closed — evaluated in
 * IST regardless of the device's local timezone. Mirrors calendar.SessionAt in
 * backend-go, which stamps every depth book with the session it was served for.
 */
export function marketSession(
  market = 'IN',
  now: Date = new Date(),
): MarketSession {
  if (!isTradingDay(marketToday(now), market)) return 'closed';
  const minutes = marketMinutesNow(now);
  if (minutes >= PRE_OPEN_START && minutes < SESSION_OPEN) return 'preopen';
  return minutes >= SESSION_OPEN && minutes <= SESSION_CLOSE
    ? 'open'
    : 'closed';
}

/**
 * Where an instant falls in the NSE week, in IST: what the chat greeting is chosen by. `preOpen`
 * is the whole morning before 09:15, not the 09:00-09:15 pre-open auction.
 */
export type MarketMoment =
  'preOpen' | 'live' | 'closed' | 'weekend' | 'holiday' | 'unknown';

/**
 * The NSE moment at `now`, in IST. A weekday in a year the holiday table does
 * not cover is `unknown` rather than a session day: it may be a holiday nobody
 * has listed yet, so nothing says the market opens.
 */
export function marketMoment(now: Date): MarketMoment {
  const today = marketToday(now);
  const weekday = today.getUTCDay();
  if (weekday === 0 || weekday === 6) return 'weekend';
  if (!hasHolidayCalendar(today)) return 'unknown';
  if (!isTradingDay(today)) return 'holiday';
  const minutes = marketMinutesNow(now);
  if (minutes < SESSION_OPEN) return 'preOpen';
  return minutes <= SESSION_CLOSE ? 'live' : 'closed';
}

/** Stored 1-minute history starts here: nothing earlier was recorded, so no replay or history read reaches before it. */
export const FNO_HISTORY_START = '2026-01-02';

/** One NSE session, as Unix seconds. */
export interface TradingSession {
  /** YYYY-MM-DD, the IST trading date. */
  date: string;
  /** 00:00 IST that day. */
  midnight: number;
  /** 09:15 IST. */
  open: number;
  /** 15:30 IST. */
  close: number;
}

/** The session bounds of an IST date (YYYY-MM-DD), whatever the device's time zone. */
export function sessionFor(date: string): TradingSession {
  const midnight = Date.parse(`${date}T00:00:00Z`) / 1000 - IST_OFFSET_SECONDS;
  return {
    date,
    midnight,
    open: midnight + SESSION_OPEN * 60,
    close: midnight + SESSION_CLOSE * 60,
  };
}

/** The session the stored data most recently covers: today once it has opened, else the last trading day. */
export function latestSession(
  market = 'IN',
  now: Date = new Date(),
): TradingSession {
  return sessionFor(
    marketDateString(marketToday(lastSessionOpen(market, now))),
  );
}

/**
 * The trading day one session before (-1) or after (1) an IST date (YYYY-MM-DD). Gives up after
 * ten calendar days, so a corrupt holiday table cannot spin, and then returns the last day walked.
 */
export function stepSession(date: string, step: -1 | 1, market = 'IN'): string {
  let day = new Date(`${date}T00:00:00Z`);
  for (let i = 0; i < 10; i++) {
    day = addMarketDays(day, step);
    if (isTradingDay(day, market)) break;
  }
  return marketDateString(day);
}

/** "10:15" for a count of minutes since IST midnight (SESSION_OPEN is "09:15"). */
export const minuteLabel = (minute: number): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

const SESSION_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * A session date (YYYY-MM-DD, or a stamp that starts with one) as "9 Oct"; the year is added, in
 * full, only when it is not this IST year ("9 Oct 2025"), because "9 Oct 26" reads as two days.
 * Read off the string itself, so the device's time zone never moves the day. Empty for no date.
 */
export function formatSessionDate(
  date: string | null | undefined,
  now: Date = new Date(),
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
  if (!m) return '';
  const [, year = '', month = '', day = ''] = m;
  const at = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    Number.isNaN(at.getTime()) ||
    marketDateString(at) !== `${year}-${month}-${day}`
  ) {
    return '';
  }
  const label = `${at.getUTCDate()} ${SESSION_MONTHS[at.getUTCMonth()] ?? ''}`;
  return year === marketDateString(marketToday(now)).slice(0, 4)
    ? label
    : `${label} ${year}`;
}

/** MCX's non-agri session opens at 09:00 IST. */
export const MCX_SESSION_OPEN = 9 * 60;
/** MCX's close (IST minutes) while New York keeps daylight time: its evening follows the US. */
export const MCX_CLOSE_US_DAYLIGHT = 23 * 60 + 30;
/** MCX's close (IST minutes) while New York is on standard time. */
export const MCX_CLOSE_US_STANDARD = 23 * 60 + 55;

/** The `n`th Sunday of a month (0-based month) as a UTC-midnight instant. */
const nthSunday = (year: number, month: number, n: number): number => {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return Date.UTC(year, month, 1 + ((7 - first) % 7) + 7 * (n - 1));
};

/**
 * Whether New York keeps daylight time on a UTC-midnight market date: from the second Sunday of
 * March to the first Sunday of November, the US rule since 2007. Worked out from the date rather than
 * asked of Intl in New York's zone, because a phone's Intl is not held to that zone's names. The
 * switch falls on a Sunday, when MCX is shut, so a date is enough, as backend-go's usDaylightSaving
 * says; the two ways of asking differ only on the March switch Sunday itself.
 */
export function isUsDaylightDate(day: Date): boolean {
  const year = day.getUTCFullYear();
  const at = day.getTime();
  return at >= nthSunday(year, 2, 2) && at < nthSunday(year, 10, 1);
}

/** MCX's closing minute (IST) on the market date `at` falls on. */
export function mcxSessionClose(at: Date = new Date()): number {
  return isUsDaylightDate(istDateOf(at.getTime()))
    ? MCX_CLOSE_US_DAYLIGHT
    : MCX_CLOSE_US_STANDARD;
}

/**
 * Whether MCX has a session on a UTC-midnight market date: any weekday. There is no MCX holiday
 * table, and NSE's does not apply (MCX trades evenings on several NSE holidays), so an MCX-only
 * holiday reads as a session day.
 */
export function isMcxTradingDay(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

/** Whether MCX trades at `at`, on the IST clock: a weekday from 09:00 to its close, both minutes in. */
export function isMcxSessionOpen(at: Date = new Date()): boolean {
  if (!isMcxTradingDay(istDateOf(at.getTime()))) return false;
  const minutes = marketMinutesNow(at);
  return minutes >= MCX_SESSION_OPEN && minutes <= mcxSessionClose(at);
}

/** The exchanges a book's lots trade on, each with its own session. */
export type SessionExchange = 'NSE' | 'MCX';

/** An exchange's run of sessions, as instants (ms): the one before, and the one a day owns. */
export interface ExchangeSessionRun {
  prevOpen: number;
  prevClose: number;
  open: number;
  close: number;
}

/**
 * `exchange`'s sessions belonging to the NSE session opening at `openMs` (a Day P&L day). For MCX
 * that includes MCX-only days before the next NSE session (an NSE holiday's evening), so consecutive
 * runs tile with no gap.
 */
export function exchangeSessionRun(
  exchange: SessionExchange,
  openMs: number,
): ExchangeSessionRun {
  const day = istDateOf(openMs);
  if (exchange === 'NSE') {
    const prevClose = previousSessionClose(openMs);
    return {
      prevOpen: prevClose - (SESSION_CLOSE - SESSION_OPEN) * 60_000,
      prevClose,
      open: openMs,
      close: istInstant(day, SESSION_CLOSE),
    };
  }
  const mcxClose = (date: Date): number =>
    istInstant(date, mcxSessionClose(new Date(istInstant(date, 12 * 60))));
  let prev = addMarketDays(day, -1);
  for (let i = 0; i < 14 && !isMcxTradingDay(prev); i++) {
    prev = addMarketDays(prev, -1);
  }
  let nextNse = addMarketDays(day, 1);
  for (let i = 0; i < 14 && !isTradingDay(nextNse); i++) {
    nextNse = addMarketDays(nextNse, 1);
  }
  let last = addMarketDays(nextNse, -1);
  while (last.getTime() > day.getTime() && !isMcxTradingDay(last)) {
    last = addMarketDays(last, -1);
  }
  return {
    prevOpen: istInstant(prev, MCX_SESSION_OPEN),
    prevClose: mcxClose(prev),
    open: istInstant(day, MCX_SESSION_OPEN),
    close: mcxClose(last),
  };
}
