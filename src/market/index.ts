export {
  AI_PIVOT_LAYERS,
  AI_SIGNALS_MAX_BARS,
  AI_SIGNALS_MIN_CONFIDENCE,
  aiSignalsBars,
  aiSignalsRequestBars,
  closedBarsKey,
  intervalSeconds,
  isActionable,
  isLiveTrade,
  isSignalInView,
  lastBarForming,
  listSignals,
  pivotLayerSource,
  signalStatusOf,
  trackRecord,
  tradeSideOf,
} from './aiSignals.ts';
export type {
  AIPivotLayer,
  AIPivotSource,
  AISignalLists,
  AISignalStatus,
  AISignalStatusKey,
  AISignalsBars,
  AISignalTone,
  AISignalTrackRecord,
} from './aiSignals.ts';
export {
  alertFiredOn,
  alertMarksFor,
  alertsOnUnderlying,
  CHART_SERIES,
  liveMarksFor,
  NO_ALERT_MARKS,
} from './alertMarks.ts';
export type {
  AlertMarks,
  AlertMarksOptions,
  AlertPatternHit,
  AlertWatch,
  LiveMarks,
  SignalRule,
  SignalSide,
} from './alertMarks.ts';

export {readingFsm, readingLeaf} from './alertReading.ts';

export {
  appliesToEveryStock,
  buildAlert,
  clauseComplete,
  clauseFor,
  clauseFromSeed,
  clauseParts,
  dailyOnly,
  DEFAULT_CONTRACT,
  describeClause,
  formatAlertValue,
  LEVEL_CHIPS,
  levelAtPct,
  levelDirection,
  lineAt,
  MAX_BULK_ALERTS,
  MAX_CLAUSES,
  monitorFsm,
  opLabel,
  opsFor,
  opVerb,
  parseAlertValue,
  priceWarning,
  savedAlertFrom,
  TIMEFRAME_CHOICES,
  timeframeForCandle,
  usesContract,
  usesFno,
} from './alertRule.ts';
export type {
  AlertClause,
  AlertClauseSeed,
  AlertCondition,
  AlertContract,
  AlertLeaf,
  AlertLogic,
  AlertOp,
  AlertOpOption,
  AlertTimeframe,
  AlertVerb,
  BuiltAlert,
  ClauseLevel,
  ClauseParts,
  ClauseSubject,
  MonitorAction,
  MonitorFsm,
  MonitorState,
  MonitorTransition,
  TimeframeChoice,
  TrendLine,
} from './alertRule.ts';

export {
  chartIntervalLabel,
  chartIntervalMinutes,
  chartIntervalToResolution,
  isChartInterval,
  isPresetChartInterval,
  makeChartInterval,
  MAX_CUSTOM_INTERVAL_COUNT,
  parseChartInterval,
  resolutionToChartInterval,
} from './chartInterval.ts';
export type {ParsedChartInterval} from './chartInterval.ts';

export {blackScholesGreeks, impliedForward, yearsToExpiry} from './greeks.ts';
export type {OptionGreeks} from './greeks.ts';

export {
  buildFlowPair,
  FLOW_WINDOW_DAYS,
  flowDirection,
  flowVerb,
  isBuying,
  signedCrore,
} from './institutionalFlows.ts';
export type {FlowSide} from './institutionalFlows.ts';

export {
  bidValue,
  blockedAmount,
  buildFinancialSeries,
  buildIPOSchedule,
  clampShares,
  FINANCIAL_METRIC_KEYS,
  findManagingDirector,
  IPO_CATEGORIES,
  IPO_CATEGORY_CAPS,
  ipoIssueSizeCrore,
  ipoLotSize,
  ipoMinInvestment,
  isBiddable,
  lotValue,
  MAX_BIDS,
  maxLotsFor,
  minLotsFor,
} from './ipo.ts';
export type {
  FinancialBar,
  FinancialMetric,
  IPOBid,
  IPOCategory,
  IPOScheduleStep,
  IPOScheduleStepKey,
  IPOStepState,
} from './ipo.ts';

export {livePriceFor, priceSymbolFor} from './livePrice.ts';

export {
  addMarketDays,
  isMarketOpen,
  isTradingDay,
  lastSessionOpen,
  MARKET_TIMEZONE,
  marketDateString,
  marketDaysUntil,
  marketMinutesNow,
  marketToday,
  nextTradingDay,
  SESSION_CLOSE,
  SESSION_OPEN,
} from './marketHours.ts';

export {
  buildFuturesSymbol,
  FUTURES_SYMBOL_RE,
  futuresPath,
  futuresTitle,
  futuresTitleParts,
  isFuturesSymbol,
  parseFuturesSymbol,
  underlyingOf,
} from './futuresSymbol.ts';
export type {FuturesTitleParts, ParsedFuturesSymbol} from './futuresSymbol.ts';

