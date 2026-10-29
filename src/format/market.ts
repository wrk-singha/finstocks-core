import {isHoliday} from '../data/holidayTable.ts';
import {istDayKey} from './date.ts';

const IST_OFFSET_MINUTES = 330;
const DAY_MS = 24 * 60 * 60 * 1000;

// NSE never closes for ten days running, so exhausting this means the holiday data is wrong;
// the caller falls back to the bare time rather than looping.
const MAX_CLOSED_DAYS = 10;

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  timeZone: 'UTC',
});

// The instant shifted so its UTC fields read as IST wall-clock. IST has no DST, so a fixed
// offset is exact and the check needs no timezone database — it runs the same on every device.
const asIstWallClock = (now: Date): Date =>
  new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);

const istMinutesOfDay = (now: Date): number => {
  const ist = asIstWallClock(now);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
};

// Calendar days are UTC midnights so day arithmetic never shifts under the device's offset.
const istToday = (now: Date): Date => new Date(`${istDayKey(now)}T00:00:00Z`);

const addDays = (day: Date, days: number): Date =>
  new Date(day.getTime() + days * DAY_MS);

/** Whether a UTC-midnight market date is a session day at all (not a weekend or holiday). */
const isTradingDay = (day: Date, market: string): boolean => {
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !isHoliday(day.toISOString().slice(0, 10), market);
};

/**
 * When the next batch lands, as an IST wall-clock time: "9:10 AM", "9:10 AM tomorrow",
 * "9:10 AM Monday". No batch runs on a weekend or exchange holiday, so the suffix names the
 * next trading day, not the next calendar day. Same-day carries no suffix — "Next at 9:10 AM"
 * already means today.
 */
export function formatNextBatch(
  targetHHMM: string | null | undefined,
  now: Date = new Date(),
  market = 'IN',
): string | null {
  if (!targetHHMM) return null;
  const [h, m] = targetHHMM.split(':').map(Number);
  if (
    h === undefined ||
    m === undefined ||
    Number.isNaN(h) ||
    Number.isNaN(m)
  ) {
    return null;
  }

  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;

  const today = istToday(now);
  if (isTradingDay(today, market) && istMinutesOfDay(now) < h * 60 + m) {
    return time;
  }

  let day = addDays(today, 1);
  for (let i = 0; i < MAX_CLOSED_DAYS && !isTradingDay(day, market); i++) {
    day = addDays(day, 1);
  }
  if (!isTradingDay(day, market)) return time;

  const daysOut = Math.round((day.getTime() - today.getTime()) / DAY_MS);
  if (daysOut === 1) return `${time} tomorrow`;
  // `day` is a UTC midnight; formatting it in a local zone would name the previous weekday
  // west of Greenwich.
  return `${time} ${weekdayFormatter.format(day)}`;
}
