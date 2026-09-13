import {extractUnderlyingSymbol} from './symbols.ts';

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

type MonthLabel = (typeof MONTHS)[number];

/**
 * Exchange-format futures symbol, e.g. JINDALSTEL26AUGFUT. This is the only
 * dialect the chart pipeline recognises for futures — the `UNDERLYING~DATE~
 * STRIKE~RIGHT` lookup format used elsewhere has no FUT branch, so a contract
 * addressed that way silently fails to resolve.
 */
export const FUTURES_SYMBOL_RE = /^([A-Z&-]+\d*)(\d{2})([A-Z]{3})FUT$/;

export interface ParsedFuturesSymbol {
  symbol: string;
  underlying: string;
  /** Expiry month as ISO `YYYY-MM`; the exchange symbol carries no day. */
  expiryMonth: string;
  monthLabel: string;
  year: number;
}

export function buildFuturesSymbol(
  underlying: string,
  expiry: string | undefined,
): string | null {
  if (!underlying || !expiry) return null;
  const [year, monthPart] = expiry.split('-');
  if (year === undefined || monthPart === undefined) return null;
  const month = MONTHS[parseInt(monthPart, 10) - 1];
  if (!month) return null;
  return `${underlying.toUpperCase()}${year.slice(-2)}${month}FUT`;
}

export function parseFuturesSymbol(
  symbol: string | undefined,
): ParsedFuturesSymbol | null {
  const normalized = (symbol ?? '').trim().toUpperCase();
  const match = FUTURES_SYMBOL_RE.exec(normalized);
  const underlying = match?.[1];
  const yearToken = match?.[2];
  const monthLabel = match?.[3];
  if (
    underlying === undefined ||
    yearToken === undefined ||
    monthLabel === undefined
  )
    return null;

  const monthIndex = MONTHS.indexOf(monthLabel as MonthLabel);
  if (monthIndex < 0) return null;

  const year = 2000 + parseInt(yearToken, 10);
  return {
    symbol: normalized,
    underlying,
    expiryMonth: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    monthLabel,
    year,
  };
}

export const isFuturesSymbol = (symbol: string | undefined): boolean =>
  FUTURES_SYMBOL_RE.test((symbol ?? '').trim().toUpperCase());

/** Underlying for any contract dialect, futures included. */
export const underlyingOf = (symbol: string): string =>
  parseFuturesSymbol(symbol)?.underlying ?? extractUnderlyingSymbol(symbol);

/** The web route for a contract; the mobile app routes by symbol param instead. */
export const futuresPath = (symbol: string): string =>
  `/futures/${encodeURIComponent(symbol.trim().toUpperCase())}`;

/**
 * "JINDALSTEL 25 Aug Fut" — the exchange symbol has no expiry day, so the day
 * is supplied by the caller when the chain reports it and omitted otherwise
 * rather than guessed to the month end.
 */
export function futuresTitle(
  parsed: ParsedFuturesSymbol,
  expiryDate?: string | null,
): string {
  const month =
    parsed.monthLabel.charAt(0) + parsed.monthLabel.slice(1).toLowerCase();
  const day = expiryDate ? new Date(expiryDate).getDate() : null;
  return day
    ? `${parsed.underlying} ${day} ${month} Fut`
    : `${parsed.underlying} ${month} Fut`;
}
