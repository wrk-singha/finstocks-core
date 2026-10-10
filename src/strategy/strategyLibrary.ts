import {
  annualisedReturn,
  monthlyReturns,
  yearsBetween,
} from '../market/basketBacktest.ts';
import type {RiskTone} from '../screener/screenerUtils.ts';
import type {ChatContext} from '../types/chat.ts';
import type {
  LibraryActivity,
  LibraryBacktest,
  LibraryBacktestDay,
  LibraryBacktestTrade,
  LibraryComplexity,
  LibraryDirection,
  LibraryExchangeCategory,
  LibraryHorizon,
  LibrarySegment,
  LibraryStrategy,
  LibraryStyle,
  LibraryTradeSide,
} from '../types/strategyLibrary.ts';

// The black-box strategy library's labels, risk scale, chat hand-off and backtest reading, as web
// main has them (src/utils/strategy/strategyLibrary.ts and the library page's components). Labels
// are English data, like the line labels in `fundamentals/`.

export const LIBRARY_STYLE_LABEL: Record<LibraryStyle, string> = {
  premium_selling: 'Options income',
  income: 'Stock income',
  trend_following: 'Trend following',
  momentum: 'Momentum',
  mean_reversion: 'Mean reversion',
  breakout: 'Breakout',
  volatility_long: 'Volatility',
  hedged_directional: 'Hedged directional',
  arbitrage: 'Arbitrage',
  market_making: 'Market making',
  relative_value: 'Pairs',
  calendar: 'Seasonal',
  allocation: 'Allocation',
  execution: 'Signal execution',
};

export const LIBRARY_SEGMENT_LABEL: Record<LibrarySegment, string> = {
  index_options: 'Index options',
  stock_options: 'Stock options',
  equity_cash: 'Stocks',
  index_futures: 'Index futures',
  stock_futures: 'Stock futures',
  cash_and_futures: 'Stocks + futures',
  multi: 'Multi-instrument',
};

export const LIBRARY_HORIZON_LABEL: Record<LibraryHorizon, string> = {
  intraday: 'Intraday',
  swing: 'Swing',
  positional: 'Positional',
};

/** The catalogue's horizons in reading order: the phone's sections and the horizon chips. */
export const LIBRARY_HORIZONS: readonly LibraryHorizon[] = [
  'intraday',
  'swing',
  'positional',
];

export const LIBRARY_DIRECTION_LABEL: Record<LibraryDirection, string> = {
  long: 'Long only',
  short: 'Bearish',
  both: 'Long & short',
  neutral: 'Market-neutral',
};

export const LIBRARY_COMPLEXITY_LABEL: Record<LibraryComplexity, string> = {
  simple: 'Simple',
  moderate: 'Moderate',
  advanced: 'Advanced',
};

export const LIBRARY_COMPLEXITIES: readonly LibraryComplexity[] = [
  'simple',
  'moderate',
  'advanced',
];

export const LIBRARY_EXCHANGE_CATEGORY_LABEL: Record<
  LibraryExchangeCategory,
  string
> = {
  alpha_seeking: 'Alpha seeking',
  arbitrage: 'Arbitrage',
  high_frequency: 'High frequency',
  scalping: 'Scalping',
  others: 'Others',
};

/**
 * The six steps of SEBI's riskometer, the scale Indian investors already read on every mutual fund
 * factsheet. Level 1 is Low, level 6 is Very high.
 */
export const RISK_LEVELS = [
  {label: 'Low', short: 'Low'},
  {label: 'Low to moderate', short: 'Low–mod'},
  {label: 'Moderate', short: 'Moderate'},
  {label: 'Moderately high', short: 'Mod. high'},
  {label: 'High', short: 'High'},
  {label: 'Very high', short: 'Very high'},
] as const;

export function clampRisk(level: number): number {
  return Math.min(6, Math.max(1, Math.round(level) || 1));
}

const riskStep = (level: number) =>
  RISK_LEVELS[clampRisk(level) - 1] ?? RISK_LEVELS[0];

export function riskLabel(level: number): string {
  return riskStep(level).label;
}

export function riskShort(level: number): string {
  return riskStep(level).short;
}

/** Folds the six steps onto the three badge tones the app already uses. */
export function riskTone(level: number): RiskTone {
  const l = clampRisk(level);
  return l <= 2 ? 'low' : l <= 4 ? 'med' : 'high';
}

export const isReference = (s: LibraryStrategy): boolean =>
  s.availability === 'reference';

