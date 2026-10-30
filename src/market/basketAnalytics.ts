import type {OptionLeg} from '../types/fno.ts';
import {blackScholesGreeks, normCdf, RISK_FREE_RATE} from './greeks.ts';
import {payoffAt} from './optionStructures.ts';

// Pricing and risk read-outs for a basket of option legs: the "today" (T+0)
// curve, net greeks, probability of profit and the ±1σ range. Everything is
// Black-76 on the chain's own implied forward and per-strike IV, the model the
// chain's greeks columns use, so the basket does not disagree with the board.
//
// These are model estimates. The expiry payoff (`payoffAt`) is exact; anything
// that depends on IV, time or the distribution is theoretical and is labelled
// so. Web's `basketAnalytics` with the app's `basketInsights` corrections: the
// basis decays to the close, and the chain's quoted greeks are used where given.

export {RISK_FREE_RATE};
const DAYS_PER_YEAR = 365;

/** The chain's own greeks for a leg, as the board shows them; each null where the feed sent none. */
export type QuotedGreeks = {
  readonly delta: number | null;
  readonly gamma: number | null;
  readonly theta: number | null;
};

export type AnalyticLeg = OptionLeg & {
  readonly right: 'CE' | 'PE';
  /** Implied vol as a fraction (0.12 = 12%). Null when the strike has no quote. */
  readonly iv: number | null;
  /** The chain's greeks for the leg; absent, every greek is the model's. */
  readonly quoted?: QuotedGreeks;
};

export type Market = {
  readonly spot: number;
  readonly forward: number;
  /** Years to expiry now. */
  readonly years: number;
};

export type Scenario = {
  /** Calendar days moved forward from now. */
  readonly days: number;
  /** Parallel IV shift, in volatility points. */
  readonly ivShift: number;
};

export const NO_SCENARIO: Scenario = {days: 0, ivShift: 0};

const signOf = (leg: OptionLeg): number => (leg.action === 'buy' ? 1 : -1);

const isIvQuoted = (iv: number | null | undefined): iv is number =>
  iv != null && iv > 0;

/** Black-76 premium of a European option on `forward`. */
export function black76Price(
  forward: number,
  strike: number,
  years: number,
  iv: number,
  right: 'CE' | 'PE',
  rate: number = RISK_FREE_RATE,
): number {
  const intrinsic = Math.max(
    right === 'CE' ? forward - strike : strike - forward,
    0,
  );
  if (!(years > 0) || !(iv > 0) || !(forward > 0)) return intrinsic;
  const sd = iv * Math.sqrt(years);
  const d1 = (Math.log(forward / strike) + 0.5 * sd * sd) / sd;
  const d2 = d1 - sd;
  const disc = Math.exp(-rate * years);
  return right === 'CE'
    ? disc * (forward * normCdf(d1) - strike * normCdf(d2))
    : disc * (strike * normCdf(-d2) - forward * normCdf(-d1));
}

/** Every leg has an IV, so the T+0 curve can be drawn without guessing. */
export const hasModel = (legs: readonly AnalyticLeg[]): boolean =>
  legs.length > 0 && legs.every(leg => isIvQuoted(leg.iv));

/**
 * Position P&L (₹) if the underlying were `spot` after `scenario`. The forward
 * moves with spot at the basis the chain implies, and that basis is carry over
 * the time left: it decays with it, so today's curve is unchanged, and a
 * scenario of the whole time left or more prices each leg at its intrinsic on
 * spot, the expiry payoff. Holding today's basis for any days forward left the
 * scenario at the close off the expiry line by the basis times the net delta
 * (a 60-point basis on a bull call lot of 75: −₹1,875 shown against −₹6,375).
 */
export function pnlAt(
  legs: readonly AnalyticLeg[],
  spot: number,
  lotSize: number,
  market: Market,
  scenario: Scenario = NO_SCENARIO,
): number {
  const years = Math.max(market.years - scenario.days / DAYS_PER_YEAR, 0);
  const carried = market.years > 0 ? years / market.years : 0;
  const forward = spot * Math.pow(market.forward / market.spot, carried);
  return legs.reduce((sum, leg) => {
    const iv = Math.max((leg.iv ?? 0) + scenario.ivShift / 100, 0.0001);
    const value = black76Price(forward, leg.strike, years, iv, leg.right);
    return sum + signOf(leg) * (value - leg.premium) * leg.lots * lotSize;
  }, 0);
}

