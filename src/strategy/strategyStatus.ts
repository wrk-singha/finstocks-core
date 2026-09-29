/**
 * Canonical strategy/backtest status helpers. Keeps the terminal-status set in one place so the
 * chat cards, deploy flow and console can't drift.
 *
 * drift resolved 2026-09-13: the mobile copy won - it is the superset (isTerminalStatus, the
 * readonly TERMINAL_STATUSES) and already housed the backtest-payload helpers the web keeps in
 * utils/strategy/strategyLogs; the web copy has no function the mobile one lacks.
 */
import type {LogPayload, StrategyLog} from '../types/strategyLogs.ts';

/** The fields the status helpers read; both apps' Strategy rows satisfy it. */
export interface StrategyStatusSource {
  status?: string | null;
  is_backtest?: boolean;
}

export const TERMINAL_STATUSES = [
  'COMPLETED',
  'SUCCESS',
  'FAILED',
  'ERROR',
] as const;

export const LIVE_OPEN_STATUSES: readonly string[] = [
  'RUNNING',
  'ACTIVE',
  'PENDING',
  'WAITING',
  'PAUSED',
];

export const BACKTEST_STATUSES: readonly string[] = [
  'BACKTEST',
  'BACKTESTING',
  'BACKTEST_PENDING',
];

const AWAITING_START_STATUSES: readonly string[] = ['PENDING', 'WAITING'];

/** True once a strategy/backtest has finished running (any terminal status). */
export function isTerminalStatus(status?: string | null): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(
    status?.toUpperCase() ?? '',
  );
}

export const statusOf = (strategy: StrategyStatusSource): string =>
  strategy.status?.toUpperCase() ?? '';

export const isInProgress = (strategy: StrategyStatusSource): boolean =>
  LIVE_OPEN_STATUSES.includes(statusOf(strategy)) ||
  BACKTEST_STATUSES.includes(statusOf(strategy));

export const isAwaitingStart = (strategy: StrategyStatusSource): boolean =>
  AWAITING_START_STATUSES.includes(statusOf(strategy));

export const isPaused = (strategy: StrategyStatusSource): boolean =>
  statusOf(strategy) === 'PAUSED';

/** The three states a running strategy's status tells apart. */
export type StrategyRunState = 'running' | 'waiting' | 'paused';

/**
 * Read off the status, never the mode: web's dot once keyed off mock mode, so every row in mock
 * read the same whether it was running or not.
 */
export const runStateOf = (strategy: StrategyStatusSource): StrategyRunState =>
  isPaused(strategy)
    ? 'paused'
    : isAwaitingStart(strategy)
      ? 'waiting'
      : 'running';

/** The fields `isConsoleActive` reads; both apps' Strategy rows satisfy it. */
export interface ConsoleActiveSource extends StrategyStatusSource {
  strategy_id: string;
  is_mock?: boolean | null;
}

/**
 * The rows the Strategy Console's Active tab actually renders — and therefore
 * the only correct basis for any "N active strategies" count.
 *
 * Three separate definitions of "active" had drifted apart: the composer pill
 * carried its own copy of LIVE_OPEN_STATUSES and counted `AP-` rows, while the
 * rail, the sidebar and "Halt all" all excluded them. Autopilot's placeholder
 * strategies are folded into one synthetic Autopilot row and have no card of
 * their own, so counting them promised a strategy the destination never shows.
 *
 * `!!is_mock` because the API can send it null; the console rail already
 * coerces, and an uncoerced compare would count a row the rail drops.
 */
export const isConsoleActive = (
  strategy: ConsoleActiveSource,
  isMock: boolean,
): boolean =>
  !strategy.is_backtest &&
  !!strategy.is_mock === isMock &&
  !strategy.strategy_id.startsWith('AP-') &&
  LIVE_OPEN_STATUSES.includes(statusOf(strategy));

/** True while a backtest is queued or actively running (not yet completed/failed). */
export const isBacktestInProgress = (strategy: StrategyStatusSource): boolean =>
  statusOf(strategy) === 'BACKTEST_PENDING' ||
  (strategy.is_backtest === true && isInProgress(strategy));

export const isCompletedBacktest = (strategy: StrategyStatusSource): boolean =>
  strategy.is_backtest === true &&
  ['COMPLETED', 'SUCCESS'].includes(statusOf(strategy));

/**
 * Matched on payload shape, not `log_level`: the backend writes the results row
 * at level "info" (backend-go getlogs.go - backtests surface info logs), never
 * the "BACKTEST_RESULT" label the LogLevel set suggests. trades/execution_log
 * are always arrays on a real results log - check presence, not length, so a
 * genuine 0-trade backtest still matches.
 */
export const hasResultPayload = (
  payload: LogPayload | null | undefined,
): boolean =>
  !!payload &&
  (payload.trades !== undefined ||
    payload.execution_log !== undefined ||
    payload.final_balance !== undefined ||
    payload.initial_balance !== undefined);

/**
 * Status (from the trade-status poll) and this results payload (a separate
 * strategy_logs row) don't land atomically - a backtest can read COMPLETED
 * before its payload is fetched.
 */
export const findBacktestPayloadLog = (
  strategyId: string,
  logs: StrategyLog[] | undefined,
): StrategyLog | undefined =>
  (logs ?? []).find(
    l => l.strategy_id === strategyId && hasResultPayload(l.payload),
  );
