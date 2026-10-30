/**
 * The three independent ways a plan runs - backtest, forward test (a mock deployment) and deploy
 * live: the backtest period ladder with its per-candle caps, and each kind's newest run read back
 * out of the strategies the plan produced.
 *
 * Words are the apps': a period, a cap and a run come back as values, never as a label, so the
 * phone can put them through its own strings.
 */
import {parseTimestamp} from '../format/date.ts';
import type {
  BacktestPeriod,
  RunOptionKind,
  StrategyRunSnapshot,
} from '../types/strategyRun.ts';
import type {Strategy} from '../types/trade.ts';
import {
  LIVE_OPEN_STATUSES,
  statusOf,
  type StrategyStatusSource,
} from './strategyStatus.ts';

export interface BacktestPeriodOption {
  value: BacktestPeriod;
  /** Nominal length, which the request's dates and the per-candle caps are measured in. */
  days: number;
}

const SIX_MONTHS: BacktestPeriodOption = {value: '6m', days: 180};

/** The periods a backtest is offered over, shortest first. */
export const BACKTEST_PERIODS: readonly BacktestPeriodOption[] = [
  {value: '1m', days: 30},
  {value: '3m', days: 90},
  SIX_MONTHS,
  {value: '1y', days: 365},
  {value: '2y', days: 730},
  {value: '3y', days: 1095},
  {value: '5y', days: 1825},
];

export const DEFAULT_BACKTEST_PERIOD: BacktestPeriod = SIX_MONTHS.value;

// Mirrors maxBacktestRange in backend-go/handlers/trading/createbacktest.go: intraday candles are
// capped so a request the server would refuse is never offered in the first place.
const MAX_BACKTEST_DAYS: Readonly<Record<string, number>> = {
  '1m': 365,
  '5m': 3 * 365,
  '15m': 5 * 365,
};

const periodDays = (period: BacktestPeriod): number =>
  (BACKTEST_PERIODS.find(p => p.value === period) ?? SIX_MONTHS).days;

export const isPeriodAllowed = (
  period: BacktestPeriod,
  timeframe: string,
): boolean => {
  const max = MAX_BACKTEST_DAYS[timeframe];
  return max === undefined || periodDays(period) <= max;
};

/**
 * The longest period a candle size can be backtested over, which is what an app names beside the
 * periods it greys out ("up to 1 year on 1m candles").
 */
export const maxPeriod = (timeframe: string): BacktestPeriod =>
  BACKTEST_PERIODS.filter(p => isPeriodAllowed(p.value, timeframe)).at(-1)
    ?.value ?? '1m';

/** The longest allowed period no longer than `period`, for when the candle size shrinks under it. */
export const clampPeriod = (
  period: BacktestPeriod,
  timeframe: string,
): BacktestPeriod =>
  isPeriodAllowed(period, timeframe) ? period : maxPeriod(timeframe);

/**
 * The period covering a window the plan already named, for a card that starts from one ("backtest
 * last week"). Rounded up to the shortest period that reaches at least as far back, because the
 * options are a fixed ladder and the shortest rung is a month: rounding down would test less
 * history than was asked for and read as the card ignoring the request.
 *
 * The rungs are nominal day counts, so a real calendar span lands just over one - 31 days for a
 * month, 184 for six. Matching within a few percent keeps those on the rung they were meant for
 * instead of the next one up.
 */
const WINDOW_TOLERANCE = 1.05;

export function periodForWindow(
  startDate: string | undefined,
  endDate: string | undefined,
  now: Date = new Date(),
): BacktestPeriod | undefined {
  const start = parseTimestamp(startDate);
  const end = endDate ? parseTimestamp(endDate) : now;
  if (!start || !end) return undefined;
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days <= 0) return undefined;
  return (
    BACKTEST_PERIODS.find(p => p.days * WINDOW_TOLERANCE >= days)?.value ?? '5y'
  );
}

const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** The create-backtest window for `period`, ending today. */
export function backtestDates(
  period: BacktestPeriod,
  now: Date = new Date(),
): {start_date: string; end_date: string} {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - periodDays(period));
  return {start_date: isoDate(start), end_date: isoDate(now)};
}

/** The fields a run's kind is read from; both apps' Strategy rows satisfy it. */
export interface StrategyRunRow {
  created_at: string;
  is_backtest?: boolean | undefined;
  is_mock?: boolean | undefined;
}

const createdMs = (row: StrategyRunRow): number =>
  parseTimestamp(row.created_at)?.getTime() ?? Number.NaN;

/**
 * The newest backtest, mock deployment and live deployment among a plan's runs. The three are
 * independent, so each is picked on its own.
 */
export function snapshotRuns<T extends StrategyRunRow>(
  strategies: readonly T[],
): StrategyRunSnapshot<T> {
  const sorted = [...strategies].sort((a, b) => createdMs(b) - createdMs(a));
  return {
    backtest: sorted.find(s => s.is_backtest === true),
    forward: sorted.find(s => s.is_backtest !== true && s.is_mock === true),
    // Only a row that says it is live: a flag missing from a row is never read as real money.
    live: sorted.find(s => s.is_backtest !== true && s.is_mock === false),
  };
}

/** A deployment still placing (or able to resume placing) orders. */
export const isDeploymentOpen = (
  strategy: StrategyStatusSource | undefined,
): boolean =>
  strategy !== undefined && LIVE_OPEN_STATUSES.includes(statusOf(strategy));

// A backtest row that dies stays PENDING forever; past this age it is treated as not finished
// rather than as still running.
//
// Measured from the row's own created_at, deliberately: the cards that read this live inside a
// virtualised chat list, so anything held in a ref or a timer resets every time one scrolls out
// and back. A bound built from component lifetime is no bound at all. The server's clock does not
// scroll.
export const BACKTEST_STALLED_AFTER_MS = 10 * 60_000;

/** Milliseconds since the run was created; 0 when its stamp is unreadable. */
export const runAgeMs = (
  strategy: Pick<Strategy, 'created_at'>,
  now: number = Date.now(),
): number => {
  const started = parseTimestamp(strategy.created_at);
  return started ? now - started.getTime() : 0;
};

// Which run tile carries the emphasis, keyed on the card type the backend routed this plan to. The
// mapping lives here, as data, because it was twice two string literals forty lines apart in one
// ChatArea switch - and a third branch that simply omitted the prop inherited "backtest" from a
// default rather than failing, so a strategy answer pointed at the wrong tile without anything
// breaking.
//
// Keyed on only the two card types that render a run row, not on all of ChatCard: every entry here
// is a real decision, and a new plan-bearing card type becomes a compile error in this table
// instead of silently inheriting.
export const CARD_HIGHLIGHT_RUN: Readonly<
  Record<'backtest' | 'strategies', RunOptionKind>
> = {
  // Asked to test an idea against history: the backtest answers that question.
  backtest: 'backtest',
  // Asked for a strategy: forward test is the next step for a rule just written, and the one that
  // risks no money.
  strategies: 'forward',
};
