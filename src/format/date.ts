/** The exchange's zone; every "day" in the product is an IST day. */
export const IST = 'Asia/Kolkata';

// Hoisted: these helpers run per row in lists, and each `new Intl.*` call rebuilds an ICU
// formatter (a JNI hop into ICU4J on Android).
const istDayFormatter = new Intl.DateTimeFormat('en-CA', {timeZone: IST});

/** The IST calendar day as YYYY-MM-DD — the key two timestamps share when they are "the same day". */
export const istDayKey = (d: Date): string => istDayFormatter.format(d);

/**
 * Postgres `::text` timestamps arrive as "2026-08-31 20:00:24+00" — a space instead of the ISO "T"
 * and a bare-hour offset, which V8 accepts but Hermes rejects as Invalid Date, silently dropping
 * the row on device. Null for anything neither engine can read.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const parsed = new Date(
    value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
