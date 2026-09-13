import type {Interval, Period} from './graphData.ts';

/**
 * Union of the two apps' terminal contracts (drift resolved 2026-09-13). Mobile's file is a
 * subset of web's plus `Side`, `SPOT_MODES` and `SharedOrderState`; nothing disagreed on a
 * field's type, so both copies are carried whole.
 */

/** The terminal runs in one of two modes: cash equity or index F&O options. */
export type TerminalMode = 'equity' | 'fno';

/** Which leg of an option contract. */
export type Side = 'CE' | 'PE';

export type OptionSide = Side;

/** Which series the F&O workspace's top pane charts — the underlying's spot price or the front-month future. */
export const SPOT_MODES = ['spot', 'fut'] as const;
export type SpotMode = (typeof SPOT_MODES)[number];

/**
 * How the next order gets its price.
 *  "market" — one tap, fills at whatever the book gives.
 *  "limit"  — on web the price comes off a line dragged on the chart; on mobile it is typed.
 */
export type OrderMode = 'market' | 'limit';

/** Derived from the URL: /chart?symbol= => equity, /chart?symbol=&mode=fno => fno. */
export interface TerminalSymbolState {
  mode: TerminalMode;
  symbol: string;
  market: 'IN';
  period: Period;
  interval: Interval;
  strategyId: string | null;
  expiry?: string;
  strike?: number;
}

/**
 * The instrument the docked order card is currently pointed at.
 *
 * A terminal screen can show three charts at once (spot, Call, Put) and only some of them are
 * tradeable, so "what am I buying" cannot be inferred from the page's symbol — the user names
 * it by tapping a pane, and this is what the tap selects. `id` is pane identity rather than the
 * symbol, because the two contract panes differ only by side and both change symbol on a strike
 * change.
 */
export interface OrderTarget {
  id: string;
  /** Broker order symbol. */
  symbol: string;
  /** What the card and the confirm dialog call it. */
  label: string;
  /** Last traded price: seeds the limit line and prices the order-value line. */
  ltp: number | null;
  /**
   * Units per lot. Its presence switches the order pad from counting units to counting lots,
   * so it is set only where the lot size is actually known.
   */
  lotSize?: number;
  /** Side accent (CE green / PE red). Undefined falls back to brand. */
  accent?: string;
  /** Appended to the confirm dialog's side, so it reads "Buy CE". */
  sideLabel?: string;
}

/**
 * Quantity + order mode shared by every trade ticket on a terminal screen. Limit price is
 * shared because screens outside the ticket (the payoff) have to price the same trade the
 * ticket would send; it is null in market mode, where only the live quote decides.
 */
export interface SharedOrderState {
  mode: OrderMode;
  setMode: (mode: OrderMode) => void;
  /** Always in units, whatever a ticket displays — this is what the broker gets. */
  qty: number;
  setQty: (qty: number) => void;
  lotSize: number | null;
  limitPrice: number | null;
  setLimitPrice: (price: number | null) => void;
}

/**
 * Wiring a chart pane needs to draw and drive the draggable limit line. `active` is false in
 * market mode, where no line should exist at all.
 */
export interface LimitLineControl {
  active: boolean;
  price: number | null;
  onChange: (price: number) => void;
}

/**
 * Both directions of a chart's vertical axis, in pixels measured from the top of the element
 * the limit line is drawn into. Every chart library states this differently, so each pane
 * supplies its own and the line itself stays library-agnostic.
 */
export interface PriceAxis {
  priceToY: (price: number) => number | null;
  yToPrice: (y: number) => number | null;
  /**
   * The plot's own top and height, so a drag can be held inside the candles rather than run
   * off into the axis and extrapolate a price nobody can see.
   */
  bounds: () => {top: number; height: number} | null;
}

export interface TerminalSymbolControls {
  /**
   * A chart-control plan can change both symbol and resolution in one turn; `interval` lets
   * the caller carry the resolution it just applied into the new URL instead of the stale one.
   */
  setSymbol: (symbol: string, mode: TerminalMode, interval?: Interval) => void;
  setExpiry: (expiry: string) => void;
  setStrike: (strike: number) => void;
  /**
   * Candle resolution, chosen from the chart's own strip. Lives in the URL like the rest of
   * the scene so a shared /chart link opens on the same timeframe.
   */
  setInterval: (interval: Interval) => void;
}

export interface BrokerPosition {
  symbol: string;
  qty: number;
  avgPrice: number;
}

export interface BrokerExecution {
  symbol: string;
  price: number;
  qty: number;
  isBuy: boolean;
  /** Epoch milliseconds. */
  time: number;
}

/**
 * What the TradingView broker adapter reads from the host app.
 *
 * The adapter is built once, at widget init, from outside the UI framework, so the host passes
 * a getter it keeps current rather than values frozen at construction. The buy/sell payloads
 * are the host's manual-trade request bodies, supplied by the caller.
 */
export interface BrokerDeps<TBuy = unknown, TSell = unknown> {
  connected: boolean;
  isMock: boolean;
  /** Null until the wallet sync produces a real figure; never coerce to zero. */
  equity: number | null;
  positions: BrokerPosition[];
  executions: BrokerExecution[];
  buy: (payload: TBuy) => Promise<unknown>;
  sell: (payload: TSell) => Promise<unknown>;
  onOrderPlaced: () => void;
}

/** A number the Account Manager watches for changes. */
export interface WatchedValue {
  setValue: (value: number) => void;
}

/** The slice of TradingView's IBrokerConnectionAdapterHost the adapter uses. */
export interface BrokerHost {
  factory: {createWatchedValue: (value: number) => WatchedValue};
  defaultContextMenuActions: (
    context: unknown,
    options?: unknown,
  ) => Promise<unknown[]>;
}

/** An order as TradingView's ticket submits it. */
export interface PlaceOrderRequest {
  symbol: string;
  side: number;
  type: number;
  qty: number;
  limitPrice?: number;
}

export type BrokerFactory = (host: BrokerHost) => unknown;
