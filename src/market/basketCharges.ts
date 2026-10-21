import {calculateBrokerage} from '../trading/brokerageCalculator.ts';
import {
  addCharges,
  type ChargeTotals,
  NO_CHARGES,
} from '../trading/orderCharges.ts';
import type {BrokerOptions} from '../types/broker.ts';
import type {EsfBacktestDetail} from '../types/esf.ts';
import {picksByReview, yearsBetween} from './basketBacktest.ts';

export interface BasketCharges {
  firstBuy: number;
  perReview: number;
  perYear: number;
  ordersPerYear: number;
  tradedPerYear: number;
  yearly: ChargeTotals;
}

const scaleCharges = (totals: ChargeTotals, factor: number): ChargeTotals =>
  Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, value * factor]),
  ) as unknown as ChargeTotals;

/**
 * What trading a basket costs at a capital, from the backtest's own trades. Replays them the way a
 * subscription trades: stocks that leave are sold, stocks that stay are left alone, and the freed
 * cash is split equally over the open places. As the web works it out (frontend dev 2226a1e1,
 * `utils/market/basketCharges.ts`).
 */
export function basketCharges(
  detail: EsfBacktestDetail,
  capital: number,
  size: number,
  broker: BrokerOptions,
): BasketCharges | null {
  if (detail.months.length === 0) return null;
  const reviewPicks = picksByReview(detail.picks);
  const holdings = new Map<string, number>();
  let cash = capital;
  let orders = 0;
  let traded = 0;
  let totals = NO_CHARGES;
  const perReview: number[] = [];

  const trade = (buyValue: number, sellValue: number) => {
    const charges = calculateBrokerage(
      buyValue,
      sellValue,
      1,
      'delivery',
      broker,
    );
    totals = addCharges(totals, charges);
    traded += buyValue + sellValue;
    orders += 1;
    return charges.totalCharges;
  };

  for (const review of detail.months) {
    const picks = reviewPicks.get(review.as_of) ?? [];
    const keep = new Set(picks.map(p => p.symbol));
    let charges = 0;
    for (const [symbol, value] of holdings) {
      if (keep.has(symbol)) continue;
      const fee = trade(0, value);
      cash += value - fee;
      charges += fee;
      holdings.delete(symbol);
    }
    const buys = picks.filter(p => !holdings.has(p.symbol));
    const slice = cash / Math.max(buys.length, size - holdings.size);
    for (const p of buys) {
      const fee = trade(slice, 0);
      holdings.set(p.symbol, slice - fee);
      cash -= slice;
      charges += fee;
    }
    for (const p of picks) {
      if (p.fwd_return != null) {
        holdings.set(
          p.symbol,
          (holdings.get(p.symbol) ?? 0) * (1 + p.fwd_return),
        );
      }
    }
    perReview.push(charges);
  }

  const later = perReview.slice(1);
  const years = yearsBetween(detail.run.window_start, detail.run.window_end);
  const perYearFactor = years > 0 ? 1 / years : 1;
  return {
    firstBuy: perReview[0] ?? 0,
    perReview: later.length
      ? later.reduce((sum, c) => sum + c, 0) / later.length
      : 0,
    perYear: totals.totalCharges * perYearFactor,
    ordersPerYear: orders * perYearFactor,
    tradedPerYear: traded * perYearFactor,
    yearly: scaleCharges(totals, perYearFactor),
  };
}
