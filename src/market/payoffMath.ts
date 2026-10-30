import type {OptionLeg} from '../types/fno.ts';

// The exact expiry payoff of a set of legs, apart from optionStructures (which re-exports it) so the
// basket analytics read it without that module's formatting and calendar imports.

/** Payoff of one leg at an expiry spot, in ₹ (premium already netted). */
export function legPayoff(
  leg: OptionLeg,
  spotAtExpiry: number,
  lotSize: number,
): number {
  const qty = leg.lots * lotSize;
  const sign = leg.action === 'buy' ? 1 : -1;
  // A future has no premium, so `premium` carries its entry price instead of a
  // per-unit cost, which keeps one leg shape across both kinds.
  if (leg.right === 'FUT') return sign * (spotAtExpiry - leg.premium) * qty;
  const intrinsic =
    leg.right === 'CE'
      ? Math.max(spotAtExpiry - leg.strike, 0)
      : Math.max(leg.strike - spotAtExpiry, 0);
  return sign * (intrinsic - leg.premium) * qty;
}

export function payoffAt(
  legs: OptionLeg[],
  spotAtExpiry: number,
  lotSize: number,
): number {
  return legs.reduce(
    (sum, leg) => sum + legPayoff(leg, spotAtExpiry, lotSize),
    0,
  );
}
