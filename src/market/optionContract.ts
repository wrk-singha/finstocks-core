import {MONTHS} from './futuresSymbol.ts';

const RIGHTS = ['CE', 'PE'] as const;

/** One option contract, as its own screen addresses it. */
export interface OptionContract {
  underlying: string;
  /** ISO `YYYY-MM-DD`. The exchange ticker carries only a month, so the full
   *  date travels with the contract rather than being re-derived from it. */
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

function strikeOf(value: OptionContractParams['strike']): number | null {
  const text = typeof value === 'number' ? String(value) : (value ?? '').trim();
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
  const underlying = (params.underlying ?? '').trim().toUpperCase();
  const expiry = (params.expiry ?? '').trim();
  const strike = strikeOf(params.strike);
  const right = params.right ?? '';

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

/**
 * The exchange ticker (ADANIENT26SEP3100CE) the candle and depth feeds key
 * on. A decimal strike keeps its point (TATASTEEL26SEP187.5CE).
 */
export function exchangeSymbol({
  underlying,
  expiry,
  strike,
  right,
}: OptionContract): string {
  const [year = '', month = ''] = expiry.split('-');
  return `${underlying}${year.slice(-2)}${MONTHS[Number(month) - 1] ?? ''}${strike}${right}`;
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
