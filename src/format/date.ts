/** The exchange's zone; every "day" in the product is an IST day. */
export const IST = 'Asia/Kolkata';

const DAY_MS = 24 * 60 * 60 * 1000;

// Hoisted: these helpers run per row in lists, and each `new Intl.*` call rebuilds an ICU
// formatter (a JNI hop into ICU4J on Android). `toLocaleDateString` builds a fresh one on
// every call, which per-trade filters run tens of thousands of times on a large book — 671ms
// of a single render in one profile.
const istDayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: IST});

/** The IST calendar day as YYYY-MM-DD — the key two timestamps share when they are "the same day". */
export const istDayKey = (d: Date): string => istDayFormatter.format(d);

/** IST calendar year of an instant, as four digits. */
const istYear = (d: Date): string => istDayKey(d).slice(0, 4);

// A YYYY-MM-DD key as a UTC-midnight instant. Day keys are compared and formatted in UTC so the
// arithmetic is an exact multiple of a day (no DST) and a key renders as the day it names in
// every device timezone — parsing "T00:00:00" as local midnight and then formatting in IST
// named the previous day east of Kolkata.
const dayKeyToUtc = (key: string): Date => new Date(`${key}T00:00:00Z`);

// A heading for a key that names no day renders empty: Intl throws on an invalid Date, and one
// bad row is no reason to take the screen down (web printed "Invalid Date" there).
const dayKeyDate = (key: string): Date | null => {
  const d = dayKeyToUtc(key);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Whole calendar days from `dayKey` forward to `todayKey`; negative when it lies ahead. */
const daysBetween = (todayKey: string, dayKey: string): number =>
  Math.round(
    (dayKeyToUtc(todayKey).getTime() - dayKeyToUtc(dayKey).getTime()) / DAY_MS,
  );

const normaliseZone = (zone: string): string => {
  if (zone === 'Z' || zone === '') return 'Z';
  const digits = zone.slice(1).replace(':', '').padEnd(4, '0');
  return `${zone.charAt(0)}${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

/**
 * Parses a backend timestamp, including Postgres `::text` output such as
 * "2026-08-26 10:00:00.827232+00" — a space separator, microsecond precision and a bare-hour
 * offset, none of which ISO 8601 allows. V8 parses it anyway; Hermes returns Invalid Date,
 * silently dropping the row on device, so the value is normalised to strict ISO first.
 * Null when the value is missing or unparseable.
 */
export const parseTimestamp = (
  value: string | null | undefined,
): Date | null => {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  // Loose JSON can hand over a number or object the types do not admit; no row is worth a throw.
  if (typeof value !== 'string') return null;

  const [date, rest] = value.trim().split(/[T ]/);
  if (!date || !rest) return null;

  const zoneStart = rest.search(/Z$|[+-]\d{2}(?::?\d{2})?$/);
  const clock = zoneStart === -1 ? rest : rest.slice(0, zoneStart);
  const zone = zoneStart === -1 ? 'Z' : rest.slice(zoneStart);
  const [time, fraction] = clock.split('.');
  const millis = fraction ? `.${fraction.slice(0, 3).padEnd(3, '0')}` : '';

  const parsed = new Date(
    `${date}T${time ?? ''}${millis}${normaliseZone(zone)}`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// drift resolved 2026-09-13: mobile shipped two parsers — `parseApiDate` (bare-hour offset
// only) and `parseTimestamp` (also microsecond fractions and "-0530" zones). One parser that
// handles every case, the older name kept for its callers.
export const parseApiDate: (value: string | null | undefined) => Date | null =
  parseTimestamp;

// `sameYear` flips one option, so key the cache on it rather than holding two unrelated
// constants — the same shape as `grouped(decimals)` in number.ts.
function cachedBy<K>(
  build: (key: K) => Intl.DateTimeFormat,
): (key: K) => Intl.DateTimeFormat {
  const cache = new Map<K, Intl.DateTimeFormat>();
  return key => {
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = build(key);
      cache.set(key, formatter);
    }
    return formatter;
  };
}

const shortDateISTFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: IST,
});

const shortDateLocalFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDateTimeLocalFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

// The date only: Hermes on iOS types a combined date-and-time format's clock as plain literals
// ("7 Oct at 11:05 AM" gives no hour, minute or dayPeriod part), so the clock is read from
// istClockFormatter on its own, which every engine labels.
const istMonthDay = cachedBy(
  (padDay: boolean) =>
    new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: padDay ? '2-digit' : 'numeric',
      timeZone: IST,
    }),
);

// The same date with its year, for logs that span years. Read by parts, so en-IN's own order
// ("5 Jul 2026") never reaches the output.
const istMonthDayYear = cachedBy(
  (padDay: boolean) =>
    new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: padDay ? '2-digit' : 'numeric',
      year: 'numeric',
      timeZone: IST,
    }),
);

const istClockFormatter = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: IST,
});

const monthDay = cachedBy(
  (sameYear: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : {year: 'numeric'}),
      timeZone: IST,
    }),
);

const monthName = cachedBy(
  (sameYear: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'long',
      ...(sameYear ? {} : {year: 'numeric'}),
      timeZone: IST,
    }),
);

const lastUpdatedTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: IST,
});

const orderDayHeadingFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const netWorthChartDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

// en-US and read by parts: en-GB and en-IN abbreviate September as "Sept" on current ICU, and
// en-US alone would put the weekday first.
const eventDayHeadingFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

// en-US and read by parts, as the events heading is: en-IN, the locale web formats this with,
// abbreviates September as "Sept" on current ICU.
const sessionDayFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: IST,
});

const notificationTime = cachedBy(
  (sameYear: boolean) =>
    new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : {year: 'numeric'}),
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: IST,
    }),
);

const signalAgeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  timeZone: IST,
});

const yyyymmddFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const MONTHS_SHORT = [
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
];

/**
 * January to December as web's `MONTH_SHORT_NAMES` prints them: `Intl` short months in en-IN, where
 * CLDR spells September "Sept". The heatmap's headers read them; dates elsewhere keep `Sep`.
 */
export const MONTH_SHORT_NAMES: readonly string[] = MONTHS_SHORT.map(month =>
  month === 'Sep' ? 'Sept' : month,
);

const pad2 = (n: number): string => String(n).padStart(2, '0');

// ICU prints en-IN day periods as "am"/"pm" from v72 and "AM"/"PM" before it, and pads the
// period with a narrow no-break space (U+202F) in some locales, so the same code reads
// differently per engine. Formatting through parts pins the uppercase spelling and the plain
// space the product uses everywhere.
const partsOf = (
  formatter: Intl.DateTimeFormat,
  d: Date,
): ((type: Intl.DateTimeFormatPartTypes) => string) => {
  const parts = formatter.formatToParts(d);
  return type => parts.find(p => p.type === type)?.value ?? '';
};

const plainSpaces = (value: string): string => value.replace(/\u202f/g, ' ');

const upperDayPeriod = (formatter: Intl.DateTimeFormat, d: Date): string =>
  plainSpaces(
    formatter
      .formatToParts(d)
      .map(p => (p.type === 'dayPeriod' ? p.value.toUpperCase() : p.value))
      .join(''),
  );

/** Vendor fundamentals dates arrive as an 8-digit YYYYMMDD integer (20210331 → "31 Mar 2021"). */
export const formatYyyymmdd = (
  value: number | null | undefined,
): string | null => {
  if (value == null) return null;
  const s = String(value);
  if (s.length !== 8) return null;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(4, 6));
  const day = Number(s.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== month - 1)
    return null;
  return yyyymmddFormatter.format(date);
};

/**
 * Single IST "MMM D h:mm AM/PM" core. Null for empty/invalid input so each caller supplies its
 * own fallback. `padDay` zero-pads the day ("Jul 05"); `withYear` appends the year
 * ("Jul 5, 2026"), for logs that span years. Epoch seconds are accepted alongside strings.
 * Midnight blanks the clock so a bare date never gains a fabricated time.
 */
// drift resolved 2026-09-13: web blanked midnight and took epoch seconds; mobile's copy
// (utils/portfolio) printed midnight and took strings only. Web won: its callers (news
// analysis_date) depend on the blank, and a trade leg with a real fill time is unaffected.
export function istDateTimeParts(
  dateString: string | number | null | undefined,
  padDay = false,
  withYear = false,
): {date: string; time: string} | null {
  if (dateString == null || dateString === '') return null;
  const d =
    typeof dateString === 'number'
      ? new Date(dateString > 1_000_000_000 ? dateString * 1000 : dateString)
      : parseTimestamp(dateString);
  if (!d || Number.isNaN(d.getTime())) return null;
  const date = partsOf((withYear ? istMonthDayYear : istMonthDay)(padDay), d);
  const clock = partsOf(istClockFormatter, d);
  const hour = clock('hour');
  const minute = clock('minute');
  const meridiem = clock('dayPeriod').toUpperCase();
  const isMidnight = hour === '12' && minute === '00' && meridiem === 'AM';
  const monthDayText = `${date('month')} ${date('day')}`;
  return {
    date: withYear ? `${monthDayText}, ${date('year')}` : monthDayText,
    time: isMidnight ? '' : `${hour}:${minute} ${meridiem}`,
  };
}

/**
 * Date+time (IST) "MMM D h:mm AM/PM". No year and no commas by default: these read as freshness
 * stamps, where the year is noise. `withYear` gives "MMM D, YYYY h:mm AM/PM" for a ledger that
 * spans years, where a bare "Jul 5" does not say which July. A midnight clock is dropped rather
 * than printed, so a bare date doesn't gain a fabricated 12:00 AM.
 */
// drift resolved 2026-09-13: web joined date and time with a space even when the time was
// blank ("Aug 3 "); mobile trimmed. Trimmed output won — same text, no dangling space.
export function formatShortDateTime(
  dateString: string | number | null | undefined,
  withYear = false,
): string {
  const p = istDateTimeParts(dateString, false, withYear);
  if (!p) return '—';
  return p.time ? `${p.date} ${p.time}` : p.date;
}

/**
 * Trade-leg stamp on the exchange wall clock rather than the device's. Distinct from the
 * portfolio `formatTradeTime`, which zero-pads the day, never blanks midnight and falls back
 * to "N/A".
 */
export const formatTradeTimeShort = (iso?: string): string =>
  formatShortDateTime(iso);

/**
 * Date-only (IST) "MMM D, YYYY", for values that carry no clock component (e.g. a daily news
 * `analysis_date`) — avoids fabricating a bogus midnight time from a bare date.
 */
export function formatShortDateIST(
  dateString: string | null | undefined,
): string {
  const d = parseTimestamp(dateString);
  return d ? shortDateISTFormatter.format(d) : '—';
}

// The chart's long stamps, IST (web `formatChartLongDate`): "12 Mar 2026", "12 Mar 2026, 10:15".
const chartLongDayFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: IST,
});
const chartLongMinuteFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: IST,
});

/** An instant as the chart names a candle: the day, and its IST clock when `intraday`. */
export const formatChartLongDate = (
  epochMs: number,
  intraday: boolean,
): string =>
  (intraday ? chartLongMinuteFormatter : chartLongDayFormatter).format(epochMs);

/** Device-local "MMM D, YYYY" ("Jan 5, 2024"); "—" when missing or invalid. */
// drift resolved 2026-09-13: mobile returned "N/A" and rejected undefined; web returned "—" and
// accepted it. Web won so the fallback matches the other short-date formatters here.
export function formatShortDate(dateString: string | null | undefined): string {
  const d = parseTimestamp(dateString);
  return d ? shortDateLocalFormatter.format(d) : '—';
}

/**
 * Device-local short date + time ("Jan 5, 02:30 PM"). Distinct from `formatShortDateTime`
 * (IST-pinned) — named `…Local` so the two aren't mistaken for each other. "N/A" when missing.
 */
export const formatShortDateTimeLocal = (
  dateString: string | null | undefined,
): string => {
  const d = parseTimestamp(dateString);
  return d ? plainSpaces(shortDateTimeLocalFormatter.format(d)) : 'N/A';
};

/** Device-local "DD, Mon YYYY" ("05, Jan 2024"), zero-padded day. */
export const formatDayMonthYear = (date: Date): string =>
  `${pad2(date.getDate())}, ${MONTHS_SHORT[date.getMonth()] ?? ''} ${date.getFullYear()}`;

/** Device-local "MMM DD, YYYY HH:mm" ("Jan 05, 2024 14:30"); "N/A" when missing or invalid. */
export const formatDateTimeStamp = (
  timeString: string | null | undefined,
): string => {
  const d = parseTimestamp(timeString);
  if (!d) return 'N/A';
  return `${MONTHS_SHORT[d.getMonth()] ?? ''} ${pad2(d.getDate())}, ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/** Runtime-default locale date+time via `Date#toLocaleString`; "N/A" when missing or invalid. */
export const formatDateTime = (value: string | null | undefined): string => {
  const d = parseTimestamp(value);
  return d ? d.toLocaleString() : 'N/A';
};

/**
 * Coarse "N days/months/years ago" label for a backtest's equity-curve start caption.
 * Floors at a day ("Recently"); `formatSignalAge` is the one that keeps minutes.
 */
export const formatRelativeFromNow = (
  dateStr?: string | null,
  now: Date = new Date(),
): string => {
  if (!dateStr) return 'Start';
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return 'Start';
  const days = Math.max(0, Math.round((now.getTime() - then) / DAY_MS));
  if (days >= 365) {
    const y = Math.round(days / 365);
    return `${y} year${y > 1 ? 's' : ''} ago`;
  }
  if (days >= 30) {
    const m = Math.round(days / 30);
    return `${m} month${m > 1 ? 's' : ''} ago`;
  }
  if (days <= 1) return 'Recently';
  return `${days} days ago`;
};

/**
 * How long ago, in one token: "12m ago", "5h ago", "3d ago", then the plain IST date. A signal
 * that fired twenty minutes ago and one that fired this morning are different events, and
 * collapsing them to a day loses the only thing that orders them.
 */
export const formatSignalAge = (
  dateString?: string | null,
  now: Date = new Date(),
): string => {
  const d = parseTimestamp(dateString);
  if (!d) return '';

  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return signalAgeFormatter.format(d);
};

/**
 * A span of minutes as a duration ("40 min", "4 hr", "2 days"). Rounds to the one unit that
 * carries the comparison being made rather than printing both.
 */
export const formatDurationMins = (minutes: number): string => {
  if (!Number.isFinite(minutes) || minutes < 1) return 'under a minute';
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 36) return `${Math.round(hours)} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
};

/** Chat-list stamp: clock time for today's chats (IST), else "MMM D", the year only when it isn't the current one. */
export function formatChatListTime(
  dateString: string | null | undefined,
  now: Date = new Date(),
): string {
  const d = parseTimestamp(dateString);
  if (!d) return '';

  if (istDayKey(d) === istDayKey(now)) {
    const get = partsOf(istClockFormatter, d);
    return `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`;
  }
  return monthDay(istYear(d) === istYear(now)).format(d);
}

/**
 * Freshness stamp for a batch that only refreshes once a day: "Today 9:15 AM",
 * "Yesterday 9:15 AM", else "Aug 3, 9:15 AM". Always IST — the batch is published on an IST
 * schedule, so a viewer abroad must not see it shifted.
 */
export function formatLastUpdatedIST(
  dateString: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const d = parseTimestamp(dateString);
  if (!d) return null;

  const time = plainSpaces(lastUpdatedTimeFormatter.format(d));
  const dayKey = istDayKey(d);
  const todayKey = istDayKey(now);
  if (dayKey === todayKey) return `Today ${time}`;
  if (daysBetween(todayKey, dayKey) === 1) return `Yesterday ${time}`;

  const sameYear = dayKey.slice(0, 4) === todayKey.slice(0, 4);
  return `${monthDay(sameYear).format(d)}, ${time}`;
}

/** Orders-screen day-group heading for an IST day key: "09 Aug 2026". */
export const formatOrderDayHeading = (isoDate: string): string => {
  const d = dayKeyDate(isoDate);
  return d ? orderDayHeadingFormatter.format(d) : '';
};

const expiryDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: IST,
});

/**
 * An expiry as web's `formatExpiryDate` prints it in a heading: "8 Oct 26", in IST, empty when
 * missing or unreadable. en-IN, as web's, so September reads "Sept" there too.
 */
export function formatExpiryDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : expiryDateFormatter.format(d);
}

/** Net-worth chart readout for a bare YYYY-MM-DD, 2-digit year to keep the row compact: "9 Aug 26". */
export const formatNetWorthChartDate = (isoDate: string): string => {
  const d = dayKeyDate(isoDate);
  return d ? netWorthChartDateFormatter.format(d) : '';
};

/** Events-calendar day heading for an IST day key: "21 Sep, Mon". */
export const formatEventDayHeading = (isoDate: string): string => {
  const d = dayKeyDate(isoDate);
  if (!d) return '';
  const get = partsOf(eventDayHeadingFormatter, d);
  return `${get('day')} ${get('month')}, ${get('weekday')}`;
};

/** The day of a trading session, weekday first: "Fri, 2 Oct". A value that is no date reads as itself. */
export const formatSessionDay = (session: string): string => {
  const d = parseTimestamp(session);
  if (!d) return session;
  const get = partsOf(sessionDayFormatter, d);
  return `${get('weekday')}, ${get('day')} ${get('month')}`;
};

/** Orders-screen fill time, 12-hour IST clock: "9:05 AM". */
export const formatOrderTime = (iso: string | null | undefined): string => {
  const d = parseTimestamp(iso);
  return d ? upperDayPeriod(istClockFormatter, d) : '';
};

/**
 * Notification "sent at" stamp: date and time together since the inbox isn't grouped by day
 * like Orders is — "9 Aug, 9:05 AM". The year only appears once it isn't this one: the inbox
 * paginates back indefinitely, and without it a notification from a past year is
 * indistinguishable from one sent today.
 */
export const formatNotificationTime = (
  iso: string | null | undefined,
  now: Date = new Date(),
): string => {
  const d = parseTimestamp(iso);
  if (!d) return '';
  return upperDayPeriod(notificationTime(istYear(d) === istYear(now)), d);
};

/**
 * Recency bucket that groups the chat list into sections: "Today", "Yesterday",
 * "Previous 7 Days", "Previous 30 Days", then the month name (year appended when it differs).
 */
export function getChatDateGroup(
  dateString: string | null | undefined,
  now: Date = new Date(),
): string {
  const d = parseTimestamp(dateString);
  if (!d) return 'Older';

  const dayKey = istDayKey(d);
  const todayKey = istDayKey(now);
  if (dayKey === todayKey) return 'Today';

  const diffDays = daysBetween(todayKey, dayKey);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  if (diffDays <= 30) return 'Previous 30 Days';

  return monthName(dayKey.slice(0, 4) === todayKey.slice(0, 4)).format(d);
}