/** Whether a net greek is the chain's own on every leg, the model's on every leg, or some of each. */
export type GreekSource = 'feed' | 'model' | 'mixed';

export type NetGreeks = {
  /** Underlying-equivalent units (a long ATM call lot of 75 ≈ +37). */
  readonly delta: number;
  /** Change in delta per 1-point move. */
  readonly gamma: number;
  /** ₹ per calendar day. */
  readonly theta: number;
  /** ₹ per 1 volatility point. The feed quotes no vega, so it is always the model's. */
  readonly vega: number;
  readonly sources: {
    readonly delta: GreekSource;
    readonly gamma: GreekSource;
    readonly theta: GreekSource;
  };
};

const sourceOf = (fromFeed: readonly boolean[]): GreekSource =>
  fromFeed.every(Boolean) ? 'feed' : fromFeed.some(Boolean) ? 'mixed' : 'model';

/**
 * The basket's net greeks. Each leg's delta, gamma and theta are the chain's
 * own where it quotes them (`quoted`); Black-76 fills whichever it left blank,
 * and gives every vega. Null unless every leg has an IV: a net figure missing a
 * leg is no net.
 */
export function netGreeks(
  legs: readonly AnalyticLeg[],
  lotSize: number,
  market: Market,
): NetGreeks | null {
  if (!hasModel(legs)) return null;
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;
  for (const leg of legs) {
    const model = blackScholesGreeks(
      market.forward,
      leg.strike,
      market.years,
      leg.iv ?? 0,
      leg.right,
    );
    if (model === null) return null;
    const quantity = signOf(leg) * leg.lots * lotSize;
    delta += (leg.quoted?.delta ?? model.delta) * quantity;
    gamma += (leg.quoted?.gamma ?? model.gamma) * quantity;
    theta += (leg.quoted?.theta ?? model.theta) * quantity;
    vega += model.vega * quantity;
  }
  const quotedOn = (greek: keyof QuotedGreeks) =>
    sourceOf(legs.map(leg => (leg.quoted?.[greek] ?? null) !== null));
  return {
    delta,
    gamma,
    theta,
    vega,
    sources: {
      delta: quotedOn('delta'),
      gamma: quotedOn('gamma'),
      theta: quotedOn('theta'),
    },
  };
}

/**
 * The legs' average IV: the σ the distribution is drawn with. A plain mean of
 * the legs that quote one, not weighted by premium.
 */
export function basketIv(legs: readonly AnalyticLeg[]): number | null {
  const priced = legs.flatMap(leg => (isIvQuoted(leg.iv) ? [leg.iv] : []));
  if (priced.length === 0) return null;
  return priced.reduce((sum, iv) => sum + iv, 0) / priced.length;
}

export type SigmaRange = {readonly lo: number; readonly hi: number};

/** ±1σ underlying range at expiry. */
export function oneSigmaRange(market: Market, iv: number): SigmaRange {
  const move = market.forward * iv * Math.sqrt(market.years);
  return {lo: Math.max(market.spot - move, 0), hi: market.spot + move};
}

/**
 * Probability the position finishes in profit at expiry, under a risk-neutral
 * lognormal at the basket's average IV. Integrates the density over every spot
 * level where the expiry payoff is positive, on a grid of z from −5 to 5 in
 * steps of 0.02.
 */
export function probabilityOfProfit(
  legs: readonly AnalyticLeg[],
  lotSize: number,
  market: Market,
  iv: number,
): number {
  const sd = iv * Math.sqrt(market.years);
  if (!(sd > 0)) return 0;
  const list = [...legs];
  const STEP = 0.02;
  let mass = 0;
  let win = 0;
  for (let z = -5; z <= 5; z += STEP) {
    const weight = Math.exp(-0.5 * z * z);
    const level = market.forward * Math.exp(-0.5 * sd * sd + sd * z);
    mass += weight;
    if (payoffAt(list, level, lotSize) > 0) win += weight;
  }
  return mass > 0 ? win / mass : 0;
}

/**
 * More call lots sold than bought: past the highest strike the loss grows
 * without end. Only calls are counted; a short put's loss stops at its strike,
 * so it is never open-ended.
 */
export function hasNakedShort(legs: readonly OptionLeg[]): boolean {
  const lots = (action: OptionLeg['action']) =>
    legs
      .filter(leg => leg.right === 'CE' && leg.action === action)
      .reduce((sum, leg) => sum + leg.lots, 0);
  return lots('sell') > lots('buy');
}

/** Round, human axis ticks across [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 4): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const rough = span / target;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(v);
  return out;
}
