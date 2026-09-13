/**
 * Number formatting shared by both apps. Indian grouping (en-IN: 12,34,567) everywhere; the
 * minus leads the rupee sign ("-₹1,240.00") so a column of figures stays aligned on the ₹.
 */

/**
 * `Number.prototype.toLocaleString` builds a fresh formatter on every call. On Android that
 * construction crosses JNI into ICU4J, so the per-row cost in a list is an order of magnitude
 * above iOS, where Hermes delegates to native Foundation. Formatters are immutable and
 * reusable — cache one per decimal count and format through it instead.
 */
const groupedFormatters = new Map<number, Intl.NumberFormat>();

function grouped(decimals: number): Intl.NumberFormat {
  let formatter = groupedFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    groupedFormatters.set(decimals, formatter);
  }
  return formatter;
}

/** Locale-grouped number: `formatNumber(1234567.5, 1)` → `12,34,567.5`. */
export const formatNumber = (value: number, decimals = 0): string =>
  grouped(decimals).format(value);

/** Rupee amount: `formatCurrency(-1240)` → `-₹1,240.00`. `null`/`undefined` read as zero. */
export const formatCurrency = (
  value: number | null | undefined,
  decimals = 2,
): string => {
  const amount = value ?? 0;
  const sign = amount < 0 ? '-' : '';
  return `${sign}₹${grouped(decimals).format(Math.abs(amount))}`;
};

/** Percentage with fixed decimals: `formatPercent(-0.5)` → `-0.50%`. */
export const formatPercent = (
  value: number | null | undefined,
  decimals = 2,
): string => {
  const amount = value ?? 0;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${grouped(decimals).format(Math.abs(amount))}%`;
};

/** Whole units (shares, lots, contracts): `formatQuantity(100000)` → `1,00,000`. */
export const formatQuantity = (value: number | null | undefined): string =>
  grouped(0).format(Math.trunc(value ?? 0));

/**
 * Abbreviated rupee magnitude (Cr/L/K): `formatCompactInr(12_300_000)` → `₹1.2Cr`.
 * Distinct from the T/B/M notation fundamentals use for market cap.
 */
export const formatCompactInr = (value: number | null | undefined): string => {
  const amount = value ?? 0;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const trim = (v: number): string =>
    Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${String(Math.round(abs))}`;
};

/**
 * Crore-denominated figures, read the way an Indian investor says them out loud. Distinct from
 * `formatCompactInr`, which takes rupees — these values arrive already in crore, so dividing
 * again would be wrong by a factor of 1e7.
 */
export const formatCroreCompact = (
  value: number | null | undefined,
): string => {
  if (value == null) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2)}L Cr`;
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(2)}K Cr`;
  return `₹${value.toFixed(0)} Cr`;
};

/** Prefix `+` on a positive value; formatted negatives already carry their `-`. */
export const withSign = (formatted: string, value: number): string =>
  value > 0 ? `+${formatted}` : formatted;
