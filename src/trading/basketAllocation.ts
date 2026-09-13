import type {OrderSide} from '../types/trade.ts';
import {priceAtPercent} from './orderProtection.ts';

export type AllocationMode = 'equal' | 'custom';

export type BasketRowBlock = 'unpriced' | 'underfunded';

/**
 * The slice of a market recommendation the allocator reads. Structural so the apps pass their
 * full `Recommendation` rows through and get them back on each `BasketRow.reco`.
 */
export interface BasketReco {
  stock_symbol: string;
  direction?: string | null;
  cmp: number;
}

export interface BasketRowOverride {
  amount?: number;
  targetPct?: number | null;
  stopPct?: number | null;
}

export interface BasketRow<R extends BasketReco = BasketReco> {
  reco: R;
  price: number;
  side: OrderSide;
  allotted: number;
  qty: number | null;
  orderValue: number | null;
  block: BasketRowBlock | null;
  targetPct: number | null;
  stopPct: number | null;
  targetPrice: number | null;
  stopPrice: number | null;
  overridden: boolean;
}

export interface BasketAllocation<R extends BasketReco = BasketReco> {
  rows: BasketRow<R>[];
  total: number;
  remainder: number;
  placeableCount: number;
  blockedCount: number;
}

export interface AllocateBasketArgs<R extends BasketReco = BasketReco> {
  recos: R[];
  amount: number;
  mode: AllocationMode;
  overrides: Record<string, BasketRowOverride>;
  targetPct: number | null;
  stopPct: number | null;
}

const isShortDirection = (direction?: string | null): boolean =>
  direction?.toLowerCase() === 'short';

/**
 * A row is never rounded up to one share: a ₹4,000 stock inside a ₹1,000 slice is skipped, not
 * bought, because the alternative silently spends four times the budget the user typed. That
 * leftover is what `remainder` reports. Exits stay percentages — ₹98 is a 2% stop on one stock
 * and a 90% stop on another — resolved per row into the rupee price the row displays.
 */
export function allocateBasket<R extends BasketReco>({
  recos,
  amount,
  mode,
  overrides,
  targetPct,
  stopPct,
}: AllocateBasketArgs<R>): BasketAllocation<R> {
  const perRow = recos.length > 0 ? amount / recos.length : 0;

  const rows = recos.map(reco =>
    buildRow(reco, perRow, mode, overrides, targetPct, stopPct),
  );
  const total = rows.reduce((sum, row) => sum + (row.orderValue ?? 0), 0);

  return {
    rows,
    total,
    remainder: Math.max(0, amount - total),
    placeableCount: rows.filter(row => row.block == null).length,
    blockedCount: rows.filter(row => row.block != null).length,
  };
}

function buildRow<R extends BasketReco>(
  reco: R,
  perRow: number,
  mode: AllocationMode,
  overrides: Record<string, BasketRowOverride>,
  targetPct: number | null,
  stopPct: number | null,
): BasketRow<R> {
  const override = overrides[reco.stock_symbol] ?? {};
  const price = reco.cmp;
  const side: OrderSide = isShortDirection(reco.direction) ? 'SELL' : 'BUY';
  const allotted = mode === 'custom' ? (override.amount ?? perRow) : perRow;
  const qty = price > 0 ? Math.floor(allotted / price) : 0;
  const block = blockFor(price, qty);
  const placeable = block == null;

  // `undefined` inherits the basket; an explicit `null` is a cleared leg the basket default
  // must not fill back in.
  const rowTarget =
    override.targetPct !== undefined ? override.targetPct : targetPct;
  const rowStop = override.stopPct !== undefined ? override.stopPct : stopPct;
  // Shorts carry no legs — a ManualSellRequest has nothing to attach them to.
  const exitable = placeable && side === 'BUY';

  return {
    reco,
    price,
    side,
    allotted,
    qty: placeable ? qty : null,
    orderValue: placeable ? qty * price : null,
    block,
    targetPct: exitable ? rowTarget : null,
    stopPct: exitable ? rowStop : null,
    targetPrice:
      exitable && rowTarget != null ? priceAtPercent(price, rowTarget) : null,
    stopPrice:
      exitable && rowStop != null ? priceAtPercent(price, -rowStop) : null,
    overridden:
      override.targetPct !== undefined || override.stopPct !== undefined,
  };
}

function blockFor(price: number, qty: number): BasketRowBlock | null {
  if (!(price > 0)) return 'unpriced';
  if (qty < 1) return 'underfunded';
  return null;
}

export function seedCustomAmounts(
  rows: BasketRow[],
  overrides: Record<string, BasketRowOverride>,
): Record<string, BasketRowOverride> {
  const next = {...overrides};
  for (const row of rows) {
    next[row.reco.stock_symbol] = {
      ...next[row.reco.stock_symbol],
      amount: Math.round(row.allotted),
    };
  }
  return next;
}

export function sweepRemainder(
  rows: BasketRow[],
  remainder: number,
  overrides: Record<string, BasketRowOverride>,
): Record<string, BasketRowOverride> {
  const target = rows
    .filter(row => row.price > 0 && row.price <= remainder)
    .sort((a, b) => a.price - b.price)[0];
  if (!target) return overrides;

  return {
    ...overrides,
    [target.reco.stock_symbol]: {
      ...overrides[target.reco.stock_symbol],
      amount: Math.round(target.allotted + remainder),
    },
  };
}
