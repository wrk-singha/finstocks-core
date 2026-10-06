/**
 * An underlying's expiry days (IST dates, pure; web feat/chart-parity `utils/market/expiryDays`).
 * Upcoming ones come from the listed expiries. Past ones are worked out only where NSE's rule is
 * certain: Tuesday expiries (from 1 Sep 2025), moved back over holidays, within the holiday table,
 * at the listed cadence.
 */
import {
  hasHolidayCalendar,
  isTradingDay,
  marketDateString,
} from './marketHours.ts';
import {
  catalogueWeekday,
  dayMs,
  MAX_HOLIDAY_SHIFT_DAYS,
  monthlyExpiries,
} from './optionContract.ts';

export interface ExpiryDay {
  date: string;
  cycle: 'weekly' | 'monthly';
  /** From the listed contracts (true) or worked out from the exchange's rule (false). */
  listed: boolean;
}

export interface ExpiryCalendar {
  days: ExpiryDay[];
  /** Whether the underlying lists weekly contracts, not only monthly ones. */
  weekly: boolean;
  /** The first day the rule covers, or null when past expiries are not worked out. */
  ruleFrom: string | null;
}

/** NSE: every equity derivative expires on a Tuesday from this date (Thursday before). */
export const NSE_TUESDAY_EXPIRY_FROM = '2025-09-01';
const TUESDAY = 2;
const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `nominal` or the session before it, when a holiday or weekend shuts it; null when unknown. */
function heldOn(nominal: number): number | null {
  for (let back = 0; back <= MAX_HOLIDAY_SHIFT_DAYS; back += 1) {
    const at = new Date(nominal - back * DAY_MS);
    if (!hasHolidayCalendar(at)) return null;
    if (isTradingDay(at)) return at.getTime();
  }
  return null;
}

/** Every Tuesday of a month, as UTC-midnight milliseconds. */
function tuesdaysOf(year: number, month: number): number[] {
  const out: number[] = [];
  const first = Date.UTC(year, month, 1);
  const offset = (TUESDAY - new Date(first).getUTCDay() + 7) % 7;
  for (
    let ms = first + offset * DAY_MS;
    new Date(ms).getUTCMonth() === month;
    ms += 7 * DAY_MS
  ) {
    out.push(ms);
  }
  return out;
}

/**
 * The expiry days of an underlying whose listed expiries are `catalogue`, from `from` on (IST
 * date). Null when it lists none: no F&O, or the list failed.
 */
export function expiryCalendar(
  catalogue: readonly string[] | null | undefined,
  from: string = NSE_TUESDAY_EXPIRY_FROM,
): ExpiryCalendar | null {
  const listed = [...new Set(catalogue ?? [])]
    .filter(d => ISO_DAY.test(d))
    .sort();
  const firstListed = listed[0];
  if (firstListed === undefined) return null;
  const monthly = monthlyExpiries(listed);
  const perMonth = new Map<string, number>();
  for (const d of listed) {
    perMonth.set(d.slice(0, 7), (perMonth.get(d.slice(0, 7)) ?? 0) + 1);
  }
  const weekly = [...perMonth.values()].some(n => n > 1);

  const days: ExpiryDay[] = listed.map(date => ({
    date,
    cycle: monthly.has(date) ? 'monthly' : 'weekly',
    listed: true,
  }));

  // The rule is only known for a Tuesday calendar; a list on any other weekday means NSE has
  // moved it again, from a date we cannot know.
  const ruleFrom =
    from > NSE_TUESDAY_EXPIRY_FROM ? from : NSE_TUESDAY_EXPIRY_FROM;
  if (catalogueWeekday(listed) !== TUESDAY || ruleFrom >= firstListed) {
    return {days, weekly, ruleFrom: null};
  }
  const ruled: ExpiryDay[] = [];
  const start = new Date(dayMs(ruleFrom));
  const end = dayMs(firstListed);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  for (; Date.UTC(y, m, 1) < end; y += m === 11 ? 1 : 0, m = (m + 1) % 12) {
    const held = tuesdaysOf(y, m).map(heldOn);
    // A month the holiday table does not cover is left unshaded, not guessed.
    if (held.some(ms => ms === null)) continue;
    const dates = held.map(ms => marketDateString(new Date(ms ?? 0)));
    dates.forEach((date, i) => {
      const last = i === dates.length - 1;
      if (!last && !weekly) return;
      if (date < ruleFrom || dayMs(date) >= end) return;
      ruled.push({date, cycle: last ? 'monthly' : 'weekly', listed: false});
    });
  }
  return {
    days: [...ruled, ...days],
    weekly,
    ruleFrom: ruled[0]?.date ?? null,
  };
}
