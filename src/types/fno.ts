/**
 * `FUT` is a futures contract, not an option: it has no strike and its payoff
 * is linear in spot, so both tails are unbounded.
 */
export type OptionRight = 'CE' | 'PE' | 'FUT';
export type LegAction = 'buy' | 'sell';

/**
 * What pressing a price in the option chain does.
 *
 * `standard` opens a full ticket (price type, exits, quantity). `instant` places
 * a market order from the row itself. `basket` collects legs and sends them
 * together. Phone-only today — the desktop board keeps its own basket switch.
 */
export type ChainMode = 'standard' | 'instant' | 'basket';

/**
 * What an order pad currently has on it, published so the payoff beside it draws
 * the order being typed rather than the quote it started from — the price a
 * trader enters is the one their risk is actually at.
 */
export interface OptionOrderDraft {
  side: LegAction;
  qty: number;
  /** Limit price when one is set, else the live quote. Null when neither is known. */
  price: number | null;
}

export interface OptionLeg {
  action: LegAction;
  right: OptionRight;
  strike: number;
  /** Per-unit premium at the quoted price. */
  premium: number;
  lots: number;
}

/**
 * A complete trade idea: a view, the structure that expresses it, and what it
 * costs to be wrong. Legs are always a full position — never a single suggested
 * strike the user has to assemble, because assembling it is the step retail
 * gets wrong.
 */
export interface FnoTradeIdea {
  id: number;
  underlying: string;
  /** Human name of the structure, e.g. "Bull call spread". */
  label: string;
  /** The view in one line, e.g. "Mildly bullish into expiry". */
  view: string;
  legs: OptionLeg[];
  lotSize: number;
  /** ISO date of the expiry every leg shares. */
  expiry: string;
  spot: number;
  /** Margin or premium the broker blocks, in ₹. */
  capitalRequired: number;
  /**
   * What the same directional view would cost unhedged. Present only when the
   * hedge is what unlocks the margin — SEBI's framework cuts the requirement
   * roughly 60-70% for defined-risk positions, and most retail never sees that
   * the cheaper trade is also the safer one.
   */
  nakedCapitalRequired?: number;
  /** IV percentile of the underlying, 0-100. Null when unavailable. */
  ivPercentile: number | null;
  convictionPct: number;
  rationale: string;
  /** Which horizon the idea belongs to — intraday, positional or expiry. */
  horizon?: string;
  /** "active" while the idea is live; hit_target/hit_stop/expired once resolved. */
  status?: string;
  realized_pnl?: number | null;
}

export type FnoPositionHealth = 'on_track' | 'watch' | 'breached';

/**
 * An open F&O position with the exit that was agreed at entry. `planExitPct`
 * is what makes the exit desk possible: without a number set up front there is
 * nothing to hold the user to, which is the documented failure mode.
 */
export interface FnoPosition {
  id: number;
  underlying: string;
  label: string;
  legs: OptionLeg[];
  /** Null when the exchange lot size for this underlying is not known. Every
   *  per-unit figure derived from it is then null too, rather than a wrong
   *  number — the ₹ P&L still holds, since entryNet/currentNet are already ₹. */
  lotSize: number | null;
  expiry: string;
  /** Net premium paid (negative) or received (positive) at entry, in ₹. */
  entryNet: number;
  /** Current net value of the position, in ₹. */
  currentNet: number;
  /** Loss the user agreed to accept at entry, as a negative percentage. */
  planExitPct: number | null;
  /** Premium lost per day at the current rate, in ₹. */
  thetaPerDay: number | null;
}

/** GET /api/market/fno/ideas */
export interface FnoIdeasResponse {
  ideas: FnoTradeIdea[];
  /** ₹ the user can deploy, from broker margin when connected. */
  deployableCapital: number | null;
}

/** GET /api/market/fno/positions */
export interface FnoPositionsResponse {
  positions: FnoPosition[];
  /** Trades placed today and what they have cost in charges so far. */
  tradesToday: number;
  chargesToday: number;
  /** Trades opened within an hour of closing a loser — the revenge-trade tell. */
  reentriesAfterLoss: number;
}

/**
 * Options track record. Deliberately not the equity shape: the questions that
 * decide whether an options record is any good are which side of premium made
 * the money, how much of it went to charges, and how often long premium simply
 * expired worthless — none of which an equity report has a field for.
 */
/** Trailing window the record covers. */
export type FnoRecordWindow = '30d' | '6m' | 'all';

export interface FnoTrackRecord {
  realizedPnl: number;
  wonPct: number | null;
  closedCount: number;
  winCount: number;
  avgWin: number | null;
  avgLoss: number | null;
  /**
   * Split by which side of premium the position was on, and what charges took.
   * Null while the backend does not derive them — zero would be a real flat
   * book, and rendering ₹0 states a verdict the data cannot support.
   */
  buyingPnl: number | null;
  sellingPnl: number | null;
  buyingCount: number | null;
  sellingCount: number | null;
  chargesPaid: number | null;
  /** Long-premium positions that went to expiry at zero. */
  expiredWorthless: number;
  /** Mean days held against mean days-to-expiry at entry. */
  avgHoldDays: number | null;
  avgDteAtEntry: number | null;
  updatedAt: string | null;
  window: FnoRecordWindow;
}

