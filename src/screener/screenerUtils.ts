import {formatNextBatch} from '../format/market.ts';
import {formatNumber} from '../format/number.ts';
import type {
  MonthlyPerformance,
  ScreenerBacktestResult,
  ScreenerStrategy,
  SummaryStats,
} from '../types/screener.ts';

const MONTHS_ORDERED = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Backend timeframe -> display label */
const TIMEFRAME_LABELS: Record<string, string> = {
  '1m': '1 Min',
  '5m': '5 Min',
  '15m': '15 Min',
  '1d': '1 Day',
};

export function mapTimeframeLabel(tf: string): string {
  return TIMEFRAME_LABELS[tf] ?? tf;
}

const TIMEFRAME_ORDER = ['1d', '15m', '5m', '1m'];

/**
 * Order the timeframes a strategy has backtests for, or null while the detail
 * query has none. The detail query is keyed by timeframe, so the list is briefly
 * absent after every switch; callers must not correct the user's selection
 * against the loading fallback, or the first click looks like a no-op.
 */
export function confirmedTimeframes(
  fromApi: string[] | undefined,
): string[] | null {
  if (!fromApi || fromApi.length === 0) return null;
  return TIMEFRAME_ORDER.filter(tf => fromApi.includes(tf));
}

/** Parse year from "Jan 2024" -> 2024 */
function parseYearFromLabel(label: string): number | null {
  if (!label) return null;
  const parts = label.trim().split(/\s+/);
  const year = parseInt(parts[parts.length - 1] ?? '', 10);
  return isNaN(year) ? null : year;
}

/** Parse month from "Jan 2024" -> "Jan" */
function parseMonthFromLabel(label: string): string | null {
  if (!label) return null;
  const month = label.trim().split(/\s+/)[0] ?? '';
  return MONTHS_ORDERED.includes(month) ? month : null;
}

/**
 * Transform backtest results into a 12-month array for a given timeframe + year.
 * Missing months are filled with zeroes. Always returns exactly 12 entries in Jan->Dec order.
 */
export function getMonthlyData(
  results: ScreenerBacktestResult[],
  timeframe: string,
  year: number,
): MonthlyPerformance[] {
  const filtered = results.filter(r => {
    if (r.timeframe !== timeframe) return false;
    return parseYearFromLabel(r.period_label) === year;
  });

  const lookup = new Map<string, ScreenerBacktestResult>();
  for (const r of filtered) {
    const month = parseMonthFromLabel(r.period_label);
    if (month) lookup.set(month, r);
  }

  return MONTHS_ORDERED.map(month => {
    const result = lookup.get(month);
    if (result) {
      const logs = result.trades_log ?? [];
      const profit =
        logs.length > 0
          ? logs.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0)
          : (result.realized_pnl ?? 0);
      return {
        month,
        profit,
        totalTrades: result.total_trades ?? 0,
        trades_log: logs,
      };
    }
    return {month, profit: 0, totalTrades: 0, trades_log: []};
  });
}

/** Compute summary stats from monthly performance data. */
export function computeSummaryStats(
  monthly: MonthlyPerformance[],
): SummaryStats {
  const first = monthly[0];
  const withData = monthly.filter(m => m.profit !== 0 || m.totalTrades > 0);

  if (!first || withData.length === 0) {
    return {totalReturn: null, bestMonth: null, worstMonth: null};
  }

  const totalReturn = monthly.reduce((sum, m) => sum + m.profit, 0);

  let best = first;
  let worst = first;
  for (const m of monthly) {
    if (m.profit > best.profit) best = m;
    if (m.profit < worst.profit) worst = m;
  }

  return {
    totalReturn,
    bestMonth: {month: best.month, profit: best.profit},
    worstMonth: {month: worst.month, profit: worst.profit},
  };
}

export type StrategyHorizon = 'intraday' | 'swing' | 'longterm';

export const STRATEGY_HORIZON_LABEL: Record<StrategyHorizon, string> = {
  intraday: 'Intraday',
  swing: 'Swing',
  longterm: 'Long Term',
};

/**
 * Which horizon bucket a screener strategy belongs to. A strategy carrying no
 * backtest numbers and no intraday flag is a static long-term idea rather than
 * a swing one. Single source of truth for the card's category line and the
 * market page's horizon filter, so the two can't disagree about a strategy.
 */
export function strategyHorizon(strategy: ScreenerStrategy): StrategyHorizon {
  if (strategy.is_intraday) return 'intraday';
  if (strategy.avg_winrate == null && strategy.avg_pnl == null)
    return 'longterm';
  return 'swing';
}

/** When each horizon's picker next runs, in IST wall clock. */
export const PICKS_RESET_AT = '09:05';

export type PicksResetInfo =
  | {kind: 'finalizing'}
  | {kind: 'nextMonday'; at: typeof PICKS_RESET_AT}
  | {
      kind: 'nextBatch';
      /** `formatNextBatch`'s wording: "9:05 AM", "9:05 AM tomorrow", "9:05 AM Monday". */
      at: string;
    }
  | {kind: 'tomorrow'; at: typeof PICKS_RESET_AT};

