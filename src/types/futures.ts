/**
 * A single futures contract as the detail screen and the F&O tab need it.
 *
 * Deliberately not folded into types/fno.ts: everything there is leg-shaped
 * (right, strike, premium), and a future has none of those. The one field they
 * share is the lot size.
 */
export interface FuturesContract {
  /** Exchange-format symbol, e.g. JINDALSTEL26AUGFUT. */
  symbol: string;
  underlying: string;
  /** ISO expiry when the chain reports one, else null — never inferred. */
  expiry: string | null;
  expiryMonth: string;
  label: string;
  ltp: number | null;
  changeAbs: number | null;
  changePct: number | null;
  /** Null for stock futures until an instrument master supplies the real size. */
  lotSize: number | null;
}

/**
 * One ranked contract, already priced by the server. The endpoint used to
 * return underlying names only, which cost the client a second round-trip to
 * resolve a symbol and a third to price it; it now answers all three, so a
 * grid of these is one request rather than one per tile.
 */
export interface TopTradedContract {
  underlying: string;
  /** Resolved contract, e.g. NIFTY25SEPFUT — never rebuilt client-side. */
  symbol: string;
  volume: number;
  ltp: number;
  /** Null until the contract has a prior session to compare against. */
  prevClose: number | null;
  lotSize: number | null;
}

/** The volume ranking behind the "Top traded futures" grids, one list per
 *  segment, at most four each. */
export interface TopTradedFutures {
  index: TopTradedContract[];
  stock: TopTradedContract[];
  commodity: TopTradedContract[];
}

/** Day statistics for the Performance block. Every field is nullable because
 * each is derived from candles that may not have arrived yet. */
export interface FuturesDayStats {
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  /** Absent for futures until the feed carries contract-level open interest. */
  openInterest: number | null;
}