// The live option-chain wire shapes. Declared here rather than in
// usePremiumStream because fourteen modules read them and only one produces
// them — a util that computes max pain should not import a React hook.
export interface PremiumDataPoint {
  time: number;
  ceLtp: number;
  peLtp: number;
  atmStrike: number;
  currentPrice: number;
}

export interface OptionChainRow {
  strike: number;
  ceLtp: number | null;
  peLtp: number | null;
  isAtm: boolean;
  // Open interest and implied volatility per side. The stream sends these for
  // every strike; the OI and ATM analysis panels read them straight off here.
  ceOi: number | null;
  peOi: number | null;
  cePrevOi: number | null;
  pePrevOi: number | null;
  ceIv: number | null;
  peIv: number | null;
  // Previous session's close per side, when the feed carries one. It is what the
  // premium's day change is measured against; null leaves the chain's change
  // readout blank rather than inventing a reference.
  cePrevClose: number | null;
  pePrevClose: number | null;
  // Per-side delta (option greek) and session traded volume. Surfaced for the
  // full option-chain table; the OI/ATM panels ignore them.
  ceDelta: number | null;
  peDelta: number | null;
  // Exchange greeks; null is the signal to fall back to the Black-Scholes model.
  ceGamma: number | null;
  peGamma: number | null;
  ceTheta: number | null;
  peTheta: number | null;
  ceVolume: number | null;
  peVolume: number | null;
  ceStockName: string | null;
  peStockName: string | null;
  ceBuyQty: number | null;
  peBuyQty: number | null;
  ceSellQty: number | null;
  peSellQty: number | null;
  ceDayHighOi: number | null;
  peDayHighOi: number | null;
  ceDayLowOi: number | null;
  peDayLowOi: number | null;
  ceBestBid: number | null;
  peBestBid: number | null;
  ceBestAsk: number | null;
  peBestAsk: number | null;
  ceSpreadBps: number | null;
  peSpreadBps: number | null;
}

export interface OptionEntry {
  strike: number;
  /**
   * Null when the feed carries no price for this leg — never 0. An unpriced contract must stay
   * distinguishable from one trading at zero; coercing to 0 rendered a confident premium for
   * contracts the chain has no quote for (drift resolved 2026-09-13: the web typed this `number`).
   */
  ltp: number | null;
  iv: number;
  delta: number;
  oi: number;
  prev_oi: number;
  volume: number;
  stock_name?: string;
  gamma?: number;
  theta?: number;
  vega?: number;
  /** Prior close for the contract. The REST snapshot carries it; the socket
   *  feed publishes `ltp_change` instead on some underlyings. */
  prev_close?: number;
  /** The day's move in points, which some socket feeds publish in place of
   *  `prev_close`. `prevCloseOf` reconstructs the close from it. */
  ltp_change?: number;
}

export interface ChainData {
  underlying: string;
  expiry: string;
  current_price: number;
  atm_strike: number;
  updated_at: number;
  max_call_oi_strike: number;
  max_put_oi_strike: number;
  ce: OptionEntry[];
  pe: OptionEntry[];
}

/**
 * Last session's option chain, served over REST. The premium socket sends an
 * empty snapshot outside market hours, so this is what makes a chain readable
 * on a weekend or holiday instead of an empty table.
 */
export interface FnoChainFallbackLeg {
  /** The chain's own join key, "23450_PE". No other endpoint accepts it. */
  symbol: string;
  /** The exchange ticker, "NIFTY2692223450PE": what candle and depth requests
   *  key on. Absent when the server built the ladder from stored bars, which
   *  carry no ticker. */
  exchange_symbol?: string;
  /** An untraded contract quotes 0, never null. Keep the two apart downstream. */
  ltp: number;
  volume: number;
  oi: number;
  prev_oi?: number;
  /** A fraction, not a percent: 0.3283 is a 32.83% IV. The column is stored
   *  this way and no layer rescales it — do not divide by 100. */
  iv?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  /** Previous session's close for this leg, when one is on record. It is what
   *  the row's day change is measured against. */
  prev_close?: number;
  atp?: number;
  buy_qty?: number;
  sell_qty?: number;
  day_high_oi?: number;
  day_low_oi?: number;
  best_bid?: number;
  best_ask?: number;
  spread_bps?: number;
  bid_ask_imbalance?: number;
}

export interface FnoChainFallbackRow {
  strike: number;
  ce: FnoChainFallbackLeg | null;
  pe: FnoChainFallbackLeg | null;
}

export interface FnoChainFallback {
  expiries: string[];
  strikes: number[];
  atmStrike: number;
  spot: number;
  rows: FnoChainFallbackRow[];
  /** Units per lot for this underlying. Null when the exchange lot size is not
   *  known — callers step in single units rather than guess, because a wrong lot
   *  size sizes a real order wrong. */
  lotSize: number | null;
}

/**
 * The two fields a futures caller needs from an underlying, without building the
 * chain. Callers that price contracts from their own quote request (see
 * `TopTradedFuturesSection`) read this instead of `FnoChainFallback`, which costs
 * three extra DB queries and the whole strike ladder they never look at.
 */
export interface FnoExpiries {
  expiries: string[];
  lotSize: number | null;
}
