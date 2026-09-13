import {HOLIDAYS} from '../data/holidays.ts';
import {IST} from '../format/index.ts';

// NSE regular session: 09:15–15:30 IST, minutes-since-midnight bounds. Exported
// because the chart's scene serializer reports session bounds to the LLM and
// must not restate these hours as a second source of truth.
export const SESSION_OPEN = 9 * 60 + 15;
export const SESSION_CLOSE = 15 * 60 + 30;
export const MARKET_TIMEZONE = IST;

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

/** Whether a UTC-midnight market date is a session day at all (not a weekend or holiday). */
export function isTradingDay(date: Date, market = 'IN'): boolean {
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const dateStr = marketDateString(date);
  const holidays = HOLIDAYS[market]?.[dateStr.slice(0, 4)] ?? [];
  return !holidays.includes(dateStr);
}

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
  // SESSION_OPEN is IST minutes against a UTC-midnight day, so the 5:30 offset
  // comes back off to land on the real instant.
  return new Date(day.getTime() + (SESSION_OPEN - 330) * 60_000);
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
