// Units per lot for index derivatives, as of the January 2026 exchange revision. SEBI has these
// reviewed roughly half-yearly, so they change. Mirrored by backend-go/handlers/market/fno.go and
// refresher/services/fno_ideas.py; verify against the current circular before relying on them.
export const LOT_SIZES: Readonly<Record<string, number>> = {
  NIFTY: 65,
  BANKNIFTY: 30,
  FINNIFTY: 60,
  MIDCPNIFTY: 120,
  SENSEX: 20,
  BANKEX: 30,
};

/**
 * Offline fallback only: the chain snapshot's `lotSize` covers stock options too and wins whenever
 * it has landed. Null for anything off this list — callers must fall back to plain quantity rather
 * than assume a default, because a guessed lot size sizes a real order wrong.
 */
export function lotSizeFor(underlying: string | undefined): number | null {
  if (!underlying) return null;
  return LOT_SIZES[underlying.toUpperCase()] ?? null;
}