/**
 * When the empty picks row's horizon refills. The three horizons refill on
 * their own cadences, so one shared "check back soon" left the two with a known
 * next run looking as open-ended as the one without: intraday repicks every
 * session, swing once a week, and a long-term idea only when a stock qualifies.
 *
 * The intraday run is market-day aware (`formatNextBatch`) - on a Friday the
 * next set is Monday's, and promising it "tomorrow" would be a promise the
 * picker doesn't keep. `tomorrow` is the fallback when that time can't be
 * worked out. `now` is injectable for tests.
 */
export function picksResetInfo(
  horizon: StrategyHorizon,
  now: Date = new Date(),
): PicksResetInfo {
  if (horizon === 'longterm') return {kind: 'finalizing'};
  if (horizon === 'swing') return {kind: 'nextMonday', at: PICKS_RESET_AT};
  const next = formatNextBatch(PICKS_RESET_AT, now);
  return next
    ? {kind: 'nextBatch', at: next}
    : {kind: 'tomorrow', at: PICKS_RESET_AT};
}

/**
 * What the empty picks row says.
 * English for the web app; mobile renders `picksResetInfo`.
 */
export function picksResetMessage(
  horizon: StrategyHorizon,
  now: Date = new Date(),
): string {
  const info = picksResetInfo(horizon, now);
  switch (info.kind) {
    case 'finalizing':
      return "Today's picks are being finalized — check back soon.";
    case 'nextMonday':
      return "This week's picks are done — the next set lands next Monday at 9:05 AM.";
    case 'nextBatch':
      return `Today's picks are done — the next set lands at ${info.at}.`;
    case 'tomorrow':
      return "Today's picks are done — the next set lands tomorrow at 9:05 AM.";
  }
}

export type RiskTone = 'low' | 'med' | 'high';

export interface RiskTier {
  label: string;
  /** One-word form for tiles too narrow for "Medium risk". */
  short: string;
  tone: RiskTone;
}

/**
 * Coarse risk tier from a backtest max-drawdown percentage. Returns null when the
 * strategy has no backtest to judge (e.g. static long-term strategies).
 */
export function deriveRiskTier(maxDrawdownPct?: number): RiskTier | null {
  if (maxDrawdownPct == null) return null;
  if (maxDrawdownPct < 15)
    return {label: 'Low risk', short: 'Low', tone: 'low'};
  if (maxDrawdownPct < 25)
    return {label: 'Medium risk', short: 'Medium', tone: 'med'};
  return {label: 'High risk', short: 'High', tone: 'high'};
}

/**
 * Risk tier for a whole strategy, mirroring the card badge rule: only strategies
 * with a real backtest equity curve get a tier; static/long-term ones return null.
 * Single source of truth shared by the card badge and the templates risk filter.
 */
export function strategyRiskTier(strategy: ScreenerStrategy): RiskTier | null {
  const hasCurve = (strategy.equity_curve?.length ?? 0) > 1;
  return hasCurve ? deriveRiskTier(strategy.max_drawdown_pct) : null;
}

const EXIT_RE = /\b(?:indicator[- ]based\s+)?(?:exit|sell|square[- ]?off)\b/i;

/** Strip leading "Buy when" / "exit: when" style prefixes from a rule clause. */
function cleanRule(s: string): string {
  return s
    .trim()
    .replace(
      /^(?:buy(?:ing)?|enter(?:ing)?|go long|long)[:\s]*(?:when|if|on)?[:\s]*/i,
      '',
    )
    .replace(
      /^(?:indicator[- ]based\s+)?(?:exit|sell|square[- ]?off)[:\s]*(?:when|if|on)?[:\s]*/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a free-text strategy description into entry vs exit rule excerpts by the
 * first exit keyword. No structured entry/exit field exists, so this surfaces the
 * rules already written in the prose without fabricating anything; exit is empty
 * when the description never states one.
 */
export function splitEntryExit(description: string): {
  entry: string;
  exit: string;
} {
  const text = (description || '').replace(/\s+/g, ' ').trim();
  if (!text) return {entry: '', exit: ''};

  const match = EXIT_RE.exec(text);
  if (match?.index === undefined) {
    return {entry: cleanRule(text), exit: ''};
  }

  const entry = cleanRule(text.slice(0, match.index).replace(/[.;,]\s*$/, ''));
  const exit = cleanRule(text.slice(match.index));
  return {entry: entry || cleanRule(text), exit};
}

/**
 * Format an absolute backtest PnL figure as a percentage of the ₹1L notional
 * used across every screener backtest. Shared by the Templates drawer and the
 * Market "Ready-made strategies" drawer so both read identically.
 */
export function formatBacktestProfitPct(val: number): string {
  const prefix = val > 0 ? '+' : val < 0 ? '-' : '';
  const percentage = (Math.abs(val) / 100000) * 100;
  return `${prefix}${formatNumber(percentage, 2)}%`;
}

/**
 * Build the chat handoff message for deploying a strategy, so a card Deploy on
 * either platform sends the same prompt.
 */
export function buildDeployMessage(
  basePrompt: string,
  timeframe: string,
  isIntraday?: boolean,
): string {
  let msg = basePrompt ?? '';
  if (isIntraday !== undefined) msg += ` intraday:${isIntraday}`;
  return `${msg} selected time frame : ${timeframe}`;
}
