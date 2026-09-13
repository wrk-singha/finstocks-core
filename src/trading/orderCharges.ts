import {BROKER_NAMES, DEFAULT_BROKER} from '../data/brokers.ts';
import {formatCurrency, formatNumber} from '../format/index.ts';
import type {BrokerOptions} from '../types/broker.ts';
import type {OrderSide} from '../types/trade.ts';
import {resolveBrokerageSegment} from './brokerage.ts';
import {calculateBrokerage} from './brokerageCalculator.ts';
import type {BrokerageSegment} from './brokerageCalculator.ts';

/** One leg of the order being priced. Single-leg pads pass an array of one. */
export interface OrderChargeLeg {
  side: OrderSide;
  qty: number;
  price: number;
}

export interface ChargeLine {
  label: string;
  value: number;
}

export interface ChargeGroup {
  title: string;
  lines: ChargeLine[];
}

export interface OrderChargesEstimate {
  /** "₹339.65 × 12 qty" for a single leg, "3 legs" for a basket. */
  tradeValueDetail: string;
  /** Net debit of the legs before charges. Negative on a net-credit structure. */
  tradeValue: number;
  totalCharges: number;
  /** Trade value plus charges — what a buy actually takes out of the account. */
  netDebit: number;
  /** Trade value minus charges — what a sell actually leaves behind. */
  netCredit: number;
  groups: ChargeGroup[];
}

/**
 * What an order costs on top of itself, itemised the way a contract note is.
 *
 * Built on the same `calculateBrokerage` the backtest P&L uses, called one leg at a time: the
 * round-trip form charges both a buy and a sell, and an order pad is only ever placing one of
 * them. Everything here is an estimate at the broker's published rates — the broker's own
 * contract note is the real number, which is why every surface that shows this says so.
 *
 * Nothing connected still has to price the order, and Zerodha's published rates are the ones
 * the rest of the app quotes against, so a null broker prices at DEFAULT_BROKER.
 *
 * drift resolved 2026-09-13: the two copies differed only in the Dhan key bridge (see
 * brokerageCalculator.ts) and in which app-local formatCurrency they called; both rendered
 * "₹339.65", as core's does.
 */
export function estimateOrderCharges(
  legs: OrderChargeLeg[],
  segment: BrokerageSegment,
  broker: BrokerOptions | null,
): OrderChargesEstimate | null {
  const priced = legs.filter(leg => leg.qty > 0 && leg.price > 0);
  if (priced.length === 0) return null;

  const key = broker ?? DEFAULT_BROKER;

  let buyValue = 0;
  let sellValue = 0;
  const totals = {
    brokerage: 0,
    exchangeCharges: 0,
    stampDuty: 0,
    sebiCharges: 0,
    ipft: 0,
    gst: 0,
    stt: 0,
    dpCharges: 0,
    totalCharges: 0,
  };

  for (const leg of priced) {
    const isBuy = leg.side === 'BUY';
    if (isBuy) buyValue += leg.price * leg.qty;
    else sellValue += leg.price * leg.qty;

    const charges = calculateBrokerage(
      isBuy ? leg.price : 0,
      isBuy ? 0 : leg.price,
      leg.qty,
      segment,
      key,
    );
    totals.brokerage += charges.brokerage;
    totals.exchangeCharges += charges.exchangeCharges;
    totals.stampDuty += charges.stampDuty;
    totals.sebiCharges += charges.sebiCharges;
    totals.ipft += charges.ipft;
    totals.gst += charges.gst;
    totals.stt += charges.stt;
    totals.dpCharges += charges.dpCharges;
    totals.totalCharges += charges.totalCharges;
  }

  const external: ChargeLine[] = [
    {label: 'Exchange transaction charges', value: totals.exchangeCharges},
    {label: 'Stamp duty', value: totals.stampDuty},
    {label: 'SEBI turnover charges', value: totals.sebiCharges},
    {label: 'IPFT', value: totals.ipft},
  ];
  // Only the delivery sell that actually debits shares carries one, so a ₹0 row on every other
  // order would be four words of noise.
  if (totals.dpCharges > 0) {
    external.push({label: 'DP charges', value: totals.dpCharges});
  }

  const single = priced.length === 1 ? priced[0] : undefined;

  return {
    tradeValueDetail: single
      ? `${formatCurrency(single.price)} × ${formatNumber(single.qty)} qty`
      : `${priced.length} legs`,
    tradeValue: buyValue - sellValue,
    totalCharges: totals.totalCharges,
    netDebit: buyValue - sellValue + totals.totalCharges,
    netCredit: sellValue - buyValue - totals.totalCharges,
    groups: [
      {
        title: `${BROKER_NAMES[key]} charges`,
        lines: [{label: 'Brokerage', value: totals.brokerage}],
      },
      {title: 'External charges', lines: external},
      {
        title: 'Taxes',
        lines: [
          {label: 'GST', value: totals.gst},
          {label: 'Securities Transaction Tax', value: totals.stt},
        ],
      },
    ],
  };
}

export function chargeSegmentFor(
  symbol: string,
  isFno: boolean,
  isIntraday: boolean,
): BrokerageSegment {
  return resolveBrokerageSegment({
    symbol,
    is_fno: isFno,
    is_intraday: isIntraday,
  });
}
