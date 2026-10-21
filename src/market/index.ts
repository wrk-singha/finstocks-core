export {
  AI_PIVOT_LAYERS,
  AI_SIGNALS_MAX_BARS,
  AI_SIGNALS_MIN_CONFIDENCE,
  aiSignalsBars,
  aiSignalsRequestBars,
  closedBarsKey,
  intervalSeconds,
  isActionable,
  isAlertable,
  isLiveTrade,
  isSignalInView,
  lastBarForming,
  listSignals,
  pivotLayerSource,
  signalAlertSeed,
  signalStatusOf,
  trackRecord,
  tradeSideOf,
} from './aiSignals.ts';
export type {
  AIPivotLayer,
  AIPivotSource,
  AISignalAlertSeed,
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
  alertPatternHits,
  alertPatternWatches,
  alertsOnUnderlying,
  CHART_SERIES,
  liveMarksFor,
  NO_ALERT_MARKS,
} from './alertMarks.ts';
export type {
  AlertMarks,
  AlertMarksOptions,
  AlertPatternHit,
  AlertPatternWatch,
  AlertWatch,
  LiveMarks,
  SignalRule,
  SignalSide,
} from './alertMarks.ts';

export {
  appliesToEveryStock,
  buildAlert,
  clauseComplete,
  clauseFor,
  clauseFromSeed,
  clausesFromCondition,
  clauseParts,
  dailyOnly,
  DEFAULT_CONTRACT,
  describeClause,
  fitOp,
  formatAlertValue,
  isFnoAlert,
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
  timeframeChoice,
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

export {
  ACTION_GROUPS,
  actionGroupOf,
  buildCorporateActions,
  buildExchangeFilings,
  CAPITAL_FAMILIES,
  capitalActionsByYear,
  dividendKey,
  eventTime,
  familyOf,
  filingKind,
  filingTitle,
  groupCorporateActions,
  isValidDate,
} from './corporateActions.ts';
export type {
  ActionGroup,
  ActionGroupKey,
  CapitalAction,
  CorporateActionFeeds,
} from './corporateActions.ts';

export {
  customIndicatorDefinition,
  customIndicatorMatches,
  customIndicatorSaveRequest,
  isSavedVersion,
  replaceCustomIndicator,
  savedCustomIndicator,
  upsertCustomIndicator,
} from './customIndicators.ts';

export {
  annualisedReturn,
  dailyReturns,
  equityCurve,
  monteCarlo,
  monthlyReturns,
  summarize,
  TRADING_DAYS_PER_YEAR,
  yearlyReturns,
  yearlyVersus,
  yearsBetween,
} from './basketBacktest.ts';
export type {
  BacktestDay,
  BacktestSummary,
  CurvePoint,
  MonteCarloBand,
  MonthCell as BasketMonthCell,
  PeriodReturn,
  YearVersus,
} from './basketBacktest.ts';

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
  FNO_HISTORY_START,
  formatSessionDate,
  hasHolidayCalendar,
  isMarketOpen,
  isTradingDay,
  lastSessionOpen,
  latestSession,
  MARKET_TIMEZONE,
  marketDateString,
  marketDaysUntil,
  marketMinutesNow,
  marketMoment,
  marketToday,
  minuteLabel,
  nextTradingDay,
  SESSION_CLOSE,
  SESSION_OPEN,
  sessionFor,
  stepSession,
} from './marketHours.ts';
export type {MarketMoment, TradingSession} from './marketHours.ts';

export {
  breadthOf,
  buildHeatModel,
  FOLD_PREFIX,
  foldTail,
  HEAT_BIN_COUNT,
  HEAT_COLORS,
  HEAT_COLUMNS,
  HEAT_FAST_COLUMNS,
  HEAT_GROUPS,
  HEAT_MIN_TILE_AREA,
  HEAT_PERIODS,
  HEAT_SIZES,
  HEAT_SKELETON_WEIGHTS,
  heatBin,
  heatBreadth,
  heatPalette,
  heatStep,
  heatThresholdLabels,
  heatThresholds,
  heatWeights,
  isListSource,
  layoutHeat,
  MARKET_SOURCES,
  neighbourTile,
  periodOf,
  SECTOR_SHORT,
  sectorOfIndustry,
  sectorWeight,
  stockWeight,
  swatchFor,
  UNMAPPED_SECTOR,
  weightedReturn,
} from './sectorHeatmap.ts';
export type {
  FoldedItems,
  HeatBreadth,
  HeatColorBy,
  HeatDirection,
  HeatFrameRect,
  HeatGroupBy,
  HeatLayout,
  HeatLayoutItem,
  HeatModel,
  HeatPalette,
  HeatPeriod,
  HeatPeriodSpec,
  HeatRow,
  HeatSector,
  HeatSectorRef,
  HeatSizeBy,
  HeatSource,
  HeatSourceOption,
  HeatStock,
  HeatSwatch,
  HeatTheme,
  HeatTileRect,
  HeatUniverse,
  HeatWeights,
} from './sectorHeatmap.ts';