const SHORT_OPTION_STYLES = new Set<LibraryStyle>([
  'premium_selling',
  'income',
]);
const FUTURES_SEGMENTS = new Set<LibrarySegment>([
  'index_futures',
  'stock_futures',
  'cash_and_futures',
]);

/**
 * What drives a strategy's risk, as short chips under the risk level. Most F&O strategies sit at
 * High or Very high, so the drivers are what tells two of them apart.
 */
export function riskDrivers(s: LibraryStrategy): string[] {
  const out: string[] = [];
  if (
    s.is_fno &&
    SHORT_OPTION_STYLES.has(s.style) &&
    s.segment !== 'equity_cash'
  )
    out.push('Sells option premium');
  if (FUTURES_SEGMENTS.has(s.segment)) out.push('Leveraged futures');
  if (!s.risk_capped) out.push('Loss not capped by structure');
  if (!s.protective_exit) out.push('No protective stop');
  if (s.holds_overnight) out.push('Overnight exposure');
  return out;
}

/**
 * What the Performance section will hold once a backtest is published, named up front so the empty
 * slot reads as a plan rather than a gap. Day-level views lead for intraday options; curve, months
 * and a benchmark lead for swing.
 */
export function backtestPreview(s: LibraryStrategy): string[] {
  if (s.horizon === 'intraday' && s.is_fno) {
    return [
      'Net P&L on capital and max drawdown',
      'Day-by-day results and worst day',
      'Win days, streaks and expiry-day split',
      'Charges and slippage',
    ];
  }
  if (s.horizon === 'intraday') {
    return [
      'Equity curve and max drawdown',
      'Day-by-day results and worst day',
      'Win rate, streaks and holding time',
      'Charges and slippage',
    ];
  }
  if (s.is_fno) {
    return [
      'Equity curve and max drawdown',
      'Monthly returns',
      'Worst day and margin used',
      'Charges and slippage',
    ];
  }
  return [
    'Equity curve and max drawdown',
    'Monthly returns',
    'Return against NIFTY 50',
    'Win rate and holding time',
  ];
}

/**
 * Chat hand-off. The visible sentence is what the user sees in their bubble; the
 * `[<Library Strategy: …>]` marker is stripped from display and carries the public id the model
 * resolves to the strategy's hidden logic server-side.
 */
export type LibraryChatIntent = 'ask' | 'backtest';

export function libraryChatMessage(
  s: LibraryStrategy,
  intent: LibraryChatIntent,
): string {
  const visible =
    intent === 'backtest'
      ? `Backtest the ${s.name} strategy for me.`
      : `Tell me about the ${s.name} strategy.`;
  return `${visible} [<Library Strategy: ID: ${s.id}, Name: ${s.name}>]`;
}

export function libraryChatContext(s: LibraryStrategy): ChatContext {
  return {label: s.name, sublabel: s.tagline};
}

/**
 * What the templates page lists: the strategies with a published backtest, in catalogue order.
 * The rest of the catalogue stays unlisted until its results are published.
 */
export const publishedLibrary = (
  list: readonly LibraryStrategy[],
): LibraryStrategy[] => list.filter(s => s.has_backtest);

/** The Stocks / F&O tabs show only while the list holds an F&O strategy (web 4aa45cd1). */
export const hasFnoStrategy = (list: readonly LibraryStrategy[]): boolean =>
  list.some(s => s.is_fno);

/** The capital a library backtest is first shown at, as web's page starts it (₹5,00,000). */
export const DEFAULT_LIBRARY_CAPITAL = 500_000;

/**
 * The page's headline: the backtest's annualised return and its benchmark's over the same window,
 * in percent. Null under a year of history, where an annual figure would overstate; the benchmark
 * is null when the curve carries none.
 */
export function libraryBacktestLead(
  backtest: Pick<LibraryBacktest, 'daily'>,
): {value: number; benchmark: number | null} | null {
  const first = backtest.daily[0];
  const last = backtest.daily[backtest.daily.length - 1];
  if (first === undefined || last === undefined) return null;
  const years = yearsBetween(first.date, last.date);
  const value = annualisedReturn(last.nav / first.nav, years);
  if (value === null) return null;
  const benchmark =
    first.benchmark && last.benchmark
      ? annualisedReturn(last.benchmark / first.benchmark, years)
      : null;
  return {
    value: value * 100,
    benchmark: benchmark === null ? null : benchmark * 100,
  };
}

