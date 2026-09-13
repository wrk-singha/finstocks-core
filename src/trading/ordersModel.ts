import type {OrderSide} from '../types/trade.ts';
import type {TradeData} from '../types/user.ts';
import {extractUnderlyingSymbol, isFnOSymbol} from '../market/symbols.ts';

export type OrderStatus =
  | 'NEW'
  | 'ACKED'
  | 'APPROVED'
  | 'TRIGGER_PENDING'
  | 'MODIFICATION_REQUESTED'
  | 'CANCELLATION_REQUESTED'
  | 'EXECUTED'
  | 'COMPLETED'
  | 'DELIVERY_AWAITED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'FAILED'
  | 'UNKNOWN';

export type OrderTab = 'open' | 'executed' | 'cancelled';

export interface OrderRow {
  id: string;
  symbol: string;
  underlying: string;
  isFno: boolean;
  side: OrderSide;
  status: OrderStatus;
  orderType?: string | null;
  product?: string | null;
  exchange?: string | null;
  quantity: number;
  filledQuantity?: number;
  price?: number | null;
  placedAt: string;
}

export interface OrderDay {
  date: string;
  orders: OrderRow[];
}

/**
 * The two "requested" states sit under Open on purpose: the exchange hasn't answered yet, so
 * the order can still fill. Filing them under Cancelled would tell someone a position was
 * killed while it was still live.
 */
export const ORDER_TAB_STATUSES: Readonly<
  Record<OrderTab, readonly OrderStatus[]>
> = {
  open: [
    'NEW',
    'ACKED',
    'APPROVED',
    'TRIGGER_PENDING',
    'MODIFICATION_REQUESTED',
    'CANCELLATION_REQUESTED',
  ],
  executed: ['EXECUTED', 'COMPLETED', 'DELIVERY_AWAITED'],
  cancelled: ['CANCELLED', 'REJECTED', 'FAILED'],
};

export function tabForStatus(status: OrderStatus): OrderTab {
  if (ORDER_TAB_STATUSES.executed.includes(status)) return 'executed';
  if (ORDER_TAB_STATUSES.cancelled.includes(status)) return 'cancelled';
  return 'open';
}

const STATUS_LABEL: Readonly<Record<OrderStatus, string>> = {
  NEW: 'Placed',
  ACKED: 'Acknowledged',
  APPROVED: 'Open',
  TRIGGER_PENDING: 'Trigger pending',
  MODIFICATION_REQUESTED: 'Modifying',
  CANCELLATION_REQUESTED: 'Cancelling',
  EXECUTED: 'Executed',
  COMPLETED: 'Completed',
  DELIVERY_AWAITED: 'Delivery awaited',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
};

export function orderStatusLabel(status: OrderStatus): string {
  return STATUS_LABEL[status] ?? STATUS_LABEL.UNKNOWN;
}

const KNOWN_STATUSES = new Set<string>(Object.keys(STATUS_LABEL));

export function normalizeOrderStatus(
  raw: string | null | undefined,
): OrderStatus {
  if (!raw) return 'UNKNOWN';
  const upper = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  // The broker's REST samples carry OPEN even though its own enum table omits it.
  if (upper === 'OPEN') return 'APPROVED';
  if (upper === 'SL_M' || upper === 'PENDING') return 'TRIGGER_PENDING';
  return KNOWN_STATUSES.has(upper) ? (upper as OrderStatus) : 'UNKNOWN';
}

export type OrderStatusTone = 'success' | 'error' | 'warning';

/** Not the P&L palette: an executed sell tinted red would read as a loss. */
export function orderStatusTone(status: OrderStatus): OrderStatusTone {
  if (ORDER_TAB_STATUSES.executed.includes(status)) return 'success';
  if (ORDER_TAB_STATUSES.cancelled.includes(status)) return 'error';
  return 'warning';
}

/** The broker has no PARTIALLY_FILLED status — partiality is only ever arithmetic. */
export function isPartiallyFilled(order: OrderRow): boolean {
  return (
    order.filledQuantity !== undefined &&
    order.filledQuantity > 0 &&
    order.filledQuantity < order.quantity
  );
}

function buildOrder(
  trade: TradeData,
  side: OrderSide,
  price: number,
  at: string | null,
): OrderRow {
  const status = normalizeOrderStatus(trade.order_status);

  return {
    id: `${trade.id}-${side.toLowerCase()}`,
    symbol: trade.stock_symbol,
    underlying: extractUnderlyingSymbol(trade.stock_symbol),
    isFno: isFnOSymbol(trade.stock_symbol),
    side,
    status: status === 'UNKNOWN' ? 'EXECUTED' : status,
    orderType: trade.order_type ?? null,
    product: trade.product ?? null,
    exchange: trade.exchange ?? null,
    quantity: trade.quantity,
    filledQuantity: trade.quantity,
    price,
    placedAt: at ?? trade.timestamp,
  };
}

/**
 * A trade row holds both legs of a round trip, so one closed trade is two orders — the buy that
 * opened it and the sell that closed it.
 *
 * A trade row only exists once it has a fill price, so every row here is EXECUTED; orders that
 * were rejected, cancelled, or are still resting at the exchange leave no trade row and cannot
 * appear. That is why the Open and Cancelled tabs say the feed is missing rather than that
 * nothing happened. When a real order endpoint exists, replace this function and nothing else.
 */
export function deriveOrdersFromTrades(
  trades: TradeData[] | undefined,
): OrderRow[] {
  const orders: OrderRow[] = [];

  for (const trade of trades ?? []) {
    if (!trade.quantity) continue;
    if (trade.buy_price) {
      orders.push(buildOrder(trade, 'BUY', trade.buy_price, trade.buy_time));
    }
    if (trade.sell_price) {
      orders.push(buildOrder(trade, 'SELL', trade.sell_price, trade.sell_time));
    }
  }

  return orders.sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
  );
}

/**
 * Kept beside deriveOrdersFromTrades so the two agree on what counts as an order; the badge
 * needs the total, not the rows or their ordering.
 */
export function countOrdersFromTrades(trades: TradeData[] | undefined): number {
  let count = 0;
  for (const trade of trades ?? []) {
    if (!trade.quantity) continue;
    if (trade.buy_price) count++;
    if (trade.sell_price) count++;
  }
  return count;
}

export function groupOrdersByDay(orders: OrderRow[]): OrderDay[] {
  const days: OrderDay[] = [];

  for (const order of orders) {
    const parsed = new Date(order.placedAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const date = parsed.toISOString().slice(0, 10);

    const last = days.at(-1);
    if (last?.date !== date) days.push({date, orders: [order]});
    else last.orders.push(order);
  }

  return days;
}
