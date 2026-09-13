// Symbol-dialect helpers shared by the chart, the futures pages and trade
// pricing. Both apps kept these beside their chart utils; they are pure
// string logic about NSE contract naming, so they live with the market maths.

const TRADABLE_INDICES = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

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
