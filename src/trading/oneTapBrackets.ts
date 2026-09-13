import type {LimitPriceSource, OneTapSettings} from '../types/oneTap.ts';
import type {OrderProduct, OrderSide} from '../types/trade.ts';
import type {ProtectionSupport} from './orderProtection.ts';

/**
 * snake_case because these keys go straight onto the /trading/buy payload (backend-go
 * models/trade.go), which is the wire shape itself.
 *
 * drift resolved 2026-09-13: the web spelled these `stopLossPrice` / `takeProfitPrice` and
 * remapped at the request builder; mobile carried the wire names. One shape, the wire's.
 */
export interface BracketLegs {
  stop_loss_price?: number;
  take_profit_price?: number;
}

const TICK = 0.05;

/**
 * Snapped to the ₹0.05 tick and then re-rounded to paise: 2002 × 0.05 is 100.10000000000001 in
 * binary, and that is what both apps put on the wire (drift resolved 2026-09-13).
 */
const toTick = (price: number) =>
  Math.round(Math.round(price / TICK) * TICK * 100) / 100;

/**
 * Both legs ride the /trading/buy payload, which is the only request carrying them — so they
 * attach to a long entry and to a short entry, which is a buy with transaction_type SELL, but
 * never to closing a long on /trading/sell.
 *
 * A short's legs mirror a long's: the stop sits above entry, the target below.
 *
 * Trailing mode produces no legs at all — the stop it wants moves with the price, and a
 * broker-side leg is fixed at the value it was placed with, so the trailing watcher owns the
 * exit instead.
 *
 * `support` is required rather than optional because the settings surface only warns about an
 * unsupported combination and leaves the toggles live: without the check here a leg the broker
 * cannot hold reaches the wire and the rejection takes the entry down with it.
 */
export function bracketLegsForEntry(
  entry: number,
  settings: OneTapSettings,
  support: ProtectionSupport,
  isShort = false,
): BracketLegs {
  if (!Number.isFinite(entry) || entry <= 0) return {};
  if (!support.supported) return {};

  const {bracketUnit, slPct, tpPct, slEnabled, tpEnabled, slMode} = settings;
  if (slMode !== 'auto') return {};

  const offset = (value: number) =>
    bracketUnit === 'pct' ? (entry * value) / 100 : value;
  const away = (value: number) =>
    toTick(isShort ? entry + value : entry - value);
  const toward = (value: number) =>
    toTick(isShort ? entry - value : entry + value);
  const beatsEntry = (price: number) =>
    isShort ? price < entry : price > entry;
  const legs: BracketLegs = {};

  if (slEnabled && slPct > 0) {
    const stop = away(offset(slPct));
    if (stop > 0) legs.stop_loss_price = stop;
  }

  if (tpEnabled && tpPct > 0) {
    const target = toward(offset(tpPct));
    if (target > 0 && beatsEntry(target)) legs.take_profit_price = target;
  }

  return legs;
}

/**
 * The one flat product enum the wire takes, picked from the per-class settings. Class is read
 * off the symbol because a contract cannot be delivered (no CNC) and equity cannot be carried
 * as NRML.
 */
export function oneTapProductFor(
  settings: OneTapSettings,
  symbol: string | undefined,
  isDerivative: boolean,
): OrderProduct {
  if (!isDerivative) return settings.product.equity;
  // Deliberately looser than isFuturesSymbol, which demands a full <UNDERLYING><YY><MON>FUT:
  // any FUT dialect must route to the futures product, and every other derivative here is an
  // option.
  return (symbol ?? '').toUpperCase().endsWith('FUT')
    ? settings.product.futures
    : settings.product.options;
}

/**
 * Ratchets the stop toward profit and never gives ground when the price moves back: a long
 * trails trailPts under the high-water price, a short trails trailPts over the low-water price.
 *
 * The first stop sits one trail away from entry, on the losing side of it. Seeding it at entry
 * instead would exit on the first tick that rounds the wrong way, before the trail has engaged
 * at all.
 */
export function nextTrailingStop(
  currentStop: number | null,
  ltp: number,
  trailPts: number,
  entry: number,
  isShort = false,
): number | null {
  if (!Number.isFinite(ltp) || ltp <= 0) return currentStop;
  if (!Number.isFinite(trailPts) || trailPts <= 0) return currentStop;

  const candidate = toTick(isShort ? ltp + trailPts : ltp - trailPts);
  if (candidate <= 0) return currentStop;

  const tighten = (a: number, b: number) =>
    isShort ? Math.min(a, b) : Math.max(a, b);

  if (currentStop == null) {
    const seed = Number.isFinite(entry)
      ? toTick(isShort ? entry + trailPts : entry - trailPts)
      : candidate;
    return tighten(seed > 0 ? seed : candidate, candidate);
  }

  return tighten(currentStop, candidate);
}

export interface BookTop {
  bid?: number;
  ask?: number;
}

const isPrice = (v: number | undefined): v is number =>
  v !== undefined && Number.isFinite(v) && v > 0;

/**
 * Null when the source has no book behind it, so callers fall back to LTP rather than pricing
 * off a missing quote.
 */
export function limitPriceFor(
  source: LimitPriceSource,
  side: OrderSide,
  ltp: number,
  book?: BookTop,
): number | null {
  if (source === 'ltp') return isPrice(ltp) ? toTick(ltp) : null;

  if (source === 'bbo') {
    const cross = side === 'BUY' ? book?.ask : book?.bid;
    return isPrice(cross) ? toTick(cross) : null;
  }

  const bid = book?.bid;
  const ask = book?.ask;
  if (!isPrice(bid) || !isPrice(ask)) return null;
  return toTick((bid + ask) / 2);
}

export function exceedsCeiling(
  qty: number,
  ltp: number,
  maxOrderValue: number,
): boolean {
  if (maxOrderValue <= 0) return false;
  if (!Number.isFinite(qty) || !Number.isFinite(ltp)) return false;
  return qty * ltp > maxOrderValue;
}
