import type {BrokerOptions} from '../types/broker.ts';
import type {OrderProduct, SettlementMode} from '../types/trade.ts';

/**
 * Whether a buy can carry a target and a stop loss, per broker.
 *
 * There is no common "bracket order" across the four brokers we support, and the differences
 * are not cosmetic — they decide whether the exits can exist at all for a given product:
 *
 * - Zerodha withdrew Bracket Orders in 2020 and Kite Connect never got them back. What is left
 *   is a two-leg (OCO) GTT, and a GTT is a delivery instrument — it outlives the session, which
 *   an MIS position does not. So: delivery only, and placed *after* the entry fills.
 * - Groww's OCO smart order is the mirror image. It is an exit-only order sized against a net
 *   position, and in the CASH segment it accepts MIS only. So: intraday only, also after the
 *   fill.
 * - Dhan's Super Order carries entry, target and stop-loss legs — and a trailing jump — in one
 *   request, on every product.
 * - Upstox's MULTIPLE-type GTT carries ENTRY, TARGET and STOPLOSS rules in one request, on
 *   intraday and delivery alike.
 *
 * Two brokers can do it in one shot and two cannot; each of the two that cannot supports the
 * product the other refuses. A single "attach SL" toggle that ignored this would silently place
 * a naked buy on half the accounts that pressed it.
 */

export type ProtectionMode = 'atomic' | 'after-fill';

export interface ProtectionSupport {
  supported: boolean;
  /**
   * `atomic` — entry, target and stop reach the broker as one request, so the exits exist the
   * moment the position does.
   * `after-fill` — the exits are a second order placed once the entry fills. Between the two
   * there is a window where the position is unprotected, and the user is entitled to know that
   * before pressing Buy.
   */
  mode: ProtectionMode;
  /** The broker's own name for the mechanism, so a support ticket matches. */
  mechanism: string;
  /** Exits go in as limit orders, so a gap can jump straight past them. */
  limitLegsOnly: boolean;
  /** Broker accepts a trailing stop on the exit leg. Not wired to the API yet. */
  trailing: boolean;
  /** Why this combination cannot carry exits. Empty when supported. */
  reason: string;
}

const unsupported = (reason: string): ProtectionSupport => ({
  supported: false,
  mode: 'atomic',
  mechanism: '',
  limitLegsOnly: false,
  trailing: false,
  reason,
});

const BROKER_SUPPORT: Readonly<
  Record<BrokerOptions, (settlement: SettlementMode) => ProtectionSupport>
> = {
  zerodha: settlement =>
    settlement === 'INTRADAY'
      ? unsupported(
          "Zerodha retired bracket orders, and its GTT can't hold an intraday position. Switch to Delivery to attach exits.",
        )
      : {
          supported: true,
          mode: 'after-fill',
          mechanism: 'two-leg GTT',
          limitLegsOnly: true,
          trailing: false,
          reason: '',
        },

  groww: settlement =>
    settlement === 'DELIVERY'
      ? unsupported(
          "Groww's OCO covers intraday equity only. Switch to Intraday to attach exits.",
        )
      : {
          supported: true,
          mode: 'after-fill',
          mechanism: 'OCO smart order',
          limitLegsOnly: false,
          trailing: false,
          reason: '',
        },

  dhann: () => ({
    supported: true,
    mode: 'atomic',
    mechanism: 'Super Order',
    limitLegsOnly: false,
    trailing: true,
    reason: '',
  }),

  upstox: () => ({
    supported: true,
    mode: 'atomic',
    mechanism: 'multi-leg GTT',
    limitLegsOnly: true,
    trailing: true,
    reason: '',
  }),
};

// Nothing reaches a broker in mock mode, so the exits are simulated and every product can carry
// them. The mechanism stays unnamed so the pad never implies a real GTT is resting somewhere —
// it carries no caveat at all.
const MOCK_SUPPORT: ProtectionSupport = {
  supported: true,
  mode: 'atomic',
  mechanism: 'simulated',
  limitLegsOnly: false,
  trailing: true,
  reason: '',
};

/**
 * The settlement axis the capability table is keyed on, read off the product actually being
 * sent.
 *
 * MIS is the only intraday product on this wire. NRML is not deliverable in the equity sense,
 * but a contract cannot be delivered at all, so for the purpose of "does this outlive the
 * session" it sits with CNC — which is also what decides whether an exit leg can rest against
 * it.
 */
