export {
  buildPnlSeries,
  DEFAULT_START_CAPITAL,
  deriveAutopilotCard,
  deriveStrategyCards,
  resolveStrategyChartSymbol,
} from './activeStrategies.ts';
export type {
  AutopilotCardData,
  StrategyCardData,
  StrategyPosition,
  StrategyStatusLabel,
} from './activeStrategies.ts';
export {
  BACKTEST_CHART_H,
  BACKTEST_CHART_W,
  buildBacktestEquity,
  buildBacktestStatItems,
  buildEquityPath,
  calculateBacktestSummary,
  computeMaxDrawdownAmount,
  computeMaxRealizedDrawdown,
  computeSharpeEstimate,
  computeTradeReturnPct,
  DEFAULT_STARTING_CAPITAL,
  EQUITY_CHART_H,
  EQUITY_CHART_W,
} from './backtestStats.ts';
export type {BacktestStatItem, EquityPath, StatTone} from './backtestStats.ts';
export {buildSweepCurves, prepareSweep} from './backtestSweep.ts';
export type {
  PreparedVariant,
  SweepCurve,
  SweepSeries,
} from './backtestSweep.ts';
export {
  chartSymbolFor,
  strategyMeta,
  toActivityRows,
  toClosedConsolePosition,
  toConsolePosition,
} from './consoleRows.ts';
export {projectRawFsm} from './fsmProjection.ts';
export {istDayOfMonth, istYMD, tradeReturnPct} from './recommendationReport.ts';
export {
  conflictWarning,
  findConflictingStrategies,
} from './strategyConflicts.ts';
export {exitHint, valueHint} from './ruleHint.ts';
export {STRATEGY_INDICATOR_OPTIONS} from './strategyIndicators.ts';
export type {IndicatorPickerOption} from './strategyIndicators.ts';
export {formatLogDateTime, getTradeLogAction} from './strategyLogs.ts';
export type {LogDateTime, TradeLogAction} from './strategyLogs.ts';
export {
  buildConsoleRules,
  buildConsoleRulesDraft,
  buildScreenerStrategySpec,
  buildStrategyRules,
} from './strategyRules.ts';
export type {StrategyRule, StrategyRuleOptions} from './strategyRules.ts';
export {
  extractSetupConfig,
  normalizeSetupKey,
  setupConfig,
  termsToConfig,
} from './strategySetupConfig.ts';
export type {SetupConfig, SetupTerms} from './strategySetupConfig.ts';
export {
  BACKTEST_STATUSES,
  findBacktestPayloadLog,
  hasResultPayload,
  isAwaitingStart,
  isBacktestInProgress,
  isCompletedBacktest,
  isInProgress,
  isPaused,
  isTerminalStatus,
  LIVE_OPEN_STATUSES,
  statusOf,
  TERMINAL_STATUSES,
} from './strategyStatus.ts';
export type {StrategyStatusSource} from './strategyStatus.ts';
export {
  normalizeStrategyTimeframe,
  STRATEGY_TIMEFRAMES,
} from './strategyTimeframes.ts';
export type {StrategyTimeframe} from './strategyTimeframes.ts';
