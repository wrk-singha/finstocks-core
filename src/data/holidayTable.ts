import {HOLIDAYS} from './holidays.ts';

/**
 * Exchange holidays as market -> year -> ISO dates (YYYY-MM-DD): the shape of `HOLIDAYS` and of
 * the backend's GET /api/market/holidays reply.
 */
export type HolidayTable = Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

// The table every calendar answer reads: isHoliday, isTradingDay, hasHolidayCalendar and all that is
// built on them. It starts as the bundled HOLIDAYS, so a client that never loads the backend's table,
// or fails to, still knows the years listed there. A client that can read the backend's table (the
// one the backend's own calendar runs on) hands it to setHolidayTable: a closure announced at short
// notice then reaches it without a release, and a year the backend lists is covered before core
// does. Callers that keep an answer (a memo, a market-open flag) hear of a change through
// subscribeHolidayTable. Read only through the functions below, never captured: a client swaps it.
let table: HolidayTable = HOLIDAYS;
let version = 0;
const listeners = new Set<() => void>();

const HOLIDAY_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MARKET = /^[A-Z]{2}$/;
const YEAR = /^\d{4}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isYearOfDates = (dates: unknown, year: string): dates is string[] =>
  Array.isArray(dates) &&
  dates.length > 0 &&
  (dates as unknown[]).every(
    date =>
      typeof date === 'string' &&
      HOLIDAY_DAY.test(date) &&
      date.startsWith(year),
  );

/** A market's holiday dates in a year, as the table has them; undefined for a year it does not cover. */
export const holidaysFor = (
  market: string,
  year: string | number,
): readonly string[] | undefined => table[market]?.[String(year)];

/** Whether `isoDate` (YYYY-MM-DD) is an exchange holiday for `market`. */
export function isHoliday(isoDate: string, market = 'IN'): boolean {
  return holidaysFor(market, isoDate.slice(0, 4))?.includes(isoDate) ?? false;
}

/**
 * Takes the backend's table in place of the one in use, whole. A year that is empty, or has any
 * entry that is not one of its own YYYY-MM-DD dates, is left out, as the backend's own parser
 * refuses such a table: a year with no holidays would read as covered and fail open. A reply with no
 * usable IN year leaves the table as it was. Returns whether the reply carried a usable IN year.
 */
export function setHolidayTable(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  const next: Record<string, Record<string, readonly string[]>> = {};
  for (const [market, years] of Object.entries(raw)) {
    if (!MARKET.test(market) || !isRecord(years)) continue;
    const clean: Record<string, readonly string[]> = {};
    for (const [year, dates] of Object.entries(years)) {
      if (YEAR.test(year) && isYearOfDates(dates, year)) {
        clean[year] = [...dates].sort();
      }
    }
    if (Object.keys(clean).length > 0) next[market] = clean;
  }
  if (next.IN === undefined) return false;
  if (JSON.stringify(next) !== JSON.stringify(table)) {
    table = next;
    version += 1;
    for (const listener of listeners) listener();
  }
  return true;
}

/** Called whenever the holiday table changes; returns the unsubscribe. */
export function subscribeHolidayTable(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bumped on every change to the holiday table: a memo over calendar answers keys on it. */
export const holidayTableVersion = (): number => version;