export {
  buildOiLadder,
  buildOptionContractSymbol,
  byExpiryDate,
  computeChainSentiment,
  computeMaxPain,
  expiryPickerOptions,
  formatExpiryLabel,
  formatIv,
  formatOi,
  formatPremium,
  formatStrike,
  ivContext,
  nearestExpiry,
  optionContractLabel,
  payoffGap,
  pcrDelta,
  positionIn,
  positioningFacts,
  positioningReadout,
  positioningVerdict,
  selectAtmWindow,
  tradableChainRows,
} from './optionChain.ts';
export type {
  ChainSentiment,
  ExpiryPickerOption,
  IvContext,
  OiLadderBar,
  PositioningFact,
  PositioningInput,
  PositioningLadder,
  PositioningStance,
  PositioningVerdict,
} from './optionChain.ts';

export {
  exchangeSymbol,
  isExchangeSymbol,
  optionPath,
  readOptionContract,
} from './optionContract.ts';
export type {OptionContract, OptionContractParams} from './optionContract.ts';

export {
  costDrag,
  daysToExpiry,
  describeStructure,
  ivRead,
  legPayoff,
  marginUnlockPct,
  needsCondition,
  needsSentence,
  nextIndexExpiry,
  payoffAt,
  positionExitState,
  riskedAmount,
  structureMath,
} from './optionStructures.ts';
export type {
  CostDrag,
  IvRead,
  IvStance,
  LegChargesFn,
  NeedsCondition,
  PositionExitState,
  StructureMath,
} from './optionStructures.ts';

export {formatPeerValue, medianTone} from './peerFormat.ts';
export type {MedianTone} from './peerFormat.ts';

export {
  industryCrumbs,
  MAX_PEER_COLUMNS,
  MOST_USED_PEER_TAB,
  narrowPeerColumnsForPhone,
  PEER_COMPARE_COLUMNS,
  PEER_COMPARE_SECTIONS,
  peerCompareBars,
  peerComparePair,
  peerCompareTally,
  peerCompareWinner,
  peerPickerColumns,
  peerPinnedFrom,
  PHONE_PEER_COLUMNS,
  togglePeerColumn,
} from './peerTable.ts';
export type {PeerCompareBar, PeerCompareSectionId} from './peerTable.ts';

export {
  alertCondition,
  alertReading,
  deriveAlertName,
  draftFromAlert,
  newSavedAlertId,
} from './savedAlerts.ts';
export type {AlertDraftConfig} from './savedAlerts.ts';

export {mapSector, SECTOR_CHIPS} from './sectors.ts';
export type {CoarseSector} from './sectors.ts';

export {mapStockScore} from './stockScore.ts';

export {
  matchesStockQuery,
  rankStocksByQuery,
  stockSearchScore,
} from './stockSearch.ts';

export {buildStockSignals} from './stockSignals.ts';
export type {
  SignalInputs,
  SignalKind,
  SignalTone,
  StockSignal,
} from './stockSignals.ts';

export {
  exceedsWatchlistCap,
  freshSymbols,
  MAX_WATCHLIST_ITEMS,
  MAX_WATCHLISTS,
  pruneSections,
  upsertWatchlist,
  watchlistMembership,
  withItemsReplaced,
  withSymbolRemoved,
  withSymbolsAdded,
} from './stockWatchlists.ts';
export type {WatchlistMembership} from './stockWatchlists.ts';

export {
  extractUnderlyingSymbol,
  ipoLogoUrl,
  isFnOSymbol,
  stockLogoUrl,
} from './symbols.ts';

export {
  buildOscillators,
  computeSignalTally,
  macdHistogram,
  verdictColorKey,
} from './technicalSignal.ts';
export type {
  OscillatorSignal,
  SignalTally,
  Verdict,
} from './technicalSignal.ts';

export {rankByTopTraded} from './topTraded.ts';
export type {RankedUnderlying} from './topTraded.ts';

export {entryStatus, ladderPoints, tradeGeometry} from './tradeSetup.ts';
export type {
  EntryState,
  EntryStatus,
  LadderPoint,
  TradeGeometry,
} from './tradeSetup.ts';

export {
  barsForIndex,
  INDEX_WINDOWS,
  marketForIndex,
  windowAdvances,
  windowChange,
  windowDays,
  windowRange,
} from './worldIndexDetail.ts';
export type {
  IndexBar,
  IndexWindow,
  WindowAdvances,
  WindowChange,
  WindowRange,
} from './worldIndexDetail.ts';

export {
  buildWorldMarkets,
  formatIndexLevel,
  globalIndexNameFromParam,
  globalIndexParam,
  globalIndexPath,
  groupByRegion,
  latestWorldClose,
  parseGlobalIndexParam,
  REGION_ORDER,
} from './worldIndices.ts';
export type {Region, RegionGroup, WorldMarketRow} from './worldIndices.ts';
