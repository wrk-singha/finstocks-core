import {IST, istDayKey, parseApiDate} from '../format/index.ts';
import {priceSymbolFor} from '../market/livePrice.ts';
import {isFnOSymbol} from '../market/symbols.ts';
import type {TradeData} from '../types/user.ts';

export interface TradePremium {
  buyPremium: number | null;
  sellPremium: number | null;
  /** The premium a manual F&O leg was actually entered at — the LIMIT price the order rested at.
   *  `buy_price` on those rows holds the underlying's spot, so this is the only honest entry
   *  price when it's present. */
  triggerPrice: number | null;
}

const EMPTY_PREMIUM: TradePremium = {
  buyPremium: null,
  sellPremium: null,
  triggerPrice: null,
};

function parseJsonObject(payload: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' ? value : null;

// A lot opened with transaction_type SELL profits when the price falls, so its
// P&L is the inverse of a long's and closing it is a buy.
export const isShortPosition = (executionPayload?: string | null): boolean => {
  if (!executionPayload) return false;
  const data = parseJsonObject(executionPayload);
  return data?.is_short === true || data?.transaction_type === 'SELL';
};

// A trade's payload is parsed by ten call sites, several of them looping over
// the whole book on every render, so the same string was being decoded three or
// four times per trade per pass. The result is a pure function of the string,
// so it is cached on it. Bounded because payloads are per-trade and a long
// session accumulates them.
// drift resolved 2026-09-13: the web copy memoises getTradePremium, the mobile
// copy re-parses on every call; web won — same output, less work per row.
const premiumCache = new Map<string, TradePremium>();
const PREMIUM_CACHE_MAX = 5000;

const parseTradePremium = (executionPayload: string): TradePremium => {
  const payload = parseJsonObject(executionPayload);
  if (!payload) return EMPTY_PREMIUM;

  const buyPremium =
    numberOrNull(payload.buy_premium) ??
    numberOrNull(payload.buyPremium) ??
    numberOrNull(payload.premium);
  const sellPremium =
    numberOrNull(payload.sell_premium) ?? numberOrNull(payload.sellPremium);

  const rawTrigger = numberOrNull(
    payload.trigger_price ?? payload.triggerPrice,
  );
  const triggerPrice =
    rawTrigger !== null && rawTrigger > 0 ? rawTrigger : null;

  return {buyPremium, sellPremium, triggerPrice};
};

export const getTradePremium = (executionPayload?: string): TradePremium => {
  if (!executionPayload) return EMPTY_PREMIUM;
  const cached = premiumCache.get(executionPayload);
  if (cached) return cached;
  const parsed = parseTradePremium(executionPayload);
  if (premiumCache.size >= PREMIUM_CACHE_MAX) premiumCache.clear();
  premiumCache.set(executionPayload, parsed);
  return parsed;
};

// A premium trades far below its underlying, so a buy_price this far above a
// known contract-scale price is the underlying's level, not the premium.
const SPOT_SCALE_RATIO = 20;

/**
 * Per-unit entry price in the instrument's own units — the premium for an F&O
 * leg, buy_price for equity.
 *
 * Manual F&O orders are written with the underlying's level in buy_price and
 * buy_premium null, which marked a ₹54 leg against a ₹24,132 index. Both
 * references below are in contract units, so either one exposes that: the LIMIT
 * price the order rested at, and `reference` — the leg's live or exit premium,
 * passed by callers that have one.
 */
export const getTradeEntryPrice = (
  trade: {
    buy_price?: number | null;
    stock_symbol?: string;
    execution_payload?: string;
  },
  reference: number | null = null,
): number => {
  const {buyPremium, triggerPrice} = getTradePremium(trade.execution_payload);
  if (buyPremium !== null) return buyPremium;

  const buyPrice = Number(trade.buy_price) || 0;
  if (!isFnOSymbol(trade.stock_symbol)) return buyPrice;

  const isSpotScale = [triggerPrice, reference].some(
    p => p !== null && p > 0 && buyPrice > p * SPOT_SCALE_RATIO,
  );
  if (!isSpotScale) return buyPrice;

  return triggerPrice ?? reference ?? buyPrice;
};

export type PortfolioSegment = 'equity' | 'fno';

/** The Equity/F&O tab filter — one definition for holdings, positions, metrics and the strategy rail. */
export const matchesSegment = (
  segment: PortfolioSegment,
  isFnO: boolean,
): boolean => (segment === 'fno' ? isFnO : !isFnO);

/** The flag first, then the symbol: a strategy written against a contract but
 *  saved without `is_fno` is still F&O, and reading it as Swing puts it in the
 *  wrong tab. */
export const isFnOStrategy = (s: {
  is_fno?: boolean;
  symbol?: string;
  stock_symbol?: string;
}): boolean =>
  s.is_fno === true || isFnOSymbol(s.symbol) || isFnOSymbol(s.stock_symbol);

// Trades carry no is_fno flag — the contract symbol is the only signal.
export const isFnOTrade = (t: {stock_symbol?: string}): boolean =>
  isFnOSymbol(t.stock_symbol);

/** The Mock/Live split usePortfolio applies to the raw ["portfolios"] response. */
export const matchesTradeMode = (
  trade: {status?: string},
  isMock: boolean,
): boolean =>
  trade.status === (isMock ? 'SIMULATION' : 'LIVE') ||
  (!trade.status && !isMock);

/** Mock/live filter shared by `usePortfolio` and the widget snapshot builder. */
export const filterTradesForMode = (
  trades: TradeData[],
  isMockEnabled: boolean,
): TradeData[] =>
  trades.filter(trade => matchesTradeMode(trade, isMockEnabled));

interface IntradayFlaggedStrategy {
  is_intraday?: boolean;
  strategy_id?: string | number;
}

/**
 * The intraday strategy ids isPositionTrade needs, from a useTradeStatus payload — either the
 * bare strategies array or the `{strategies}` envelope.
 * drift resolved 2026-09-13: mobile took `Strategy[] | undefined`, web took the raw status
 * payload in either shape; web won — it accepts everything mobile's callers pass and also the
 * cached ["status"] response routePrefetch reads before any hook has unwrapped it.
 */
export const intradayStrategyIdSet = (
  tradeStatus:
    | IntradayFlaggedStrategy[]
    | {strategies?: IntradayFlaggedStrategy[] | null}
    | null
    | undefined,
): Set<string> => {
  const list = Array.isArray(tradeStatus)
    ? tradeStatus
    : (tradeStatus?.strategies ?? []);
  return new Set(
    list.filter(s => s.is_intraday === true).map(s => String(s.strategy_id)),
  );
};

/**
 * Positions vs Holdings, matching the split every Indian broker uses: a
 * position is F&O, intraday equity, or a CNC buy from today that has not
 * settled to demat yet (T1). A holding is delivered stock.
 *
 * MIS/CNC itself never reaches storage — it is validated at the order-entry
 * edge (handlers/trading/manual.go) and discarded — so intraday equity is
 * recognised only through strategies_new.is_intraday. Manual intraday equity
 * has no strategy row to join and falls through to Holdings after T1, which
 * is the same CNC default the backend applies when the field is missing.
 */

/** Bought today in IST, so delivery has not settled and the stock is still T1. */
export const isSameDayBuy = (buyTime?: string | null): boolean => {
  if (!buyTime) return false;
  const bought = new Date(buyTime);
  if (Number.isNaN(bought.getTime())) return false;
  return istDayKey(bought) === istDayKey(new Date());
};

export const isPositionTrade = (
  trade: {
    stock_symbol?: string | null;
    execution_strategy?: string | null;
    buy_time?: string | null;
  },
  intradayStrategyIds: Set<string>,
): boolean => {
  if (isFnOSymbol(trade.stock_symbol)) return true;
  if (isSameDayBuy(trade.buy_time)) return true;
  const sid = getStrategyIdForDisplay(trade.execution_strategy ?? null);
  return sid != null && intradayStrategyIds.has(sid);
};

/**
 * The exact complement of an open isPositionTrade, so no trade lands in both
 * tabs and none in neither. A squared-off intraday trade stays a holding: its
 * realized P&L is part of this book's history.
 */
export const isHoldingTrade = (
  trade: {
    sell_time?: string | null;
    stock_symbol?: string | null;
    execution_strategy?: string | null;
    buy_time?: string | null;
  },
  intradayStrategyIds: Set<string>,
): boolean =>
  Boolean(trade.sell_time) || !isPositionTrade(trade, intradayStrategyIds);

/**
 * The symbols the holdings tables price. Shared with routePrefetch, which derives the same set
 * from the raw ["portfolios"] and ["status"] responses so the price request can leave before the
 * component tree mounts — a divergence here makes that request miss the key the hook later asks
 * for and pays for both. `toPriceSymbol` defaults to the market domain's `priceSymbolFor` (a contract
 * prices against its own premium series; equity normalises to the underlying) and can be
 * overridden by a caller that prices differently.
 */
export const deriveHoldingSymbols = (
  trades: {
    stock_symbol: string;
    sell_time?: string | null;
    execution_strategy?: string | null;
    buy_time?: string | null;
  }[],
  intradayStrategyIds: Set<string>,
  toPriceSymbol: (symbol: string) => string = priceSymbolFor,
): string[] =>
  Array.from(
    new Set(
      trades
        .filter(t => isHoldingTrade(t, intradayStrategyIds))
        .map(t => toPriceSymbol(t.stock_symbol)),
    ),
  );

export const getTradeQuantityDisplay = (trade: {
  quantity: number;
  stock_symbol?: string;
}): {value: number; label: string} => {
  const qty = trade.quantity || 0;
  const label = isFnOSymbol(trade.stock_symbol)
    ? 'quantities'
    : qty === 1
      ? 'share'
      : 'shares';
  return {value: qty, label};
};

// Premium-aware — resolves options/futures P&L from execution_payload rather
// than the raw buy/sell price columns, and falls back to a live currentPrice
// for an unresolved open position.
//
// Null, not 0, when the P&L can't be resolved — an open position with no live
// price, or a trade with no buy price. Callers that render a figure must show a
// placeholder for null rather than a number; only callers aggregating closed
// trades may coalesce to 0.
export const calculatePNL = (
  trade: {
    buy_price: number | null;
    sell_price: number | null;
    buy_time?: string | null;
    sell_time?: string | null;
    quantity: number;
    stock_symbol?: string;
    execution_payload?: string;
  },
  currentPrice?: number | null,
): number | null => {
  const {sellPremium} = getTradePremium(trade.execution_payload);
  const qty = trade.quantity || 0;

  const exitPrice =
    trade.sell_price != null && trade.sell_price !== 0
      ? trade.sell_price
      : (currentPrice ?? null);
  const sellPrice = sellPremium ?? exitPrice;

  // The exit price is in the instrument's own units, so it is the yardstick
  // that catches an index-scale buy_price on an F&O leg.
  const buyPrice = getTradeEntryPrice(trade, sellPrice);

  if (buyPrice === 0) return null;
  if (sellPrice !== null && !Number.isNaN(sellPrice)) {
    return isShortPosition(trade.execution_payload)
      ? (buyPrice - sellPrice) * qty
      : (sellPrice - buyPrice) * qty;
  }
  return null;
};

export const getPnlBasisLabel = (hasSold: boolean): string =>
  hasSold ? 'Realised' : 'Unrealised';

// Hoisted: these run per trade row, and each `new Intl.*` rebuilds an ICU formatter (a JNI hop
// into ICU4J on Android). `padDay` flips one option, so key the cache on it.
const istMonthDayFormatters = new Map<boolean, Intl.DateTimeFormat>();

// The date and the clock come from two formatters: Hermes on iOS types a combined
// date-and-time format's clock as plain literals, so its hour, minute and AM/PM read empty.
function istMonthDay(padDay: boolean): Intl.DateTimeFormat {
  let formatter = istMonthDayFormatters.get(padDay);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: padDay ? '2-digit' : 'numeric',
      timeZone: IST,
    });
    istMonthDayFormatters.set(padDay, formatter);
  }
  return formatter;
}

