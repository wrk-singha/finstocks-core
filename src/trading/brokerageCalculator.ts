import type {BrokerOptions} from '../types/broker.ts';
import type {BrokerageBreakdown} from '../types/trade.ts';

export type BrokerageSegment = 'intraday' | 'delivery' | 'futures' | 'options';

/**
 * Drops sub-paisa fractions the way a contract note does, for a value that is not a whole number of
 * paise (a basket's fractional slice, GST on a percentage brokerage) and for the DP fee. The nudge
 * before the floor absorbs binary float error: 10,000 × 0.015% is 1.4999999999999998 in IEEE-754
 * and the schedule says ₹1.50, not ₹1.49 (drift resolved 2026-09-13 — both apps floored the raw
 * product). It is float noise only: about nine units in the last place of the value, and never
 * more than 1e-9 paise, so it never lifts a remainder the float can represent, nor a negative
 * fraction of a paisa to 0. Decimal values skip it and are floored exactly (`levy`).
 */
const truncate = (x: number, decimals = 2) => {
  const factor = 10 ** decimals;
  const scaled = x * factor;
  return Math.floor(scaled + Math.min(Math.abs(scaled) * 2e-15, 1e-9)) / factor;
};

/** A rate as an exact fraction, numerator over denominator. */
type Fraction = readonly [bigint, bigint];

/**
 * `value` × `rate`, floored to the paisa. When `value` is a decimal of at most six places — every
 * order's is: a 2-decimal price (or a 3- or 4-decimal average fill) times a whole quantity, and a
 * sum of levies — the levy is worked out in integers and is the exact floor. The float nudge alone
 * could not be: the exchange charge and IPFT are quoted to nine decimals in paise and can leave an
 * exact value a billionth of a paisa (or less) under a whole paisa (₹24,855,207.01 of equity
 * turnover owes ₹763.0299999…, which a nudge lifted to ₹763.03), and on large values the float
 * product can miss a whole paisa by more than any nudge. Any other value (a basket's fractional
 * slice) takes `truncate` on the float rate.
 */
const levy = (value: number, rate: number, [num, den]: Fraction): number => {
  for (let places = 2; places <= 6; places += 1) {
    const scaled = value * 10 ** places;
    const units = Math.round(scaled);
    // Past 1e14 units a float cannot hold the units to better than about a hundredth of one.
    if (!Number.isSafeInteger(units) || Math.abs(units) > 1e14) break;
    // The float product of a decimal price and a quantity is within a few ulps of its units.
    if (Math.abs(scaled - units) > Math.max(Math.abs(units) * 2e-15, 1e-12)) {
      continue;
    }
    // units / 10^places rupees × num / den, in paise: units × num / (den × 10^(places − 2)).
    const divisor = den * 10n ** BigInt(places - 2);
    const product = BigInt(units) * num;
    let floored = product / divisor;
    if (product % divisor !== 0n && product < 0n) floored -= 1n;
    return Number(floored) / 100;
  }
  return truncate(value * rate);
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

/** RATES as exact fractions, for `levy`. */
const EXACT = {
  exchange: {
    equity: [30_699n, 1_000_000_000n],
    futures: [18_299n, 1_000_000_000n],
    options: [355_299n, 1_000_000_000n],
  },
  sebi: [1n, 1_000_000n],
  ipft: [1n, 1_000_000_000n],
  stt: {
    delivery: [1n, 1_000n],
    intradaySell: [25n, 100_000n],
    futuresSell: [5n, 10_000n],
    optionsSell: [15n, 10_000n],
  },
  stamp: {
    delivery: [15n, 100_000n],
    intraday: [3n, 100_000n],
    futures: [2n, 100_000n],
    options: [3n, 100_000n],
  },
  gst: [18n, 100n],
} as const satisfies Record<string, Fraction | Record<string, Fraction>>;

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

  const exchangeCharges = levy(
    turnover,
    RATES.exchange.equity,
    EXACT.exchange.equity,
  );
  const sebiCharges = levy(turnover, RATES.sebi, EXACT.sebi);
  const ipft = levy(turnover, RATES.ipft, EXACT.ipft);

  const stt = isIntraday
    ? levy(sellValue, RATES.stt.intradaySell, EXACT.stt.intradaySell)
    : levy(turnover, RATES.stt.delivery, EXACT.stt.delivery);

  const stampDuty = isIntraday
    ? levy(buyValue, RATES.stamp.intraday, EXACT.stamp.intraday)
    : levy(buyValue, RATES.stamp.delivery, EXACT.stamp.delivery);

  // DP is a demat-debit fee: it only applies when shares actually leave the demat account, i.e.
  // on a delivery sell. Intraday never pays it. Quoted here GST-inclusive for every broker so
  // the row compares like for like.
  const dpCharges =
    isDelivery && sellValue > 0
      ? truncate(profile.dpBase * (1 + RATES.gst))
      : 0;

  // GST applies to the broker's own fees and the exchange/SEBI/IPFT levies, but never to STT or
  // stamp duty. DP is excluded because dpCharges above already carries its own GST.
  const gst = levy(
    brokerage + exchangeCharges + sebiCharges + ipft,
    RATES.gst,
    EXACT.gst,
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

  const stt = isOptions
    ? levy(sellValue, RATES.stt.optionsSell, EXACT.stt.optionsSell)
    : levy(sellValue, RATES.stt.futuresSell, EXACT.stt.futuresSell);
  const exchangeCharges = isOptions
    ? levy(turnover, RATES.exchange.options, EXACT.exchange.options)
    : levy(turnover, RATES.exchange.futures, EXACT.exchange.futures);
  const sebiCharges = levy(turnover, RATES.sebi, EXACT.sebi);
  const ipft = levy(turnover, RATES.ipft, EXACT.ipft);
  const stampDuty = isOptions
    ? levy(buyValue, RATES.stamp.options, EXACT.stamp.options)
    : levy(buyValue, RATES.stamp.futures, EXACT.stamp.futures);

  const gst = levy(
    brokerage + exchangeCharges + sebiCharges + ipft,
    RATES.gst,
    EXACT.gst,
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
