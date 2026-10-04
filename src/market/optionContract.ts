import {MONTHS} from './futuresSymbol.ts';

const RIGHTS = ['CE', 'PE'] as const;

/** One option contract, as its own screen addresses it. */
export interface OptionContract {
  underlying: string;
  /** ISO `YYYY-MM-DD`. A monthly's exchange ticker carries only its month, so the
   *  full date travels with the contract rather than being re-derived. */
  expiry: string;
  strike: number;
  right: (typeof RIGHTS)[number];
}

/**
 * A contract's address as it arrives: a URL's query or a route's params, so
 * every field is text that may be missing. A strike handed over in-app may
 * already be a number.
 */
export interface OptionContractParams {
  underlying?: string | null | undefined;
  expiry?: string | null | undefined;
  strike?: string | number | null | undefined;
  right?: string | null | undefined;
}

// An underlying as the ticker spells it: M&M carries an ampersand, BAJAJ-AUTO a
// hyphen, NIFTYNXT50 trailing digits.
const UNDERLYING_RE = /^[A-Z0-9&-]+$/;
// The ticker's own strike grammar: whole rupees, or the decimal step NSE lists
// some underlyings at near the money.
const STRIKE_RE = /^\d+(?:\.\d+)?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isRight = (value: string): value is OptionContract['right'] =>
  RIGHTS.some(right => right === value);

