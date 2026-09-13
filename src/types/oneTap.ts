import type {OrderType} from './trade.ts';

export type BracketUnit = 'pct' | 'pts';

export type SlMode = 'auto' | 'trailing';

/**
 * Where a 1-tap limit order gets its price, since no one types one. "bbo" crosses the spread
 * and fills like a market order with a ceiling; "ltp" and "mid" price better but can rest
 * unfilled.
 */
export type LimitPriceSource = 'bbo' | 'ltp' | 'mid';

/**
 * The three product classes the terminal can trade, each with its own pair of broker product
 * codes. The wire takes one flat enum (MIS|CNC|NRML, validated in backend-go
 * handlers/trading/manual.go); the split is ours, because a contract cannot be delivered and
 * equity cannot be NRML.
 */
export interface ProductByClass {
  equity: 'CNC' | 'MIS';
  futures: 'NRML' | 'MIS';
  options: 'NRML' | 'MIS';
}

/** Every numeric field treats 0 as "off". */
export interface OneTapSettings {
  enabled: boolean;
  /** Lots, not units. Multiplied by the symbol's lot size at fire time. */
  qtyByUnderlying: Record<string, number>;
  product: ProductByClass;
  entryOrderType: OrderType;
  exitOrderType: OrderType;
  limitPriceSource: LimitPriceSource;
  bracketUnit: BracketUnit;
  slMode: SlMode;
  slEnabled: boolean;
  tpEnabled: boolean;
  slPct: number;
  tpPct: number;
  trailPts: number;
  /**
   * Rupee ceiling on a single 1-tap order, 0 for none (see exceedsCeiling). Mobile-only until
   * the web adopts it; the web's defaults must carry `maxOrderValue: 0`.
   */
  maxOrderValue: number;
}
