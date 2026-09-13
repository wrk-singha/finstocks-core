import {formatCurrency} from '../format/index.ts';
import type {TradeData} from '../types/user.ts';
import {calculatePNL} from './portfolio.ts';

/**
 * The user's own trading, read back to them.
 *
 * The premise, from SEBI's own numbers: loss-makers trade *more* than
 * profit-makers, and the loss rate climbs to 80% above 500 trades a year. The
 * people losing money are not the under-informed, they are the over-engaged —
 * which means an education feature that generates fresh reasons to trade makes
 * the problem worse, however good its content is.
 *
 * So nothing here is a signal, a pattern or a call. Every line is a fact about
 * what this account already did, computed from its own closed trades. The
 * number is the intervention; there is no advice attached, and none of it can
 * be acted on by placing a trade.
 */

const DAY_MS = 86_400_000;

/** A just-closed loss speaks only once it is worth this share of the account's
 *  median position size. Set where a loss reads as a real dent rather than
 *  noise on a scratch trade. */
const REENTRY_LOSS_FLOOR = 0.02;

interface ClosedTrade {
  symbol: string;
  pnl: number;
  boughtAt: number;
  soldAt: number;
  holdMins: number;
  notional: number;
}

const parse = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};

/** Round-trips only. An open position has no hold time and no realised P&L, so
 *  it cannot say anything about how this account exits. */
function closedTrades(trades: TradeData[]): ClosedTrade[] {
  const out: ClosedTrade[] = [];
  for (const t of trades) {
    const boughtAt = parse(t.buy_time);
    const soldAt = parse(t.sell_time);
    if (boughtAt == null || soldAt == null || soldAt <= boughtAt) continue;
    const pnl = calculatePNL(t);
    if (pnl == null) continue;
    const qty = t.quantity || 0;
    out.push({
      symbol: t.stock_symbol,
      pnl,
      boughtAt,
      soldAt,
      holdMins: (soldAt - boughtAt) / 60_000,
      notional: Math.abs((t.buy_price ?? 0) * qty),
    });
  }
  return out.sort((a, b) => a.soldAt - b.soldAt);
}

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? 0;
  return sorted.length % 2 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2;
};

export interface PreTradeNoteInput {
  symbol: string;
  /** Rupee value of the order about to be placed. Omit (or 0) to skip the size comparison. */
  orderValue?: number;
  now?: number;
  /** False when `orderValue` isn't denominated like the account's equity
   *  notionals — an options margin or a whole basket isn't a multiple of
   *  anything, and printing one would invent a fact. */
  orderValueComparable?: boolean;
}

/**
 * The one sentence worth putting in front of an order, or nothing.
 *
 * This is the highest-leverage surface in the product and the easiest to ruin:
 * contextual help beats upfront tutorials roughly 72% to 19% on engagement, but
 * only while it stays rare. So it is capped at a single line, it never blocks
 * the order, and it stays silent unless this account's own history says
 * something specific about this order.
 *
 * drift resolved 2026-09-13: mobile added the order-size line (`orderValue`,
 * `orderValueComparable`); web had only the recency and per-symbol lines.
 * Mobile won — it is the newer copy and the gate is documented. `orderValue`
 * is optional so the web caller's `{symbol}` still type-checks and behaves as
 * before.
 */
export function preTradeNote(
  trades: TradeData[] | undefined,
  {
    symbol,
    orderValue = 0,
    now = Date.now(),
    orderValueComparable = true,
  }: PreTradeNoteInput,
): string | null {
  if (!trades?.length) return null;
  const closed = closedTrades(trades);
  if (closed.length < 5) return null;

  const recent = closed.filter(
    t => now - t.soldAt <= 90 * DAY_MS && t.notional > 0,
  );
  const typicalNotional = median(recent.map(t => t.notional));

  // Ordered by how time-critical it is, not by how interesting. A loss closed
  // minutes ago is the one that changes what happens in the next thirty seconds.
  //
  // Gated on size as well as recency: an account closing trades every few
  // minutes almost always has *a* red one behind it, so recency alone would
  // put this line above nearly every order — and a warning that is always on
  // is one nobody reads. The floor scales to what this account actually
  // trades, because a loss worth interrupting someone over is a loss that is
  // large relative to their own positions, not a fixed rupee figure.
  const lastLoss = [...closed].reverse().find(t => t.pnl < 0);
  const lossFloor =
    typicalNotional > 0 ? typicalNotional * REENTRY_LOSS_FLOOR : Infinity;
  if (
    lastLoss &&
    now - lastLoss.soldAt <= 30 * 60_000 &&
    Math.abs(lastLoss.pnl) >= lossFloor
  ) {
    const mins = Math.max(1, Math.round((now - lastLoss.soldAt) / 60_000));
    return `You closed a loss on ${lastLoss.symbol} ${mins} min ago.`;
  }

  if (
    orderValueComparable &&
    recent.length >= 6 &&
    orderValue > 0 &&
    typicalNotional > 0 &&
    orderValue >= typicalNotional * 2.5
  ) {
    return `This is ${(orderValue / typicalNotional).toFixed(1)}× your usual order size of ${formatCurrency(typicalNotional, 0)}.`;
  }

  const onSymbol = recent.filter(t => t.symbol === symbol);
  const losses = onSymbol.filter(t => t.pnl < 0).length;
  if (losses >= 2 && onSymbol.reduce((sum, t) => sum + t.pnl, 0) < 0) {
    return `${symbol} has closed at a loss ${losses} times for you in the last 90 days.`;
  }

  return null;
}
