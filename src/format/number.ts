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

/** "+₹1,240" / "-₹1,240": a rupee amount that must show its direction (P&L cells, deltas). */
export const signedCurrency = (value: number, decimals = 0): string =>
  withSign(formatCurrency(value, decimals), value);

/**
 * "+2.4%" / "-0.5%"; an unrepresentable value prints a dash rather than "NaN%".
 * Guarded because callers pass a nullable return pct: an empty NAV series yields null, and
 * `null.toFixed` took the whole Net Worth page to the error boundary.
 */
// drift resolved 2026-09-13: web accepted null/undefined (→ "—"), mobile only number; web's
// wider guard won — it is a strict superset and the null case is real (empty NAV series).
export const signedPct = (
  value: number | null | undefined,
  decimals = 1,
): string =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
    : '—';

// drift resolved 2026-09-13: both apps export this helper as `formatCompactINR`; core named it
// `formatCompactInr`. One implementation, the app-facing spelling aliased so call sites move
// without a rename.
export const formatCompactINR = formatCompactInr;

const croreFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Value already expressed in ₹ crore — grouped with a "Cr" suffix ("1,973,643.47 Cr"). Kept
 * separate from `formatCroreCompact`: tables that align on a full figure still want the exact
 * one. en-US grouping is what the fundamentals tables always used.
 */
export const formatCrore = (value: number | null | undefined): string =>
  value == null ? 'N/A' : `${croreFormatter.format(value)} Cr`;

/**
 * Fundamentals arrive as loose JSON: a number, a pre-formatted string, or one of several
 * spellings of absent ("null" and "N/A" come through as literal strings). Collapse all of them
 * to a single "N/A" so a missing figure never renders as the word null. Numbers keep the
 * runtime's default locale, as both apps always did.
 */
export const formatValue = (
  value: string | number | null | undefined,
): string => {
  if (value == null || value === 'null' || value === 'N/A') return 'N/A';
  return typeof value === 'number' ? value.toLocaleString() : value;
};

/**
 * A strategy's budget is sized either by rupee AMOUNT or by share QTY (budget_config.mode).
 * Format the raw value per its mode so QTY strategies read as a share count instead of being
 * mislabelled with a ₹ sign.
 */
export const formatAllocation = (
  value: number | null | undefined,
  mode?: string,
  decimals = 0,
): string =>
  mode?.toUpperCase() === 'QTY'
    ? `${formatNumber(value ?? 0)} qty`
    : formatCurrency(value, decimals);

/** `value` held inside `[min, max]`. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

/** Abbreviated rupee magnitude (T/B/M) for market cap and revenue figures. */
export const formatMarketCap = (value: number): string => {
  if (value >= 1e12) return `₹${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `₹${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `₹${(value / 1e6).toFixed(2)}M`;
  return `₹${value.toFixed(2)}`;
};
