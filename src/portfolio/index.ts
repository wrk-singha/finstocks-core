export {
  calculateHoldTime,
  calculatePNL,
  deriveHoldingSymbols,
  extractStrategyId,
  filterTradesForMode,
  formatDateString,
  formatTradeTime,
  getExecutionStrategyDisplay,
  getExecutionStrategyName,
  getLogBadgeColor,
  getPnlBasisLabel,
  getStrategyIdForDisplay,
  getStrategyNumber,
  getTradeEntryPrice,
  getTradePremium,
  getTradeQuantityDisplay,
  intradayStrategyIdSet,
  isFnOStrategy,
  isFnOTrade,
  isHoldingTrade,
  isManualTrade,
  isPositionTrade,
  isSameDayBuy,
  isShortPosition,
  matchesSegment,
  matchesTradeMode,
} from './portfolio.ts';
export type {PortfolioSegment, TradePremium} from './portfolio.ts';

export {
  computeDayChange,
  quoteFromSeries,
  getCurrentPriceFromGraphData,
  getRawSeriesFromGraphData,
} from './holdingsPricing.ts';
export type {
  DayChange,
  PricePoint,
  PriceSeriesBySymbol,
} from './holdingsPricing.ts';

export {hexToRgba, plTone, shade} from './plWash.ts';
export type {PlTone} from './plWash.ts';

export {
  buildCashFlows,
  clipToRange,
  contributionBySymbol,
  dayKey,
  latestCloseBySymbol,
  portfolioSeries,
  symbolSeries,
  toPercentSeries,
  totalsFrom,
  unitisedNavSeries,
  xirr,
} from './netWorth.ts';
export type {
  CashFlow,
  NetWorthSeries,
  NetWorthTotals,
  SeriesPoint,
  SymbolContribution,
} from './netWorth.ts';

export {preTradeNote} from './behaviourMirror.ts';
export type {PreTradeNoteInput} from './behaviourMirror.ts';

export {
  applyPerfFilter,
  applySearchFilter,
  applyStrategyFilter,
  buildStrategyOptions,
  filterRelevantTrades,
  flipSortDir,
  sortHoldings,
  sortPositions,
  strategyKeyOf,
} from './holdingsFilters.ts';
export type {
  DateRange,
  FilterableHolding,
  HoldingSortField,
  PerfFilter,
  RelevantTradeOptions,
  SortableHolding,
  SortablePosition,
  SortDir,
  SortUnit,
  StrategyFilterOption,
} from './holdingsFilters.ts';

export {
  calculateInvestedValue,
  computeDayRealized,
  computeDayUnrealized,
  computeMarkedTotals,
  computePortfolioMetrics,
} from './portfolioSummary.ts';
export type {
  AutopilotStatus,
  DayPricedRow,
  InvestableStrategy,
  InvestedValue,
  MarkedTotals,
  PortfolioMetrics,
} from './portfolioSummary.ts';

export {
  bandPath,
  domainOf,
  donutArc,
  linePath,
  scaleX,
  scaleY,
  valueTicks,
  yearLabels,
} from './portfolioSimChart.ts';
export type {Scale} from './portfolioSimChart.ts';
