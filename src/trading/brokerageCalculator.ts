import type {BrokerOptions} from '../types/broker.ts';
import type {BrokerageBreakdown} from '../types/trade.ts';

export type BrokerageSegment = 'intraday' | 'delivery' | 'futures' | 'options';

/**
 * Drops sub-paisa fractions the way a contract note does. The nudge before the floor absorbs
 * binary float error only: 10,000 × 0.015% is 1.4999999999999998 in IEEE-754 and the schedule
 * says ₹1.50, not ₹1.49 (drift resolved 2026-09-13 — both apps floored the raw product).
 */
const truncate = (x: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.floor(x * factor + 1e-9) / factor;
};

/**
 * Statutory + exchange rates, which are set by SEBI/the exchange/the Finance Act and are
 * therefore the SAME for every broker — only `brokerage` and `dpBase` below genuinely differ by
 * broker. Keeping these in one table is not tidiness: they used to be copy-pasted into each
 * broker's `case`, and the copies drifted, so IPFT sat at three different wrong values across
 * the four branches.
 *
 * NSE rates effective 2026-03-01 (circular 27-Feb-2026): the Trading Member IPFT contribution
 * was rolled back to ₹0.01/crore and transaction charges were raised by an exactly offsetting
 * amount, for no change in overall outflow. Quoting both separately means the transaction rate
 * here is NET of IPFT, which is why it is not the 0.00307% headline figure brokers publish —
 * that one has IPFT baked in.
 *
 * F&O STT rates are the Budget 2026-27 ones, effective 2026-04-01.
 */
const RATES = {
  /** NSE transaction charge, net of the IPFT quoted separately below. */
  exchange: {
    equity: 0.0030699 / 100,
    futures: 0.0018299 / 100,
    /** Options transaction charges are levied on premium, not notional. */
    options: 0.0355299 / 100,
  },
  /** SEBI turnover fee — ₹10 per crore, all segments. */
  sebi: 0.0001 / 100,
  /** NSE Investor Protection Fund Trust — ₹0.01 per crore since 2026-03-01. */
  ipft: 0.0000001 / 100,
  stt: {
    /** Delivery STT is 0.1% on BOTH sides, i.e. 0.1% of round-trip turnover. */
    delivery: 0.1 / 100,
    /** Every other segment charges STT on the sell side only. */
    intradaySell: 0.025 / 100,
    futuresSell: 0.05 / 100,
    optionsSell: 0.15 / 100,
  },
  /** Stamp duty is buy-side only in every segment. */
  stamp: {
    delivery: 0.015 / 100,
    intraday: 0.003 / 100,
    futures: 0.002 / 100,
    options: 0.003 / 100,
  },
  gst: 0.18,
} as const;

/** ₹20-or-a-percentage-whichever-is-lower, the shape every broker here uses. */
const cappedPct = (value: number, pct: number, cap = 20) =>
  value <= 0 ? 0 : Math.min(cap, (value * pct) / 100);

interface BrokerProfile {
  /** Charged per executed order, so a completed round trip pays it twice. */
  brokerage: (value: number, isIntraday: boolean) => number;
  /** Levied once per scrip per day on a delivery sell. Excludes GST. */
  dpBase: number;
}

/**
 * Per-broker equity brokerage and DP fee — the only two things a broker actually sets.
 * `dpBase` is the fee as the broker QUOTES it, EXCLUDING GST, so the breakdown can normalise
 * them: Zerodha publishes a GST-inclusive ₹15.34 while Groww and Upstox publish ₹20 with GST
 * added on top. Without normalising, the "DP charges" row silently means a different thing per
 * broker and the four brokers stop being comparable side by side.
 *
 * Rates verified against each broker's own pricing page (2026-08).
 *
 * drift resolved 2026-09-13: the two apps carried identical rates and formulas but keyed this
 * table on two spellings of Dhan's id — mobile `"dhan"` (its screener `BrokerKey`), web
 * `"dhann"` (`BrokerOptions`) — each bridging the other spelling at its call sites. A key that
 * missed the table fell through `?? BROKERS.zerodha` and billed a Dhan delivery sell Zerodha's
 * ₹15.34 DP instead of Dhan's ₹14.75 (₹12.50 + 18% GST), ₹0.59 too much on every such trade.
 * Core keys on `BrokerOptions` alone (`"dhann"`), so there is nothing left to bridge and the
 * fallback only guards an out-of-band string.
 */