/** The periods the backtest's win rate counts: its calendar months, each by its return. */
export const libraryWinPeriods = (
  daily: readonly LibraryBacktestDay[],
): {net: number}[] => monthlyReturns(daily).map(cell => ({net: cell.basket}));

/** The last day the page has trades for: a live session runs past the backtest's own window. */
export const liveThrough = (
  backtest: Pick<LibraryBacktest, 'window_end'>,
  activity: LibraryActivity | null,
): string => (activity?.live ? activity.date : backtest.window_end);

/** A strategy holds a stock at most once on each side. */
export const positionKey = (position: {
  symbol: string;
  side?: LibraryTradeSide | undefined;
}): string => `${position.symbol}-${position.side ?? 'long'}`;

/** A long-short strategy names each trade's side, and opens and closes rather than buys and sells. */
export const tradesBothWays = (
  strategy: Pick<LibraryStrategy, 'direction'>,
): boolean => strategy.direction === 'both';

export const sideLabel = (side?: LibraryTradeSide): string =>
  side ? 'Short' : 'Long';

/**
 * The backtest's trades with a live session's fills applied: a position opened today joins as
 * open, and one closed today closes, whether it was opened today or before (web 69addf02). The
 * backtest itself only runs through the last finished session.
 */
export function tradesWithLiveSession(
  trades: readonly LibraryBacktestTrade[],
  activity: LibraryActivity | null,
): LibraryBacktestTrade[] {
  if (!activity?.live) return [...trades];
  const opened = activity.buys.map((fill): LibraryBacktestTrade => ({
    symbol: fill.symbol,
    ...(fill.side === undefined ? {} : {side: fill.side}),
    entry_date: activity.date,
    exit_date: '',
    entry_price: fill.price,
    exit_price: fill.last ?? fill.price,
    return_pct: fill.return_pct,
  }));
  const closed = new Map(activity.sells.map(fill => [positionKey(fill), fill]));
  return [...trades, ...opened].map(trade => {
    const fill = trade.exit_date ? undefined : closed.get(positionKey(trade));
    return fill
      ? {
          ...trade,
          exit_date: activity.date,
          exit_price: fill.price,
          return_pct: fill.return_pct,
        }
      : trade;
  });
}

export type LibraryTradeRow = LibraryBacktestTrade & {
  /** Still held at the end of the log: no exit, or one after the day the page runs through. */
  open: boolean;
};

const OPEN_SORTS_FIRST = '9999-12-31';

/**
 * The trade log as the page lists it: the backtest's trades with the live session applied, open
 * positions first, then the latest exits, ties broken by the latest entry; with how many are in
 * profit and the day the log runs through.
 */
export function libraryTradeLog(
  backtest: Pick<LibraryBacktest, 'trades' | 'window_end'>,
  activity: LibraryActivity | null,
): {rows: LibraryTradeRow[]; inProfit: number; through: string} {
  const through = liveThrough(backtest, activity);
  const isOpen = (t: LibraryBacktestTrade) =>
    !t.exit_date || t.exit_date > through;
  const closedOn = (t: LibraryBacktestTrade) =>
    isOpen(t) ? OPEN_SORTS_FIRST : t.exit_date;
  const rows = tradesWithLiveSession(backtest.trades, activity)
    .sort(
      (a, b) =>
        closedOn(b).localeCompare(closedOn(a)) ||
        b.entry_date.localeCompare(a.entry_date),
    )
    .map(t => ({...t, open: isOpen(t)}));
  return {rows, inProfit: rows.filter(t => t.return_pct > 0).length, through};
}

/**
 * A trade row's key. An intraday strategy can enter one stock twice in a session, so the side and
 * entry day alone collide (web 0aa7b4dd).
 */
export const tradeRowKey = (t: LibraryBacktestTrade): string =>
  `${positionKey(t)}-${t.entry_date}-${t.exit_date}-${String(t.entry_price)}`;

/**
 * Whether a session is today's and still trading: live, and dated `today` (a YYYY-MM-DD key in
 * India). A live session dated earlier is one the evening replay has not absorbed yet; it reads as
 * the latest trades, not today's.
 */
export const isTodaysSession = (
  activity: Pick<LibraryActivity, 'date' | 'live'>,
  today: string,
): boolean => activity.live && activity.date === today;

/** A live session as one value, so a host can tell when a new day starts or is absorbed into the backtest. */
export const activitySession = (activity: LibraryActivity | null): string =>
  activity ? `${activity.date}:${String(activity.live)}` : '';