export function settlementForProduct(product: OrderProduct): SettlementMode {
  return product === 'MIS' ? 'INTRADAY' : 'DELIVERY';
}

export function getProtectionSupport(
  broker: BrokerOptions | null,
  settlement: SettlementMode,
  isMock: boolean,
): ProtectionSupport {
  if (isMock) return MOCK_SUPPORT;
  if (!broker) {
    return unsupported('Connect a broker to attach a target or stop loss.');
  }
  return BROKER_SUPPORT[broker](settlement);
}

/** The caveat under the fields, once the exits are actually on. */
export function protectionCaveat(support: ProtectionSupport): string | null {
  if (!support.supported) return null;
  if (support.mechanism === 'simulated') return null;
  if (support.mode === 'after-fill') {
    return `Placed as a ${support.mechanism} once the buy fills — the position is unprotected until it does.`;
  }
  return `Sent with the order as a ${support.mechanism}.`;
}

export interface ProtectionErrors {
  target: string | null;
  stop: string | null;
}

/**
 * A buy's target sits above the entry and its stop below it. Inverted levels are the one input
 * error here that a broker will happily accept and turn into an instant exit at a loss, so they
 * are blocked rather than warned about.
 *
 * With no reference price there is nothing to compare against, and guessing is worse than not
 * checking: both errors come back null.
 */
export function validateProtection(
  entryPrice: number,
  takeProfit: number | null,
  stopLoss: number | null,
): ProtectionErrors {
  const errors: ProtectionErrors = {target: null, stop: null};
  if (entryPrice <= 0) return errors;

  if (takeProfit != null && takeProfit > 0 && takeProfit <= entryPrice) {
    errors.target = 'Target must be above your entry price';
  }
  if (stopLoss != null && stopLoss > 0 && stopLoss >= entryPrice) {
    errors.stop = 'Stop loss must be below your entry price';
  }
  return errors;
}

export interface ProtectionOutcome {
  reward: number | null;
  risk: number | null;
  /** Reward-to-risk, only when both legs are set. */
  ratio: number | null;
}

export function protectionOutcome(
  entryPrice: number,
  qty: number,
  takeProfit: number | null,
  stopLoss: number | null,
): ProtectionOutcome {
  const sizeable = entryPrice > 0 && qty > 0;
  const reward =
    sizeable && takeProfit != null && takeProfit > entryPrice
      ? (takeProfit - entryPrice) * qty
      : null;
  const risk =
    sizeable && stopLoss != null && stopLoss > 0 && stopLoss < entryPrice
      ? (entryPrice - stopLoss) * qty
      : null;

  return {
    reward,
    risk,
    ratio: reward != null && risk != null && risk > 0 ? reward / risk : null,
  };
}

/**
 * The price a ± chip lands on. Two decimals, not a tick-size round: NSE runs ₹0.01 and ₹0.05
 * ticks side by side depending on the scrip's price band, and a client-side guess at which one
 * applies would produce prices the broker rejects on exactly the stocks it guessed wrong about.
 */
export function priceAtPercent(entryPrice: number, pct: number): number {
  return Math.round(entryPrice * (1 + pct / 100) * 100) / 100;
}

/**
 * Seeded when exits are switched on: a 5:2 target-to-stop, which is the 2.5:1 reward-to-risk
 * the summary line reports. A starting posture, not a recommendation.
 */
export const DEFAULT_TARGET_PCT = 5;
export const DEFAULT_STOP_PCT = 2;

export const TARGET_STEPS: readonly number[] = [2, 5, 10];
export const STOP_STEPS: readonly number[] = [1, 2, 5];

/**
 * Which chip, if any, the field is currently sitting on.
 *
 * Derived rather than stored: the chips write a price into the same box the user can type over,
 * so the box is the only truth about the level. Asking it back which percentage it represents
 * keeps the chip, the badge and the value from ever disagreeing — including once the entry
 * price moves and a former 5% price is no longer 5% of anything.
 */
export function pctForPrice(
  entryPrice: number,
  sign: 1 | -1,
  value: string,
  steps: readonly number[],
): number | null {
  const price = parseFloat(value);
  if (!(entryPrice > 0) || !Number.isFinite(price)) return null;
  return (
    steps.find(pct => priceAtPercent(entryPrice, sign * pct) === price) ?? null
  );
}