// A real calendar day: `Date` rolls 2026-02-30 over into March, so the parts
// are read back and compared rather than trusting the parse.
function isIsoDate(value: string): boolean {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// A link's query reaches the screen through query-string, which hands a repeated key over as an
// array, and a hand-typed link can carry anything. The first value is read, as URLSearchParams.get
// reads it, and a value that is not text is no value, so an odd link lands on "not a contract"
// instead of throwing.
function textOf(value: unknown): string {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
}

function strikeOf(value: unknown): number | null {
  const first: unknown = Array.isArray(value) ? value[0] : value;
  const text = typeof first === 'number' ? String(first) : textOf(first);
  if (!STRIKE_RE.test(text)) return null;
  const strike = Number(text);
  return strike > 0 ? strike : null;
}

/**
 * The contract an address names, or null when it names none: an underlying
 * the ticker can spell, an ISO expiry that is a real day, a positive strike
 * and CE or PE. Nothing partial comes back, because every field feeds the
 * exchange ticker and a guessed one charts a different instrument.
 */
export function readOptionContract(
  params: OptionContractParams,
): OptionContract | null {
  const underlying = textOf(params.underlying).toUpperCase();
  const expiry = textOf(params.expiry);
  const strike = strikeOf(params.strike);
  const right = textOf(params.right);

  if (!UNDERLYING_RE.test(underlying) || !isIsoDate(expiry)) return null;
  if (strike === null || !isRight(right)) return null;

  return {underlying, expiry, strike, right};
}

/**
 * The contract's web address: the underlying names the route, the three
 * fields that pin a strike travel as query params. Addressed by parts rather
 * than by an exchange ticker because every caller already holds them, and a
 * ticker read back could not recover the expiry day. The mobile app routes by
 * the same params and deep-links this URL.
 */
export const optionPath = ({
  underlying,
  expiry,
  strike,
  right,
}: OptionContract): string =>
  `/options/${encodeURIComponent(underlying.toUpperCase())}?expiry=${encodeURIComponent(expiry)}&strike=${encodeURIComponent(String(strike))}&right=${right}`;

/** The latest listed expiry in each month: a future's expiry; an option's monthly only if `monthlyExpiries` agrees. */
export function monthLastExpiries(catalogue: readonly string[]): Set<string> {
  const lastByMonth = new Map<string, string>();
  for (const expiry of catalogue) {
    const month = expiry.slice(0, 7);
    const held = lastByMonth.get(month);
    if (!held || expiry > held) lastByMonth.set(month, expiry);
  }
  return new Set(lastByMonth.values());
}

const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` date as UTC midnight milliseconds, or NaN. */
export const dayMs = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? NaN, (m ?? 0) - 1, d ?? NaN);
};

/** The weekday most listed expiries fall on, or null on a tie. Read, not assumed: exchanges move expiry days. */
export function catalogueWeekday(catalogue: readonly string[]): number | null {
  const counts = new Map<number, number>();
  for (const expiry of catalogue) {
    const ms = dayMs(expiry);
    if (!Number.isNaN(ms)) {
      const weekday = new Date(ms).getUTCDay();
      counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [weekday, count] of counts) {
    if (count > bestCount) {
      best = weekday;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  return tied ? null : best;
}

// A holiday moves an expiry back to the previous trading day: up to four days over a weekend.
export const MAX_HOLIDAY_SHIFT_DAYS = 4;

/** The day of the month `expiry` stands for, undoing a holiday move (Mon 23 Nov stands for Tue 24 Nov). */
function nominalDayOfMonth(expiry: string, weekday: number | null): number {
  const ms = dayMs(expiry);
  const date = new Date(ms);
  if (weekday === null || date.getUTCDay() === weekday)
    return date.getUTCDate();
  const ahead = (weekday - date.getUTCDay() + 7) % 7;
  if (ahead > MAX_HOLIDAY_SHIFT_DAYS) return date.getUTCDate();
  const nominal = new Date(ms + ahead * DAY_MS);
  return nominal.getUTCMonth() === date.getUTCMonth()
    ? nominal.getUTCDate()
    : date.getUTCDate();
}

/** Days in `expiry`'s month. */
const daysInMonth = (expiry: string): number => {
  const [y, m] = expiry.split('-').map(Number);
  return new Date(Date.UTC(y ?? NaN, m ?? NaN, 0)).getUTCDate();
};

// A month's monthly falls in its last seven calendar days.
const MONTHLY_WINDOW_DAYS = 7;

/**
 * The catalogue's monthly expiries: the latest listed in its month AND within the
 * month's last seven days. Last-listed alone isn't enough: a catalogue missing
 * the monthly would spell its last weekly as the monthly, a different contract.
 */
export function monthlyExpiries(catalogue: readonly string[]): Set<string> {
  const weekday = catalogueWeekday(catalogue);
  const monthly = new Set<string>();
  for (const expiry of monthLastExpiries(catalogue)) {
    const fromEnd = daysInMonth(expiry) - nominalDayOfMonth(expiry, weekday);
    if (fromEnd < MONTHLY_WINDOW_DAYS) monthly.add(expiry);
  }
  return monthly;
}

/** Whether `expiry` is its month's monthly or a weekly, by the catalogue; null when it can't say. */
export function expiryCycle(
  expiry: string,
  catalogue: readonly string[] | null | undefined,
): 'monthly' | 'weekly' | null {
  if (!catalogue || catalogue.length === 0) return null;
  const month = expiry.slice(0, 7);
  if (catalogue.some(e => e.slice(0, 7) === month && e > expiry))
    return 'weekly';
  return catalogue.includes(expiry) && monthlyExpiries(catalogue).has(expiry)
    ? 'monthly'
    : null;
}

// A weekly's month is one character, 1-9 then O, N, D.
const WEEKLY_MONTHS = '123456789OND';

/**
 * The exchange ticker the feeds key on, and on web the orders too. Mobile's orders
 * do not use it: they still carry `buildOptionContractSymbol`.
 *   monthly  NIFTY26SEP23150CE   <U><YY><MON><strike><right>
 *   weekly   NIFTY26O0623150CE   <U><YY><M><DD><strike><right>
 * The month-named form names the monthly, so a weekly spelled that way is another
 * contract. When the catalogue can't say, the dated form names exactly this expiry.
 * A decimal strike keeps its point (TATASTEEL26SEP187.5CE).
 * Kept in step with fnocontract.Parse (backend-go/internal/market/fnocontract),
 * which reads both forms back.
 */
export function exchangeSymbol(
  {underlying, expiry, strike, right}: OptionContract,
  catalogue: readonly string[] | null | undefined,
): string {
  const [year = '', month = '', day] = expiry.split('-');
  const yy = year.slice(-2);
  if (expiryCycle(expiry, catalogue) === 'monthly' || !day) {
    return `${underlying}${yy}${MONTHS[Number(month) - 1] ?? ''}${strike}${right}`;
  }
  return `${underlying}${yy}${WEEKLY_MONTHS[Number(month) - 1] ?? ''}${day}${strike}${right}`;
}

// Kept in step with fnoSymbolRe in backend-go/handlers/trading/graph.go, which
// decides the same question server-side to pick fno_ohlcv_1m over ohlcv_1m.
// Underlyings are not all plain letters: M&M carries an ampersand, BAJAJ-AUTO a
// hyphen, NIFTYNXT50 trailing digits. The strike allows a decimal point: NSE
// spaces some underlyings' strikes at 2.5 or 5 rupees near the money
// (TATASTEEL26SEP187.5CE), not just whole rupees.
const EXCHANGE_SYMBOL_RE =
  /^[A-Z0-9&-]+\d{2}[A-Z0-9]{1,5}(?:\d+(?:\.\d+)?(?:CE|PE)|FUT)$/;

/**
 * Whether a symbol is an F&O contract ticker rather than an equity symbol.
 *
 * The one place this grammar lives in core. Every caller that routes a symbol
 * to the F&O feeds asks here, so a contract the backend accepts cannot be
 * classified differently by one caller and not another.
 */
export const isExchangeSymbol = (symbol: string): boolean =>
  EXCHANGE_SYMBOL_RE.test(symbol);

// The backend's three option spellings, in its order (fnocontract.Parse in
// backend-go/internal/market/fnocontract/fnocontract.go). The test beside this
// file reads these three lines and fails if one drifts from the backend's.
const OPTION_ISO_RE =
  /^([A-Z0-9&-]+?)(\d{4})(\d{2})(\d{2})(\d{3,6}(?:\.\d+)?)(CE|PE)$/;
const OPTION_WEEKLY_RE =
  /^([A-Z0-9&-]+?)(\d{2})([1-9OND])(\d{2})(\d{3,6}(?:\.\d+)?)(CE|PE)$/;
const OPTION_MONTHLY_RE =
  /^([A-Z0-9&-]+?)(\d{2})([A-Z]{3})(\d+(?:\.\d+)?)(CE|PE)$/;

/** An option ticker read back into its parts. A month-named ticker carries no
 *  day: `expiry` is absent and `month` (YYYY-MM) names the monthly it means. */
export interface ParsedOptionSymbol {
  underlying: string;
  month: string;
  expiry?: string;
  strike: number;
  right: OptionContract['right'];
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Reads an option ticker in any spelling the backend accepts; null otherwise. */
export function parseOptionSymbol(symbol: string): ParsedOptionSymbol | null {
  const s = symbol.trim().toUpperCase();
  const iso = OPTION_ISO_RE.exec(s);
  if (iso) {
    const [, underlying = '', year = '', mm = '', dd = '', strike, right] = iso;
    return {
      underlying,
      month: `${year}-${mm}`,
      expiry: `${year}-${mm}-${dd}`,
      strike: Number(strike),
      right: right as OptionContract['right'],
    };
  }
  const weekly = OPTION_WEEKLY_RE.exec(s);
  if (weekly) {
    const [, underlying = '', yy = '', m = '', dd = '', strike, right] = weekly;
    const month = `20${yy}-${pad2(WEEKLY_MONTHS.indexOf(m) + 1)}`;
    return {
      underlying,
      month,
      expiry: `${month}-${dd}`,
      strike: Number(strike),
      right: right as OptionContract['right'],
    };
  }
  const monthly = OPTION_MONTHLY_RE.exec(s);
  const monthIndex = monthly
    ? MONTHS.indexOf(monthly[3] as (typeof MONTHS)[number])
    : -1;
  if (monthly && monthIndex >= 0) {
    const [, underlying = '', yy = '', , strike, right] = monthly;
    return {
      underlying,
      month: `20${yy}-${pad2(monthIndex + 1)}`,
      strike: Number(strike),
      right: right as OptionContract['right'],
    };
  }
  return null;
}

/**
 * The contract an option ticker names, with its expiry date: a dated ticker's
 * own, or for a month-named one that month's monthly from the underlying's
 * expiry catalogue. Null when the date cannot be known (a month the catalogue
 * no longer lists).
 */
export function optionContractOf(
  symbol: string,
  catalogue: readonly string[] | null | undefined,
): OptionContract | null {
  const parsed = parseOptionSymbol(symbol);
  if (!parsed) return null;
  const expiry =
    parsed.expiry ??
    [...monthlyExpiries(catalogue ?? [])].find(e =>
      e.startsWith(`${parsed.month}-`),
    );
  if (!expiry) return null;
  return {
    underlying: parsed.underlying,
    expiry,
    strike: parsed.strike,
    right: parsed.right,
  };
}
