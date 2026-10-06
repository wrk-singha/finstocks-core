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

const trimZeros = (s: string): string =>
  s.includes('.') ? s.replace(/\.?0+$/, '') : s;

/**
 * A traded count on the Indian scale — session volume, open interest, share and contract
 * quantities: `formatCompactQuantity(698_310_750)` → `69.83Cr`. No currency symbol: these are
 * things, not rupees.
 *
 * Every one of these figures is read as a magnitude, not looked up digit by digit, and at market
 * scale the raw grouping stops being readable — a session volume prints as "69,83,10,750", which
 * nobody parses as "roughly seventy crore". The scale letters are the ones an Indian trader
 * already reads on an exchange screen: K (1e3), L (lakh, 1e5), Cr (crore, 1e7).
 *
 * `formatQuantity` stays the choice for a figure meant to be read exactly — an order quantity, a
 * lot size — where dropping digits would hide what the user is actually sending to the broker.
 */
// Web calls this `formatQuantity`. Core's `formatQuantity` already prints grouped whole units and
// the apps read it for order quantities, so the compact one takes its own name rather than
// changing what an existing name prints.
export const formatCompactQuantity = (
  value: number | null | undefined,
  decimals = 2,
): string => {
  const amount = value ?? 0;
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${sign}${trimZeros((abs / 1e7).toFixed(decimals))}Cr`;
  if (abs >= 1e5) return `${sign}${trimZeros((abs / 1e5).toFixed(decimals))}L`;
  if (abs >= 1e3) return `${sign}${trimZeros((abs / 1e3).toFixed(1))}K`;
  return `${sign}${abs.toFixed(0)}`;
};

/**
 * Magnitude of a plain count — no currency, no Indian lakh/crore scale:
 * `formatCompactCount(1_250_000)` → `1.3M`, `formatCompactCount(-8_400)` → `-8.4k`.
 *
 * `formatCompactInr` is the money version and stamps a ₹; `formatCompactQuantity` is the Indian
 * L/Cr one. This is the one for "9.7B stored values", where the reader is judging scale and the
 * unit is "things".
 */
export const formatCompactCount = (value: number): string => {
  const abs = Math.abs(value);
  const trim = (v: number): string =>
    Number.isInteger(v) ? String(v) : v.toFixed(1);
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k`;
  return String(Math.round(value));
};

/**
 * Crore-denominated figures, read the way an Indian investor says them out loud: a mega-cap is
 * "₹11.50L Cr", not "1,150,000.00 Cr". Distinct from `formatCompactInr`, which takes rupees —
 * these values arrive already in crore, so dividing again would be wrong by a factor of 1e7.
 *
 * Lakh crore is the only scale letter, because it is the only one anyone says. A ₹98,931 Cr
 * company is "ninety-nine thousand crore", and the "₹98.93K Cr" this used to print mixes an
 * English magnitude prefix into an Indian unit to save four characters — the reader spends them
 * converting it back. Below a lakh crore the figure is simply grouped, which is how every Indian
 * exchange, broker and newspaper prints it.
 */
export const formatCroreCompact = (
  value: number | null | undefined,
): string => {
  if (value == null) return 'N/A';
  const abs = Math.abs(value);
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)}L Cr`;
  // One decimal under ₹100 Cr: rounding a ₹40.4 Cr micro-cap to a whole number is fine, rounding
  // a sub-crore figure to "₹0 Cr" is not.
  return `₹${formatNumber(value, abs < 100 ? 1 : 0)} Cr`;
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

/** A fraction in, a signed percent out: 0.042 → "+4.2%"; null and undefined print a dash. */
export const signedFractionPct = (
  fraction: number | null | undefined,
  decimals = 1,
): string => (fraction == null ? '—' : signedPct(fraction * 100, decimals));

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
 * A strategy's budget is sized either by rupee AMOUNT or by count QTY (budget_config.mode).
 * Format the raw value per its mode so QTY strategies read as a count instead of being
 * mislabelled with a ₹ sign. `unit` names what the count is of when the caller knows the
 * instrument - QTY is lots in F&O and shares in equity - and falls back to the neutral "qty" when
 * it does not.
 */
export const formatAllocation = (
  value: number | null | undefined,
  mode?: string,
  decimals = 0,
  unit = 'qty',
): string =>
  mode?.toUpperCase() === 'QTY'
    ? `${formatNumber(value ?? 0)} ${unit}`
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