const BROKERS: Readonly<Record<BrokerOptions, BrokerProfile>> = {
  // Free delivery; intraday ₹20 or 0.03% whichever is lower.
  zerodha: {
    brokerage: (v, intraday) => (intraday ? cappedPct(v, 0.03) : 0),
    dpBase: 13,
  },
  // Same structure as Zerodha, cheaper DP.
  dhann: {
    brokerage: (v, intraday) => (intraday ? cappedPct(v, 0.03) : 0),
    dpBase: 12.5,
  },
  // ₹20 or 0.1% whichever lower, floored at ₹5 — and unlike Zerodha/Dhan, delivery is NOT free
  // here, so both segments charge the same way.
  groww: {
    brokerage: v => (v <= 0 ? 0 : Math.max(5, cappedPct(v, 0.1))),
    dpBase: 20,
  },
  // Flat ₹20 per executed order on delivery; ₹20 or 0.1% whichever lower intraday.
  upstox: {
    brokerage: (v, intraday) =>
      v <= 0 ? 0 : intraday ? cappedPct(v, 0.1) : 20,
    dpBase: 20,
  },
};

export const calculateBrokerage = (
  buyPrice: number,
  sellPrice: number,
  quantity: number,
  segment: BrokerageSegment,
  broker: BrokerOptions,
): BrokerageBreakdown => {
  const buyValue = buyPrice * quantity;
  const sellValue = sellPrice * quantity;
  const turnover = buyValue + sellValue;
  const grossPnl = sellValue - buyValue;

  if (segment === 'options' || segment === 'futures') {
    return fnoBrokerage(
      buyValue,
      sellValue,
      turnover,
      grossPnl,
      segment === 'options',
    );
  }

  const isIntraday = segment === 'intraday';
  const isDelivery = segment === 'delivery';
  // An unknown key would otherwise fall through to a branch that ignored the segment entirely
  // and billed a delivery trade at intraday STT.
  const profile = BROKERS[broker] ?? BROKERS.zerodha;

  const brokerage =
    profile.brokerage(buyValue, isIntraday) +
    profile.brokerage(sellValue, isIntraday);

  const exchangeCharges = truncate(turnover * RATES.exchange.equity);
  const sebiCharges = truncate(turnover * RATES.sebi);
  const ipft = truncate(turnover * RATES.ipft);

  const stt = isIntraday
    ? truncate(sellValue * RATES.stt.intradaySell)
    : truncate(turnover * RATES.stt.delivery);

  const stampDuty = truncate(
    buyValue * (isIntraday ? RATES.stamp.intraday : RATES.stamp.delivery),
  );

  // DP is a demat-debit fee: it only applies when shares actually leave the demat account, i.e.
  // on a delivery sell. Intraday never pays it. Quoted here GST-inclusive for every broker so
  // the row compares like for like.
  const dpCharges =
    isDelivery && sellValue > 0
      ? truncate(profile.dpBase * (1 + RATES.gst))
      : 0;

  // GST applies to the broker's own fees and the exchange/SEBI/IPFT levies, but never to STT or
  // stamp duty. DP is excluded because dpCharges above already carries its own GST.
  const gst = truncate(
    (brokerage + exchangeCharges + sebiCharges + ipft) * RATES.gst,
  );

  const totalCharges =
    brokerage +
    stt +
    exchangeCharges +
    sebiCharges +
    gst +
    stampDuty +
    dpCharges +
    ipft;

  return {
    brokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    gst,
    stampDuty,
    dpCharges,
    ipft,
    totalCharges,
    grossPnl,
    netPnl: grossPnl - totalCharges,
  };
};

/**
 * F&O charges, broker-agnostic — every broker on this app's list runs the same
 * flat-₹20-per-order model in this segment, unlike equity where brokerage genuinely differs by
 * broker. STT is sell-side only (a leg is charged once, on the sale that closes or writes it),
 * not on round-trip turnover the way equity delivery STT is; options and futures also carry
 * different exchange/stamp rates from equity and from each other, and options levies apply to
 * premium rather than notional value.
 */
function fnoBrokerage(
  buyValue: number,
  sellValue: number,
  turnover: number,
  grossPnl: number,
  isOptions: boolean,
): BrokerageBreakdown {
  const brokerage = (buyValue > 0 ? 20 : 0) + (sellValue > 0 ? 20 : 0);

  const stt = truncate(
    sellValue * (isOptions ? RATES.stt.optionsSell : RATES.stt.futuresSell),
  );
  const exchangeCharges = truncate(
    turnover * (isOptions ? RATES.exchange.options : RATES.exchange.futures),
  );
  const sebiCharges = truncate(turnover * RATES.sebi);
  const ipft = truncate(turnover * RATES.ipft);
  const stampDuty = truncate(
    buyValue * (isOptions ? RATES.stamp.options : RATES.stamp.futures),
  );

  const gst = truncate(
    (brokerage + exchangeCharges + sebiCharges + ipft) * RATES.gst,
  );

  const totalCharges =
    brokerage + stt + exchangeCharges + sebiCharges + gst + stampDuty + ipft;

  return {
    brokerage,
    stt,
    exchangeCharges,
    sebiCharges,
    gst,
    stampDuty,
    // Derivatives are cash-settled contracts, never a demat debit.
    dpCharges: 0,
    ipft,
    totalCharges,
    grossPnl,
    netPnl: grossPnl - totalCharges,
  };
}