export {
  buildReplay,
  DEFAULT_REPLAY_INTERVAL,
  REPLAY_INTERVALS,
  replayClock,
  replayIntervalOf,
  replayReturns,
  sliceReplay,
  spansDays,
  withReplayReturns,
} from './heatReplay.ts';
export type {
  ReplayFrames,
  ReplayInterval,
  ReplayIntervalSpec,
} from './heatReplay.ts';

export {treemap} from './treemap.ts';
export type {TreemapRect} from './treemap.ts';

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
  atmRowOf,
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
  oiTotals,
  optionContractLabel,
  payoffGap,
  pcrDelta,
  positionIn,
  positioningFacts,
  positioningReadout,
  positioningVerdict,
  selectAtmWindow,
  straddlePremium,
  strikeIv,
  tradableChainRows,
} from './optionChain.ts';
export type {
  ChainSentiment,
  ExpiryPickerOption,
  IvContext,
  OiLadderBar,
  OiTotals,
  PositioningFact,
  PositioningInput,
  PositioningLadder,
  PositioningStance,
  PositioningVerdict,
} from './optionChain.ts';

export {
  catalogueWeekday,
  dayMs,
  exchangeSymbol,
  expiryCycle,
  isExchangeSymbol,
  MAX_HOLIDAY_SHIFT_DAYS,
  monthLastExpiries,
  monthlyExpiries,
  optionContractOf,
  optionPath,
  parseOptionSymbol,
  readOptionContract,
} from './optionContract.ts';
export type {
  OptionContract,
  OptionContractParams,
  ParsedOptionSymbol,
} from './optionContract.ts';

export {
  expiryChips,
  expiryInstant,
  expiryRole,
  hasWeeklies,
  liveExpiries,
} from './expiryKit.ts';
export type {ExpiryChip, ExpiryChipKind} from './expiryKit.ts';

export {
  costDrag,
  daysToExpiry,
  describeStructure,
  fnoIdeaHold,
  ideaFigure,
  ideaLotSize,
  isLiveIdea,
  ivRead,
  legPayoff,
  marginUnlockPct,
  needsCondition,
  needsSentence,
  nextIndexExpiry,
  payoffAt,
  positionExitState,
  riskedAmount,
  structureHold,
  structureMath,
} from './optionStructures.ts';
export type {
  CostDrag,
  FnoIdeaHold,
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
  cvdPath,
  groupScreens,
  ladderMarkers,
  ladderRows,
  latestReading,
  nearestLevels,
  profileInstrumentKey,
  rowContains,
  rowInValue,
  spreadLabels,
  VALUE_POSITION_COPY,
  valuePosition,
} from './profileView.ts';
export type {
  LadderMarker,
  LadderRow,
  LadderTag,
  ValuePosition,
} from './profileView.ts';

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
export {mulberry32, percentileSorted} from './sampling.ts';

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
  clearedItems,
  exceedsWatchlistCap,
  FLAG_COLORS,
  flagCounts,
  flaggedSymbols,
  flagsBySymbol,
  freshSymbols,
  hasSection,
  MAX_WATCHLIST_ITEMS,
  MAX_WATCHLISTS,
  pruneSections,
  sharedWatchlistPath,
  upsertWatchlist,
  watchlistMembership,
  withFlag,
  withItemsReplaced,
  withoutSection,
  withSectionRenamed,
  withSymbolMoved,
  withSymbolRemoved,
  withSymbolsAdded,
} from './stockWatchlists.ts';
export type {WatchlistMembership} from './stockWatchlists.ts';
export {
  CSV_BOM,
  csvCell,
  exportFileName,
  parseWatchlistFile,
  WATCHLIST_COLUMNS,
  WATCHLIST_TABS,
  watchlistCsv,
  watchlistTxt,
} from './watchlistExport.ts';
export type {
  WatchlistColumn,
  WatchlistColumnKey,
  WatchlistTab,
} from './watchlistExport.ts';

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

export {
  POSITION_RUPEES,
  positionQty,
  resolveRecommendation,
} from './recommendationResolve.ts';
export type {
  RecommendationCandle,
  RecommendationResolution,
  RecommendationZone,
  ResolveRecommendationInput,
} from './recommendationResolve.ts';
export {
  isUsableCandle,
  liveClosedOutcome,
  liveResolution,
  liveResolutionOver,
  mergeResolverCandles,
  outcomeOf,
  resolverCandles,
  resolverCandlesFrom,
  withLiveResolution,
} from './recommendationView.ts';
export type {ClosedOutcome, ResolverCandles} from './recommendationView.ts';

export {rankByTopTraded} from './topTraded.ts';
export type {RankedUnderlying} from './topTraded.ts';

export {
  entryStatus,
  isPickExpired,
  ladderPoints,
  tradeGeometry,
} from './tradeSetup.ts';
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