const istClock = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: IST,
});

// IST "MMM D h:mm AM/PM" for a trade leg. Unlike the freshness stamps in the apps' general
// formatter, midnight is printed rather than blanked: a trade leg always carries a real
// execution time. Wanted in format/ as the general (epoch-seconds-aware, midnight-blanking)
// istDateTimeParts; this one stays private to the trade-leg stamp.
function istDateTimeParts(
  dateString: string | null | undefined,
  padDay = false,
): {date: string; time: string} | null {
  if (!dateString) return null;
  const d = parseApiDate(dateString);
  if (!d) return null;
  const dateParts = istMonthDay(padDay).formatToParts(d);
  const clockParts = istClock.formatToParts(d);
  const get = (type: string): string =>
    [...dateParts, ...clockParts].find(p => p.type === type)?.value ?? '';
  return {
    date: `${get('month')} ${get('day')}`,
    time: `${get('hour')}:${get('minute')} ${get('dayPeriod').toUpperCase()}`,
  };
}

export const formatTradeTime = (timeString: string | null): string => {
  const p = istDateTimeParts(timeString, true);
  return p ? `${p.date} ${p.time}` : 'N/A';
};

/** Local-time YYYY-MM-DD, the key the holdings date filter compares on. */
export const formatDateString = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const calculateHoldTime = (
  buyTime: string | null,
  sellTime?: string | null,
): string => {
  if (!buyTime) return 'N/A';

  const startTime = new Date(buyTime);
  const endTime = sellTime ? new Date(sellTime) : new Date();

  const diffMs = endTime.getTime() - startTime.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) return `${diffDays}d ${diffHours}h`;
  if (diffHours > 0) return `${diffHours}hr ${diffMinutes}min`;
  return `${diffMinutes}min`;
};

