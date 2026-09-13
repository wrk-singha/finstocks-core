import type {OrderSide} from '../types/trade.ts';
import type {TradeData} from '../types/user.ts';
import {isFnOSymbol} from '../market/symbols.ts';

/**
 * A quantity the exchange will accept: a whole number of lots, never fewer than one. Sub-lot
 * orders are rejected outright, and a negative one prices a buy as a credit — so every stepper
 * and typed field sizing an order goes through this. Equity (null lot) steps in single units.
 */
export function clampToLot(
  next: number,
  lotSize: number | null | undefined,
): number {
  const step = lotSize ?? 1;
  const units = Math.floor(next) || step;
  return Math.max(step, Math.floor(units / step) * step);
}

/**
 * One fill in the flat order log (the settings-screen list). Named apart from ordersModel's
 * `OrderRow`, which is the status-aware row the portfolio tabs render.
 */
export interface OrderLogRow {
  id: string;
  side: OrderSide;
  symbol: string;
  quantity: number;
  price: number;
  /** ISO timestamp of the fill. */
  at: string;
  isFno: boolean;
}

export interface OrderLogDay {
  /** yyyy-mm-dd, used only as a grouping key. */
  date: string;
  orders: OrderLogRow[];
}

/**
 * The order log, derived from trades.
 *
 * A trade row holds both legs of a round trip, so one closed trade is two orders in the log —
 * the buy that opened it and the sell that closed it, each at its own timestamp. Reading it any
 * other way would hide half of what the account actually did.
 */
export function deriveOrders(trades: TradeData[] | undefined): OrderLogRow[] {
  const orders: OrderLogRow[] = [];

  for (const trade of trades ?? []) {
    const quantity = trade.quantity || 0;
    if (!quantity) continue;
    const isFno = isFnOSymbol(trade.stock_symbol);

    if (trade.buy_price) {
      orders.push({
        id: `${trade.id}-buy`,
        side: 'BUY',
        symbol: trade.stock_symbol,
        quantity,
        price: trade.buy_price,
        at: trade.buy_time ?? trade.timestamp,
        isFno,
      });
    }

    if (trade.sell_price) {
      orders.push({
        id: `${trade.id}-sell`,
        side: 'SELL',
        symbol: trade.stock_symbol,
        quantity,
        price: trade.sell_price,
        at: trade.sell_time ?? trade.timestamp,
        isFno,
      });
    }
  }

  return orders.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function groupOrderLogByDay(orders: OrderLogRow[]): OrderLogDay[] {
  const days: OrderLogDay[] = [];

  for (const order of orders) {
    const parsed = new Date(order.at);
    if (Number.isNaN(parsed.getTime())) continue;
    const date = parsed.toISOString().slice(0, 10);

    const last = days.at(-1);
    if (last?.date !== date) days.push({date, orders: [order]});
    else last.orders.push(order);
  }

  return days;
}
