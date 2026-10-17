// Symbol-dialect helpers shared by the chart, the futures pages and trade
// pricing. Both apps kept these beside their chart utils; they are pure
// string logic about NSE contract naming, so they live with the market maths.

/** The indices traded as F&O underlyings; strategy's symbol rule reads their spaced names too. */
export const TRADABLE_INDICES: readonly string[] = [
  'NIFTY',
  'BANKNIFTY',
  'FINNIFTY',
  'MIDCPNIFTY',
];

// Anchored on the contract suffix, never a bare digit-letter run: an
// unanchored expiry match reads "BSE500IETF" as an option and files the ETF
// under F&O.
export function isFnOSymbol(symbol?: string | null): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  if (TRADABLE_INDICES.some(idx => s === idx || s.startsWith(idx + ' ')))
    return true;
  return /\d(FUT|CE|PE)$/.test(s) || /\d{2}[A-Z]{3}FUT$/.test(s);
}

/**
 * The tradable underlying behind any symbol spelling: "NIFTY24JUL22000CE" →
 * "NIFTY", "NIFTY BANK" → "BANKNIFTY", "RELIANCE-EQ" → "RELIANCE". A plain
 * equity comes back as itself, upper-cased.
 */
export function extractUnderlyingSymbol(stockSymbol: string): string {
  const normalizedSymbol = (stockSymbol || '').trim().toUpperCase();

  const matchesUnderlying = (underlying: string) => {
    if (normalizedSymbol === underlying) return true;
    if (!normalizedSymbol.startsWith(underlying)) return false;
    const nextChar = normalizedSymbol[underlying.length];
    return (
      nextChar === undefined || /[\s._-]/.test(nextChar) || /\d/.test(nextChar)
    );
  };

  if (normalizedSymbol.includes('NIFTY BANK') || matchesUnderlying('BANKNIFTY'))
    return 'BANKNIFTY';
  if (matchesUnderlying('NIFTY')) return 'NIFTY';

  if (
    !normalizedSymbol.endsWith('CE') &&
    !normalizedSymbol.endsWith('PE') &&
    !normalizedSymbol.endsWith('FUT')
  ) {
    return normalizedSymbol.replace(/(-EQ|\.NSE|\.NS|\.BO)$/, '');
  }

  const match = /^([A-Z]+)\s*\d/.exec(normalizedSymbol);
  return match?.[1] ?? normalizedSymbol;
}

/**
 * The FinStocks logo bucket's URL for a symbol, keyed by its underlying ("RELIANCE-EQ" → RELIANCE,
 * "NIFTY BANK" → BANKNIFTY). The bucket has no manifest: a miss is a 404 the caller remembers.
 */
export function stockLogoUrl(stockSymbol: string): string {
  const underlying = extractUnderlyingSymbol(stockSymbol) || stockSymbol;
  return `https://storage.googleapis.com/finstocks_stock_logos/${underlying}.webp`;
}

/**
 * An IPO's logo, or undefined when the issue has no fincode. An issue cannot be addressed by symbol
 * the way a stock is — nse_symbol and bse_scrip_id are empty on almost every pending issue — so its
 * logo is filed under fincode, which every issue has. A missing object 404s to the initials tile
 * exactly as a missing stock logo does.
 */
export function ipoLogoUrl(
  fincode: number | null | undefined,
): string | undefined {
  return fincode
    ? `https://storage.googleapis.com/finstocks_stock_logos/ipo/${fincode}.webp`
    : undefined;
}
