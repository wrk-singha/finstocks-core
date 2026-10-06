import type {RiskTone} from '../screener/screenerUtils.ts';
import type {ChatContext} from '../types/chat.ts';
import type {
  LibraryComplexity,
  LibraryDirection,
  LibraryExchangeCategory,
  LibraryHorizon,
  LibrarySegment,
  LibraryStrategy,
  LibraryStyle,
} from '../types/strategyLibrary.ts';

// The black-box strategy library's labels, risk scale and chat hand-off, as web `dev` has them
// (src/utils/strategy/strategyLibrary.ts). Labels are English data, like the line labels in
// `fundamentals/`.

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
