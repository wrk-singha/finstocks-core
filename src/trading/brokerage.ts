import type {BrokerOptions} from '../types/broker.ts';
import type {BrokerageBreakdown, Strategy} from '../types/trade.ts';
import {calculateBrokerage} from './brokerageCalculator.ts';
import type {BrokerageSegment} from './brokerageCalculator.ts';
import {isFnOSymbol, TRADABLE_INDICES} from '../market/symbols.ts';

export type {BrokerageSegment} from './brokerageCalculator.ts';

/** Minimal trade shape shared by backtest (ExecutionLogEntry) and live (TradeData) sources. */
export interface BrokerageTrade {
  symbol?: string | null;
  buy_price?: number | null;
  sell_price?: number | null;
  quantity?: number | null;
  buy_time?: string | null;
  sell_time?: string | null;
}

/**
 * Groups a delivery sell into the scrip-day its DP fee is billed against.
 *
 * Sliced off the raw timestamp rather than parsed: these strings are IST digits mislabelled as
 * UTC, so `new Date(...)` would shift a 09:15 trade into the previous day for anyone west of IST
 * and split one scrip-day in two.
 */
const scripDayKey = (symbol: string, time: string) =>
  `${symbol}|${time.slice(0, 10)}`;

/**
 * A trade's price or size as a number. Backtest rows reach here through a loose shape check, so a
 * field can arrive as a numeric string or NaN; read as web reads it (`Number(x || 0)`), a missing,
 * empty or NaN field counts as 0 and a numeric string as its number, rather than one bad row turning
 * every total into NaN.
 */
const amount = (value: unknown): number => (value ? Number(value) : 0);

/**
 * Sum per-trade brokerage charges + gross/net P&L across completed trades.
 *
 * drift resolved 2026-09-13: mobile bridged `BrokerOptions` "dhann" to its screener `BrokerKey`
 * "dhan" before calling the calculator; the web passed the option through. Same figures on both
 * sides — the calculator now takes `BrokerOptions` directly, so the bridge is gone.
 */
export function computeBrokerageTotals(
  trades: BrokerageTrade[],
  broker: BrokerOptions,
  segment: BrokerageSegment,
): BrokerageBreakdown {
  const acc: BrokerageBreakdown = {
    brokerage: 0,
    stt: 0,
    exchangeCharges: 0,
    sebiCharges: 0,
    gst: 0,
    stampDuty: 0,
    dpCharges: 0,
    ipft: 0,
    totalCharges: 0,
    grossPnl: 0,
    netPnl: 0,
  };

  // DP is billed once per scrip per day however many sell orders you place in it, so it cannot
  // be summed per trade the way every other charge is — a 33-trade delivery backtest was being
  // billed 33 DP fees instead of one per scrip-day.
  const billedScripDays = new Set<string>();

  for (const trade of trades) {
    const sellPrice = amount(trade.sell_price);
    if (sellPrice <= 0) continue; // only completed trades contribute
    const buyPrice = amount(trade.buy_price);
    const quantity = amount(trade.quantity);

    const charges = calculateBrokerage(
      buyPrice,
      sellPrice,
      quantity,
      segment,
      broker,
    );
    acc.brokerage += charges.brokerage;
    acc.stt += charges.stt;
    acc.exchangeCharges += charges.exchangeCharges;
    acc.sebiCharges += charges.sebiCharges;
    acc.gst += charges.gst;
    acc.stampDuty += charges.stampDuty;
    acc.ipft += charges.ipft;
    acc.grossPnl += (sellPrice - buyPrice) * quantity;

    let dpCharges = charges.dpCharges;
    if (dpCharges > 0) {
      // No symbol or sell time means the scrip-day can't be identified, so the fee stays
      // per-trade rather than being silently dropped.
      const key =
        trade.symbol && trade.sell_time
          ? scripDayKey(trade.symbol, trade.sell_time)
          : null;
      if (key && billedScripDays.has(key)) dpCharges = 0;
      else if (key) billedScripDays.add(key);
    }
    acc.dpCharges += dpCharges;

    acc.totalCharges += charges.totalCharges - charges.dpCharges + dpCharges;
  }

  acc.netPnl = acc.grossPnl - acc.totalCharges;
  return acc;
}

/** Joined: a digit then CE/PE, web's rule exactly. */
const JOINED_OPTION = /\d(CE|PE)$/;
/** Spaced, after an expiry token ("NIFTY 24DEC 24000 CE", "X 24DEC25 95.5 PE"): any strike. */
const SPACED_AFTER_EXPIRY = / \d{2}[A-Z]{3}(?:\d{2})? \d+(?:\.\d+)? (CE|PE)$/;
/**
 * Spaced with no expiry ("RELIANCE 2900 CE"): a strike of three digits or more, standing as its
 * own word with one plain space on each side. Shorter or glued runs are names, not strikes:
 * "NV20 PE", "MIDCAP150 PE", "ABC 2 PE"; a tab, a newline or a double space is not the backend's
 * form.
 */
const SPACED_STRIKE = /(?:^|[^ ] )\d{3,}(?:\.\d+)? (CE|PE)$/;

/**
 * An index's own names end in numbers too ("NIFTY 50", "NIFTY 500", "NIFTY MIDCAP 150"), so under an
 * index a bare number is never read as a strike; only an expiry before it makes it a contract.
 */
const startsWithIndex = (symbol: string): boolean =>
  TRADABLE_INDICES.some(idx => symbol.toUpperCase().startsWith(`${idx} `));

const isOptionSymbol = (symbol: string): boolean =>
  JOINED_OPTION.test(symbol) ||
  SPACED_AFTER_EXPIRY.test(symbol) ||
  (!startsWithIndex(symbol) && SPACED_STRIKE.test(symbol));

export type BrokerageStrategy = Partial<
  Pick<Strategy, 'symbol' | 'is_fno' | 'is_intraday'>
>;

/** Derive the tax/brokerage segment from the strategy, falling back to trade hold times. */
export function resolveBrokerageSegment(
  strategy: BrokerageStrategy | undefined,
  trades: BrokerageTrade[] = [],
): BrokerageSegment {
  if (strategy) {
    const symbol = strategy.symbol ?? '';
    // A contract ends in its strike and then CE or PE, joined (NIFTY2410324000CE) or spaced
    // ("NIFTY 24DEC 24000 CE", the form backend-go's isFnOSymbol keeps); a stock like RELIANCE
    // ends in CE too, and was charged an option's brokerage and taxes (zerodha, 10 at 2,900 to
    // 3,000: ₹117.86 against ₹80.88 delivery, ₹31.45 intraday). Web's rule (frontend
    // `src/utils/trading/brokerage.ts`, `/\d(CE|PE)$/`), with the spaced form kept as options.
    if (isOptionSymbol(symbol)) return 'options';
    if (strategy.is_fno || isFnOSymbol(symbol)) return 'futures';
    if (strategy.is_intraday) return 'intraday';
    return 'delivery';
  }

  let holdMs = 0;
  let completed = 0;
  for (const t of trades) {
    if (!t.buy_time || !t.sell_time) continue;
    holdMs += new Date(t.sell_time).getTime() - new Date(t.buy_time).getTime();
    completed += 1;
  }
  if (completed === 0) return 'delivery';
  return holdMs / completed < 24 * 60 * 60 * 1000 ? 'intraday' : 'delivery';
}
