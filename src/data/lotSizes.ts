// Units per lot for index derivatives, as of the January 2026 exchange revision. SEBI has these
// reviewed roughly half-yearly, so they change. The source of truth is
// backend-go/handlers/trading/fnolots.go, which carries all 216 listed underlyings; this is the six
// indices only, mirrored there and in sentinel/core/constants.py. Verify against the current
// circular before relying on them.
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
 *
 * MCX commodities are in neither map, so they are always null here and their pads step in single
 * units.
 */
export function lotSizeFor(underlying: string | undefined): number | null {
  if (!underlying) return null;
  return LOT_SIZES[underlying.toUpperCase()] ?? null;
}
