import type {StockGraphData} from '../types/graphData.ts';
import {extractUnderlyingSymbol} from './symbols.ts';

// Kept in step with fnoSymbolRe in backend-go/handlers/trading/graph.go, which
// decides the same question server-side to pick fno_ohlcv_1m over ohlcv_1m.
// The strike allows a decimal point: NSE spaces some underlyings' strikes at
// 2.5 or 5 rupees near the money, not just whole rupees.
const FNO_SYMBOL_RE =
  /^[A-Z0-9&-]+\d{2}[A-Z0-9]{1,5}(?:\d+(?:\.\d+)?(?:CE|PE)|FUT)$/;

/**
 * The symbol to ask graph-data for when pricing a trade.
 *
 * A contract prices against its OWN premium series, not its underlying's:
 * graph-data routes anything matching the contract form to fno_ohlcv_1m and
 * returns real premiums. Collapsing NIFTY2681824400PE to NIFTY would mark a
 * ₹124 premium against a ₹24,000 index level and invent a P&L. Everything
 * else still normalizes (RELIANCE-EQ → RELIANCE, NIFTY 50 → NIFTY).
 */
export const priceSymbolFor = (stockSymbol: string): string => {
  const raw = (stockSymbol || '').trim().toUpperCase();
  return FNO_SYMBOL_RE.test(raw) ? raw : extractUnderlyingSymbol(raw);
};

// Newest close in a symbol's series, looked up case-tolerantly and sorted by
// time so a newest-first payload and an oldest-first one both answer the same.
// drift resolved 2026-09-13: the web looked the key up verbatim only; the
// mobile's case-tolerant lookup wins because the graph-data map is keyed by
// whatever spelling the request used.
const latestClose = (
  graphData: StockGraphData | undefined,
  symbol: string,
): number | null => {
  if (!graphData) return null;
  for (const key of [symbol, symbol.toUpperCase(), symbol.toLowerCase()]) {
    const series = graphData[key];
    if (series && series.length > 0) {
      const latest = [...series].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      )[series.length - 1];
      return latest ? latest.close : null;
    }
  }
  return null;
};

/**
 * Latest close for a symbol, or null when no series backs it. Null is not 0:
 * an unpriced position must stay distinguishable from a flat one, so callers
 * render a placeholder rather than a confident zero.
 */
export const livePriceFor = (
  graphData: StockGraphData | undefined,
  symbol: string,
): number | null => {
  const raw = latestClose(graphData, symbol);
  if (raw == null) return null;
  // Two-decimal rounding, as the apps' getCurrentPriceFromGraphData did.
  const price = parseFloat(raw.toFixed(2));
  return Number.isFinite(price) && price > 0 ? price : null;
};
