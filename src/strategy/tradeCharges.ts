import {istDateOf, marketDateString} from '../market/marketHours.ts';
import {calculateBrokerage} from '../trading/brokerageCalculator.ts';
import type {BrokerageSegment} from '../trading/brokerageCalculator.ts';
import type {BrokerOptions} from '../types/broker.ts';
import type {RoundTrip} from './roundTrips.ts';

export interface ChargeSummary {
  /** What each closed trade cost to place and close, by trade id. */
  byTrip: ReadonlyMap<string, number>;
  total: number;
  brokerage: number;
  taxes: number;
}

type ClosedTrip = RoundTrip & {exitMs: number; exitPrice: number};

const isClosed = (trip: RoundTrip): trip is ClosedTrip =>
  trip.exitPrice != null && trip.exitMs != null;

/** The IST day an exit falls on, which is the day its DP fee is billed against. */
const dpDay = (ms: number): string => marketDateString(istDateOf(ms));

/**
 * Brokerage, STT, exchange fees, GST and stamp duty on every closed trade, from the same calculator
 * the brokerage totals use. A short is priced as sell first, buy back after. DP is billed once per
 * scrip a day, as `computeBrokerageTotals` bills it, so the per-trade figures add up to the same
 * total. Open trades are left out. As web's journal and backtest tray charge round trips (frontend
 * `utils/strategy/tradeCharges.ts`).
 */
export function chargesForTrips(
  trips: readonly RoundTrip[],
  segment: BrokerageSegment,
  broker: BrokerOptions,
): ChargeSummary {
  const byTrip = new Map<string, number>();
  const dpBilled = new Set<string>();
  let total = 0;
  let brokerage = 0;
  // Charged in exit order, so the first exit of a scrip-day is the one that carries its DP fee.
  const closed = trips.filter(isClosed).sort((a, b) => a.exitMs - b.exitMs);
  for (const trip of closed) {
    const exit = trip.exitPrice;
    const buy = trip.side === 'long' ? trip.entryPrice : exit;
    const sell = trip.side === 'long' ? exit : trip.entryPrice;
    const c = calculateBrokerage(buy, sell, trip.qty, segment, broker);
    let dp = c.dpCharges;
    if (dp > 0) {
      const key = `${trip.symbol}|${dpDay(trip.exitMs)}`;
      if (dpBilled.has(key)) dp = 0;
      else dpBilled.add(key);
    }
    const cost = c.totalCharges - c.dpCharges + dp;
    byTrip.set(trip.id, cost);
    total += cost;
    brokerage += c.brokerage;
  }
  return {byTrip, total, brokerage, taxes: total - brokerage};
}

/** The same trips with the charges taken out of each result, so every figure derived from them is net. */
export function netOfCharges(
  trips: readonly RoundTrip[],
  byTrip: ReadonlyMap<string, number>,
): RoundTrip[] {
  return trips.map(t =>
    t.pnl == null ? t : {...t, pnl: t.pnl - (byTrip.get(t.id) ?? 0)},
  );
}