export const extractStrategyId = (
  executionStrategy: string | null,
): string | null => {
  if (!executionStrategy) return null;
  const match = /STRAT([a-f0-9-]{36})/i.exec(executionStrategy);
  return match?.[1] ?? null;
};

export const getStrategyIdForDisplay = (
  executionStrategy: string | null,
): string | null => extractStrategyId(executionStrategy);

export const getExecutionStrategyName = (strategy: string | null): string => {
  if (!strategy) return 'N/A';

  const strategyId = extractStrategyId(strategy);
  if (strategyId) return `${strategyId.substring(0, 8)}...`;

  if (strategy === 'swing model long term hold') return 'Argus Autopilot';
  if (strategy.startsWith('IN_MANUAL')) return 'Manual Trade';

  return 'N/A';
};

export const isManualTrade = (executionStrategy: string | null): boolean => {
  if (!executionStrategy) return false;
  const upper = executionStrategy.toUpperCase();
  return (
    upper.includes('MANUAL') || upper.includes('MAN') || upper.includes('SYNC')
  );
};

export const getExecutionStrategyDisplay = (
  executionStrategy: string | null,
): string => {
  if (!executionStrategy) return 'MANUAL';
  if (extractStrategyId(executionStrategy)) return 'STRATEGY';
  return isManualTrade(executionStrategy) ? 'MANUAL' : 'AUTOPILOT';
};

// Keyed off the strategy's sequential NUMBER, not a hash of its id, so "STRAT 1"
// is the same on both apps.
export const getStrategyNumber = (
  strategyId: string,
  allStrategyIds: string[],
): number => {
  const sortedIds = [...new Set(allStrategyIds)].sort();
  return sortedIds.indexOf(strategyId) + 1;
};

export const getLogBadgeColor = (
  logLevel: string,
  colors: {
    status: {error: string; warning: string; success: string};
    brand: {primary: string};
  },
): {bg: string; text: string} => {
  switch (logLevel.toUpperCase()) {
    case 'ERROR':
    case 'SELL':
      return {bg: `${colors.status.error}20`, text: colors.status.error};
    case 'WARNING':
      return {bg: `${colors.status.warning}20`, text: colors.status.warning};
    case 'BUY':
      return {bg: `${colors.status.success}20`, text: colors.status.success};
    default:
      return {bg: `${colors.brand.primary}20`, text: colors.brand.primary};
  }
};
