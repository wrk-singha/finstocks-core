import {formatNumber, signedFractionPct} from '../format/index.ts';
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
 * Chat hand-off, as web dev words it (`fc577dca`, `strategyLibrary.ts`). The visible sentence is
 * what the user sees in their bubble; the `[<Library Strategy: …>]` marker is stripped from display
 * and carries the public id the model resolves to the strategy's hidden logic server-side. Neither
 * carries a capital or a quantity: the assistant asks, or its plan card is confirmed in the chat.
 */
export type LibraryChatIntent = 'ask' | 'backtest' | 'deploy' | 'forward_test';

const CHAT_REQUEST: Readonly<
  Record<LibraryChatIntent, (name: string) => string>
> = {
  ask: name => `Tell me about the ${name} strategy.`,
  backtest: name => `Backtest the ${name} strategy for me.`,
  deploy: name => `Deploy the ${name} strategy for me.`,
  forward_test: name => `Forward test the ${name} strategy with mock money.`,
};

/** The visible sentence of a hand-off, without its marker. */
export const libraryChatRequest = (
  s: Pick<LibraryStrategy, 'name'>,
  intent: LibraryChatIntent,
): string => CHAT_REQUEST[intent](s.name);

/** The hidden marker that names the strategy to the model; a display strips it. */
export const libraryChatMarker = (
  s: Pick<LibraryStrategy, 'id' | 'name'>,
): string => `[<Library Strategy: ID: ${s.id}, Name: ${s.name}>]`;

export function libraryChatMessage(
  s: Pick<LibraryStrategy, 'id' | 'name'>,
  intent: LibraryChatIntent,
): string {
  return `${libraryChatRequest(s, intent)} ${libraryChatMarker(s)}`;
}

/** A backtest's mean hold in a stat tile, as web dev's `libraryTradeStats`: "Intraday", "32d", "8.5 mo". */
export const compactHold = (days: number): string =>
  days < 1
    ? 'Intraday'
    : days < 90
      ? `${String(Math.round(days))}d`
      : `${(days / 30.4).toFixed(1).replace(/\.0$/, '')} mo`;

/** A backtest's trade pace in a stat tile: "<1", "~14". */
export const compactPace = (perMonth: number): string =>
  perMonth < 1 ? '<1' : `~${String(Math.round(perMonth))}`;

export type LibraryMetricKey =
  | 'maxDrawdown'
  | 'worstMonth'
  | 'riskLevel'
  | 'winRate'
  | 'riskReward'
  | 'avgTrade'
  | 'avgHold'
  | 'tradesPerMonth'
  | 'direction'
  | 'benchmarkReturn'
  | 'totalTrades'
  | 'backtestYears';

export interface LibraryMetric {
  key: LibraryMetricKey;
  value: string;
  /** Loss for a fall, by sign for a trade's mean return; null reads plain. */
  tone: 'profit' | 'loss' | null;
}

const toneBySign = (value: number): 'profit' | 'loss' =>
  value < 0 ? 'loss' : 'profit';

/**
 * A strategy's numbers in web dev's order (`LibraryMetrics.metricsOf`), skipping every one the
 * server did not send. On backend main that leaves Max drawdown, Risk level and Direction. The
 * trade stats need a closed trade, as web gates them, and a 0 that dev sends for "none" is left
 * out: the payoff (no loser, as web), and the benchmark's return (no benchmark curve; web prints
 * it as 0%).
 */
export function libraryMetrics(
  strategy: Pick<
    LibraryStrategy,
    'backtest_summary' | 'risk_level' | 'direction'
  >,
): LibraryMetric[] {
  const s = strategy.backtest_summary;
  const hasTrades = (s?.trades ?? 0) > 0;
  const out: (LibraryMetric | null)[] = [
    s === null
      ? null
      : {
          key: 'maxDrawdown',
          value: signedFractionPct(s.max_drawdown),
          tone: 'loss',
        },
    s?.worst_month == null
      ? null
      : {
          key: 'worstMonth',
          value: signedFractionPct(s.worst_month),
          tone: 'loss',
        },
    {key: 'riskLevel', value: riskLabel(strategy.risk_level), tone: null},
    hasTrades && s?.win_rate != null
      ? {
          key: 'winRate',
          value: `${String(Math.round(s.win_rate * 100))}%`,
          tone: null,
        }
      : null,
    s?.payoff_ratio
      ? {
          key: 'riskReward',
          value: `1 : ${s.payoff_ratio.toFixed(1)}`,
          tone: null,
        }
      : null,
    hasTrades && s?.avg_trade_return != null
      ? {
          key: 'avgTrade',
          value: signedFractionPct(s.avg_trade_return),
          tone: toneBySign(s.avg_trade_return),
        }
      : null,
    hasTrades && s?.avg_hold_days != null
      ? {key: 'avgHold', value: compactHold(s.avg_hold_days), tone: null}
      : null,
    hasTrades && s?.trades_per_month != null
      ? {
          key: 'tradesPerMonth',
          value: compactPace(s.trades_per_month),
          tone: null,
        }
      : null,
    {
      key: 'direction',
      value: LIBRARY_DIRECTION_LABEL[strategy.direction],
      tone: null,
    },
    s?.benchmark_return
      ? {
          key: 'benchmarkReturn',
          value: signedFractionPct(s.benchmark_return),
          tone: null,
        }
      : null,
    hasTrades && s?.trades != null
      ? {key: 'totalTrades', value: formatNumber(s.trades), tone: null}
      : null,
    s?.years != null && s.years > 0
      ? {
          key: 'backtestYears',
          value: `${s.years.toFixed(1).replace(/\.0$/, '')} yr`,
          tone: null,
        }
      : null,
  ];
  return out.filter((m): m is LibraryMetric => m !== null);
}

/**
 * The list's curve for a strategy: the summary's thinned equity curve, only when the server sent
 * one of at least two points. Web falls back to fetching each card's whole detail for it; an app
 * list does not, so a strategy without one draws none.
 */
export const libraryCurve = (
  strategy: Pick<LibraryStrategy, 'backtest_summary'>,
): readonly number[] | null => {
  const curve = strategy.backtest_summary?.curve;
  return curve !== undefined && curve.length >= 2 ? curve : null;
};

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
