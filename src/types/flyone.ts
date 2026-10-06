/**
 * The option levels engine, as `/market/flyone/*` serves it (backend-go `handlers/flyone`, dev;
 * web `interfaces/flyone.ts`). One row per chain per minute: where price sits against dealer
 * positioning (put wall, gamma flip, call wall, the expected move) and the engine's own call.
 */

export type FlyoneDirection =
  'BULLISH' | 'LEAN_BULLISH' | 'NEUTRAL' | 'LEAN_BEARISH' | 'BEARISH';

export type FlyonePattern =
  | 'BULL_CONFIRM'
  | 'BEAR_CONFIRM'
  | 'BEAR_DIVERGENCE'
  | 'BULL_EXHAUSTION'
  | 'BULL_LEAN'
  | 'BEAR_LEAN'
  | 'UP_UNCONFIRMED'
  | 'DOWN_UNCONFIRMED'
  | 'QUIET'
  | 'INSUFFICIENT_DATA'
  | '';

export type GexRegime =
  'STRONG_POS' | 'POS' | 'NEUTRAL' | 'NEG' | 'STRONG_NEG' | '';

export type ExpiryRank = 'near' | 'next';

/** Where a chain's OI came from: today's bars, the previous session's, a mix, or nowhere. */
export type OiSource = 'today' | 'previous' | 'mixed' | 'none';

export interface FlyoneRow {
  ts: string;
  trade_date: string;
  underlying: string;
  expiry: string;
  expiry_rank: ExpiryRank;
  spot: number | null;
  forward: number | null;
  atm_strike: number | null;
  straddle: number | null;
  sigma_pts: number | null;
  dte_days: number | null;
  step: number | null;
  n_valid_widths: number;
  price_chg_pct: number | null;
  skew: number | null;
  fear: number | null;
  fear_lb: number | null;
  fear_chg: number | null;
  tail_ratio: number | null;
  mode_minus_fwd: number | null;
  straddle_lb: number | null;
  future_price: number | null;
  future_vwap: number | null;
  future_vwap_slope: number | null;
  gamma_flip: number | null;
  call_wall: number | null;
  put_wall: number | null;
  total_gex: number | null;
  ngex: number | null;
  gdi: number | null;
  gex_slope: number | null;
  gex_regime: GexRegime;
  ce_vol: number | null;
  pe_vol: number | null;
  net_vol: number | null;
  ce_oi: number | null;
  pe_oi: number | null;
  net_oi: number | null;
  ce_chg_oi: number | null;
  pe_chg_oi: number | null;
  net_chg_oi: number | null;
  score: number;
  /** "WARMUP" for the first 15 minutes of a session. */
  direction_raw: FlyoneDirection | 'WARMUP' | '';
  direction: FlyoneDirection;
  confidence: number;
  pattern: FlyonePattern;
  agree: string;
  /** "50:+1|100:+1|200:-2" — each wing width's vote. */
  width_scores: string;
  reason: string;
  oi_source: OiSource;
  n_strikes: number;
  engine_hash: string;
  direction_since: string | null;
}

export interface FlyoneSnapshot {
  date: string;
  as_of: string;
  expiry_rank: ExpiryRank;
  interval_sec: number;
  rows: FlyoneRow[];
}

/** The trading days the engine has stored, newest first (at most 60): the sessions a scanner replays. */
export interface FlyoneDates {
  dates: string[];
}

export interface FlyoneScreenFilter {
  field: string;
  op: string;
  value: string;
}

export interface FlyoneScreen {
  date: string;
  as_of: string;
  expiry_rank: ExpiryRank;
  universe: 'all' | 'index' | 'stock';
  filters: FlyoneScreenFilter[];
  count: number;
  rows: FlyoneRow[];
}

export interface FlyoneScreenParams {
  /** "score>0,ngex>0,gex_regime=POS|STRONG_POS" */
  where?: string;
  expiry?: ExpiryRank;
  universe?: 'all' | 'index' | 'stock';
  symbols?: string[];
  sort?: string;
  limit?: number;
  date?: string;
}

/** The chat card's payload: the screen to run plus how the assistant read the question. */
export interface FlyoneScreenCardPayload extends FlyoneScreenParams {
  /** A heading the assistant chose, e.g. "Bullish stocks in the calm regime". */
  title?: string;
  /** How the assistant read the question, e.g. "GX positive read as net GEX above zero". */
  interpretation?: string;
}
