import type {OptionChainRow} from '../types/fno.ts';

// Option greeks for the chain. The F&O stream carries only `iv` and `delta` per
// strike, so gamma/theta/vega/rho are derived here from the same inputs the
// market is already quoting.
//
// The model is Black-76 — Black-Scholes written on the *forward*, not on spot.
// That is the right model for index options, and it matters in practice: an
// index future can trade well off its spot, and pricing a 24,400 strike against
// a 24,366 spot when the chain's own quotes imply a 24,425 forward puts every
// delta ~0.06 out and misplaces the whole gamma/vega curve.
//
// The forward is not assumed — `impliedForward` reads it back out of the chain
// via put-call parity, so the greeks stay consistent with the premiums shown
// beside them. A strike the stream has quoted no IV for returns null and the
// chain renders a dash rather than a number computed off a placeholder.

// Indian risk-free proxy (roughly the 91-day T-bill). Under Black-76 it only
// discounts — it does not set the forward, which the market quotes for us.
const RISK_FREE_RATE = 0.065;

const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// NSE derivatives expire at 15:30 IST = 10:00 UTC on the expiry date.
const EXPIRY_UTC_HOUR = 10;

export interface OptionGreeks {
  delta: number;
  gamma: number;
  /** Per calendar day, in points of premium (negative for a long option). */
  theta: number;
  /** Per 1 volatility point (a move from 12% to 13% IV). */
  vega: number;
  /** Per 1 percentage point of interest rate. */
  rho: number;
}

const normPdf = (x: number): number =>
  Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

// Abramowitz & Stegun 7.1.26 — max absolute error 1.5e-7, well inside the
// precision a four-decimal gamma needs.
const erf = (x: number): number => {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-a * a));
};

/**
 * The standard normal distribution's CDF, to the erf above's 1.5e-7. Exported for the option
 * pricing built beside these greeks (a basket's Black-76 value and its probability of profit), so
 * the price and the greeks read one curve.
 */
export const normCdf = (x: number): number => 0.5 * (1 + erf(x / Math.SQRT2));

/**
 * Fraction of a year until the expiry date's 15:30 IST close. Null once that
 * moment has passed (or the token isn't a date) — an expired contract has no
 * greeks, and a zero √T would divide to Infinity.
 *
 * Local date parts are read rather than UTC ones so both an ISO date-only token
 * ("2026-08-18", parsed as UTC midnight) and a local-midnight token land on the
 * same calendar day for an IST browser.
 */
export function yearsToExpiry(
  expiry: string | undefined,
  now: number = Date.now(),
): number | null {
  if (!expiry) return null;
  const parsed = Date.parse(expiry);
  if (Number.isNaN(parsed)) return null;
  const d = new Date(parsed);
  const close = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    EXPIRY_UTC_HOUR,
  );
  const ms = close - now;
  return ms > 0 ? ms / MS_PER_YEAR : null;
}

/**
 * The forward the chain is actually pricing against, read out of it by put-call
 * parity: C - P = (F - K)·e^-rT, so F = K + (C - P)·e^rT.
 *
 * Taken at the strike whose call and put are closest in price — parity holds at
 * every strike in theory, but the near-the-money pair is the one where both legs
 * are liquid and the bid-ask noise is smallest relative to the premium.
 *
 * Falls back to `spot` when no strike quotes both sides, which is the honest
 * approximation when there is nothing to imply a basis from.
 */
export function impliedForward(
  rows: OptionChainRow[],
  spot: number,
  years: number,
  rate: number = RISK_FREE_RATE,
): number {
  let best: OptionChainRow | null = null;
  let bestGap = Infinity;

  for (const row of rows) {
    if (row.ceLtp == null || row.peLtp == null) continue;
    if (row.ceLtp <= 0 || row.peLtp <= 0) continue;
    const gap = Math.abs(row.ceLtp - row.peLtp);
    if (gap < bestGap) {
      bestGap = gap;
      best = row;
    }
  }

  if (best?.ceLtp == null || best.peLtp == null) return spot;
  const forward =
    best.strike + (best.ceLtp - best.peLtp) * Math.exp(rate * years);
  return forward > 0 ? forward : spot;
}

/**
 * Black-76 greeks for one European option on `forward`. Returns null unless
 * every input is quotable (positive forward, strike, time and IV).
 *
 * `iv` is a fraction (0.083 = 8.3%), matching the stream's own units. Delta is
 * the undiscounted forward delta — the figure brokers display, and the one the
 * stream's own `delta` field is comparable to.
 */
export function blackScholesGreeks(
  forward: number,
  strike: number,
  years: number,
  iv: number,
  right: 'CE' | 'PE',
  rate: number = RISK_FREE_RATE,
): OptionGreeks | null {
  if (!(forward > 0) || !(strike > 0) || !(years > 0) || !(iv > 0)) return null;

  const sqrtT = Math.sqrt(years);
  const d1 =
    (Math.log(forward / strike) + 0.5 * iv * iv * years) / (iv * sqrtT);
  const d2 = d1 - iv * sqrtT;

  const pdf = normPdf(d1);
  const discount = Math.exp(-rate * years);
  const sign = right === 'CE' ? 1 : -1;

  // N(d1)/N(d2) for a call, N(-d1)/N(-d2) for a put — the put formulas are the
  // call's with both arguments reflected.
  const nd1 = normCdf(sign * d1);
  const nd2 = normCdf(sign * d2);

  return {
    delta: sign * nd1,
    gamma: pdf / (forward * iv * sqrtT),
    theta: ((-(forward * pdf * iv) / (2 * sqrtT)) * discount) / 365,
    vega: (forward * pdf * sqrtT * discount) / 100,
    rho: (sign * strike * years * discount * nd2) / 100,
  };
}
