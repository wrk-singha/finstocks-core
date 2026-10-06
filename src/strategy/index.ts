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
export {
  istDayOfMonth,
  istYMD,
  MIN_EDGE_SAMPLE,
  monthlyGrid,
  MONTHS_SHOWN,
  tradeReturnPct,
} from './recommendationReport.ts';
export type {MonthCell} from './recommendationReport.ts';
export {
  conflictWarning,
  findConflictingStrategies,
  strategiesMatchingSymbols,
  underlyingsOf,
} from './strategyConflicts.ts';
export {exitHint, valueHint} from './ruleHint.ts';
export {STRATEGY_INDICATOR_OPTIONS} from './strategyIndicators.ts';
export type {IndicatorPickerOption} from './strategyIndicators.ts';
export {formatLogDateTime, getTradeLogAction} from './strategyLogs.ts';
export type {LogDateTime, TradeLogAction} from './strategyLogs.ts';
export {
  ENTRY_PARTS,
  entryTokenKey,
  parseEntryTokenKey,
  parseRuleFsm,
  qtyUnit,
  ruleRepeat,
  sizingParts,
  strategyRuleParts,
  takeProfitPct,
  withEntryLeafField,
  withTakeProfitPct,
  WORDED_TIMEFRAMES,
  wordedTimeframe,
} from './strategyRuleEdit.ts';
export type {
  EntryTokenPart,
  QtyUnit,
  RuleExitPart,
  RuleRepeat,
  SizingParts,
  StrategyRuleParts,
  WordedTimeframe,
} from './strategyRuleEdit.ts';
export {
  budgetMode,
  budgetSizingMode,
  budgetVal,
  isScriptBudget,
  isScriptStrategy,
  normalizeStrategyRow,
  normalizeTradeStatus,
  strategyPositionSize,
} from './strategyBudget.ts';
export {
  buildConsoleRules,
  buildConsoleRulesDraft,
  buildScreenerStrategySpec,
  buildStrategyRules,
} from './strategyRules.ts';
export type {StrategyRule, StrategyRuleOptions} from './strategyRules.ts';
export {
  BACKTEST_PERIODS,
  BACKTEST_STALLED_AFTER_MS,
  backtestDates,
  CARD_HIGHLIGHT_RUN,
  clampPeriod,
  DEFAULT_BACKTEST_PERIOD,
  isDeploymentOpen,
  isPeriodAllowed,
  maxPeriod,
  periodForWindow,
  runAgeMs,
  snapshotRuns,
} from './strategyRunOptions.ts';
export type {
  BacktestPeriodOption,
  StrategyRunRow,
} from './strategyRunOptions.ts';
export {
  extractSetupConfig,
  isScriptCard,
  normalizeSetupKey,
  SCRIPT_ENTRY_C,
  scriptRunOf,
  setupConfig,
  termsToConfig,
} from './strategySetupConfig.ts';
export type {SetupConfig, SetupTerms} from './strategySetupConfig.ts';
export {
  replaceAction,
  scriptAction,
  STRATEGY_ACTION_BY_KIND,
  strategyActionRefusal,
} from './strategyAction.ts';
export type {StrategyActionRefusal} from './strategyAction.ts';
export {
  BACKTEST_STATUSES,
  findBacktestPayloadLog,
  hasResultPayload,
  isAwaitingStart,
  isBacktestInProgress,
  isCompletedBacktest,
  isConsoleActive,
  isInProgress,
  isPaused,
  isTerminalStatus,
  LIVE_OPEN_STATUSES,
  runStateOf,
  statusOf,
  TERMINAL_STATUSES,
} from './strategyStatus.ts';
export type {
  ConsoleActiveSource,
  StrategyRunState,
  StrategyStatusSource,
} from './strategyStatus.ts';
export {
  normalizeStrategyTimeframe,
  STRATEGY_TIMEFRAMES,
} from './strategyTimeframes.ts';
export type {StrategyTimeframe} from './strategyTimeframes.ts';
export {
  applyLibraryFilters,
  countActiveLibraryFilters,
  DEFAULT_LIBRARY_FILTERS,
  nextLibrarySort,
  presentValues,
  scopeLibrary,
  sortLibrary,
  viewLibrary,
} from './libraryFilters.ts';
export type {
  LibraryFilterState,
  LibraryHorizonFilter,
  LibraryScope,
  LibrarySort,
} from './libraryFilters.ts';
export {
  backtestPreview,
  clampRisk,
  isReference,
  LIBRARY_COMPLEXITIES,
  LIBRARY_COMPLEXITY_LABEL,
  LIBRARY_DIRECTION_LABEL,
  LIBRARY_EXCHANGE_CATEGORY_LABEL,
  LIBRARY_HORIZON_LABEL,
  LIBRARY_HORIZONS,
  LIBRARY_SEGMENT_LABEL,
  LIBRARY_STYLE_LABEL,
  libraryChatContext,
  libraryChatMessage,
  RISK_LEVELS,
  riskDrivers,
  riskLabel,
  riskShort,
  riskTone,
} from './strategyLibrary.ts';
export type {LibraryChatIntent} from './strategyLibrary.ts';
