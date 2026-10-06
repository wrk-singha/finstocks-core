// One trade from entry to exit, from a backtest row or a lot in the user's book, so both are
// measured the same way by the journal and the Monte Carlo (web feat/chart-parity 76f1dfee).
import {IST_OFFSET_MS} from '../market/marketHours.ts';
import {
  calculatePNL,
  getTradeEntryPrice,
  getTradePremium,
  isShortPosition,
} from '../portfolio/portfolio.ts';
import type {ExecutionLogEntry} from '../types/strategyLogs.ts';
import type {TradeData} from '../types/user.ts';

export type TripSource = 'backtest' | 'mock' | 'live';

export interface RoundTrip {
  /** Stable across reads: the book row's id, or the backtest's row index. */
  id: string;
  symbol: string;
  side: 'long' | 'short';
  qty: number;
  /** A true instant (epoch ms). */
  entryMs: number;
  entryPrice: number;
  /** Null while the trade is still open. */
  exitMs: number | null;
  exitPrice: number | null;
  /** Rupees for the whole trade; null while open. */
  pnl: number | null;
  exitReason?: string;
  source: TripSource;
  /** The strategy that placed it, when one did. */
  strategyId?: string | null;
}

const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const WALL_CLOCK_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/**
 * A recorded time as a true instant. A time with no offset is IST wall clock (the backtest
 * engine's), which `Date.parse` would read in the viewer's zone.
 */
export function tradeInstantMs(
  value: string | null | undefined,
): number | null {
  if (!value) return null;
  const s = value.trim();
  if (!s) return null;
  if (OFFSET_RE.test(s)) {
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
  }
  const m = WALL_CLOCK_RE.exec(s);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', sec = '0'] = m;
  const ms =
    Date.UTC(+(y ?? 0), +(mo ?? 1) - 1, +(d ?? 1), +h, +mi, +sec) -
    IST_OFFSET_MS;
  return Number.isFinite(ms) ? ms : null;
}

const SHORT_WORDS = /^(short|sell|s)$/i;

/** A backtest's trades as round trips, in the order they were entered. */
export function backtestRoundTrips(
  trades: readonly ExecutionLogEntry[] | null | undefined,
): RoundTrip[] {
  const out: RoundTrip[] = [];
  (trades ?? []).forEach((t, i) => {
    const entryMs = tradeInstantMs(t.buy_time);
    const entryPrice = t.buy_price;
    if (entryMs == null || !Number.isFinite(entryPrice) || entryPrice <= 0) {
      return;
    }
    const exitMs = tradeInstantMs(t.sell_time);
    const exitPrice = t.sell_price;
    const closed =
      exitMs != null && Number.isFinite(exitPrice) && exitPrice > 0;
    const symbol = (
      t.symbol ||
      ((t as {stock_symbol?: string}).stock_symbol ?? '')
    ).toUpperCase();
    out.push({
      id: `bt${i}`,
      symbol,
      side: SHORT_WORDS.test(t.trade_side ?? '') ? 'short' : 'long',
      qty: t.quantity || 0,
      entryMs,
      entryPrice,
      exitMs: closed ? exitMs : null,
      exitPrice: closed ? exitPrice : null,
      // A row with no recorded result stays without one, never a ₹0 trade (web 148eba34).
      pnl: closed && Number.isFinite(t.pnl) ? t.pnl : null,
      ...(t.exit_reason ? {exitReason: t.exit_reason} : {}),
      source: 'backtest',
    });
  });
  return out.sort((a, b) => a.entryMs - b.entryMs);
}

/** Mock or Live, as the book row says; null for a row in neither book. */
const bookSource = (trade: {
  status?: string | null;
}): Exclude<TripSource, 'backtest'> | null =>
  trade.status === 'SIMULATION'
    ? 'mock'
    : trade.status === 'LIVE'
      ? 'live'
      : null;

/**
 * The user's book as round trips: each row is one lot, entered at its buy_time and closed at its
 * sell_time. A short is recorded with its entry in `buy_*` and its cover in `sell_*` (see
 * calculatePNL), so both sides read the same way. Rows in neither book are left out.
 */
export function bookRoundTrips(
  trades: readonly TradeData[] | null | undefined,
): RoundTrip[] {
  const out: RoundTrip[] = [];
  for (const t of trades ?? []) {
    const source = bookSource(t);
    if (!source) continue;
    const entryMs = tradeInstantMs(t.buy_time);
    const exitMs = tradeInstantMs(t.sell_time);
    const {sellPremium} = getTradePremium(t.execution_payload);
    const rawExit =
      sellPremium ??
      (t.sell_price != null && t.sell_price !== 0 ? t.sell_price : null);
    // The exit is the yardstick for an index-scale entry on a contract, as in calculatePNL.
    const entryPrice = getTradeEntryPrice(t, rawExit);
    if (entryMs == null || !(entryPrice > 0)) continue;
    const closed = exitMs != null && rawExit != null && rawExit > 0;
    out.push({
      id: t.id,
      symbol: t.stock_symbol.toUpperCase(),
      side: isShortPosition(t.execution_payload) ? 'short' : 'long',
      qty: t.quantity || 0,
      entryMs,
      entryPrice,
      exitMs: closed ? exitMs : null,
      exitPrice: closed ? rawExit : null,
      pnl: closed ? calculatePNL(t) : null,
      source,
      strategyId: t.strategy_id ?? null,
    });
  }
  return out.sort((a, b) => a.entryMs - b.entryMs);
}

/** Symbols a list of trips covers, most traded first. */
export function tripSymbols(
  trips: readonly RoundTrip[],
): {symbol: string; count: number}[] {
  const counts = new Map<string, number>();
  for (const t of trips) counts.set(t.symbol, (counts.get(t.symbol) ?? 0) + 1);
  return [...counts.entries()]
    .map(([symbol, count]) => ({symbol, count}))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
}
