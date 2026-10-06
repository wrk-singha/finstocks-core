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
  dailyReturns,
  equityCurve,
  monteCarlo,
  monthlyReturns,
  picksByReview,
  summarize,
  TRADING_DAYS_PER_YEAR,
  yearlyReturns,
  yearsBetween,
} from './basketBacktest.ts';
export type {
  BacktestSummary,
  CurvePoint,
  MonteCarloBand,
  MonthCell as BasketMonthCell,
  PeriodReturn,
} from './basketBacktest.ts';
export {basketCharges} from './basketCharges.ts';
export type {BasketCharges} from './basketCharges.ts';
export {esfSubscribeRefusal} from './basketSubscribe.ts';
export type {
  EsfSubscribeRefusal,
  EsfSubscribeRefusalKind,
} from './basketSubscribe.ts';
export {
  awaitingFirstOrders,
  basketHeadline,
  BENCHMARK_LABEL,
  cadenceLabel,
  DEFAULT_CAPITAL,
  marketLabel,
  minAmountHint,
  MODE_LABEL,
  navChange,
  navSummary,
  ORDER_STATUS,
  reviewPeriodLabel,
  reviewPeriodsLabel,
  planBasketBuy,
  primaryBacktest,
  reviewDayLabel,
  stockCountLabel,
  subscriptionStatusLabel,
  trackingStart,
  volatilityLabel,
  weightLabel,
} from './basketFormat.ts';
export type {
  BasketBuyLine,
  BasketBuyPlan,
  BasketHeadline,
  EsfOrderTone,
  NavSummary,
} from './basketFormat.ts';
export {
  formatTopPct,
  MARKET_LABELS,
  STAGE_CYCLE,
  stageCycle,
  stageLabel,
  stageName,
  warningText,
} from './esfScore.ts';

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

export {depthBookStatus, depthRefusal, fairLimitPrice} from './depthReading.ts';
export type {DepthBookStatus, DepthRefusal} from './depthReading.ts';

export {livePriceFor, priceSymbolFor} from './livePrice.ts';

export {
  bareLabel,
  capBandLabel,
  citedFacts,
  citesLine,
  coverageGroups,
  coveragePct,
  factHistoryText,
  factText,
  factUnit,
  factUnitWord,
  figureRows,
  fiscalYears,
  gapStatusWord,
  gateTally,
  historyTable,
  isQualityGood,
  kpiGapLine,
  kpiTrail,
  kpiValueText,
  monitorChips,
  partTally,
  partTitle,
  qualityGoodCount,
  REPORT_BAND_LABEL,
  REPORT_GAP_STATUS_WORDS,
  REPORT_MARK_GLYPH,
  REPORT_MARK_WORD,
  REPORT_STAGES,
  REPORT_STOP_WORD,
  REPORT_VIEW_LABEL,
  reportBenchmark,
  reportDay,
  reportFactIndex,
  reportKeyFigures,
  reportNumber,
  reportSector,
  reportShortName,
  riskChainSteps,
  signedChangeText,
  sparkPoints,
  typographicMinus,
} from './manualReport.ts';
export type {
  ReportCoverageGroup,
  ReportCoverageRow,
  ReportFigureRow,
  ReportHistoryTable,
  ReportKeyFigure,
  ReportStageWords,
} from './manualReport.ts';

export {
  addMarketDays,
  hasHolidayCalendar,
  isMarketOpen,
  isTradingDay,
  lastSessionOpen,
  MARKET_TIMEZONE,
  marketDateString,
  marketDaysUntil,
  marketMinutesNow,
  marketSession,
  marketToday,
  nextTradingDay,
  PRE_OPEN_START,
  SESSION_CLOSE,
  SESSION_OPEN,
} from './marketHours.ts';

export {expiryCalendar, NSE_TUESDAY_EXPIRY_FROM} from './expiryDays.ts';
export type {ExpiryCalendar, ExpiryDay} from './expiryDays.ts';

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

export {
  beatingBenchmark,
  indexName,
  lossesAt,
  namesOf,
  pfExtent,
  pfLastColumnBoxes,
  pfRatioChange,
  pfSpans,
  pickRow,
  resolvePair,
  resultsAt,
  RS_BENCHMARK,
  RS_BOXES,
  RS_DEFAULT_BOX,
  RS_PAIR_COLUMNS,
  RS_TOP_N,
  rsShortLabel,
  splitResults,
  staleDays,
} from './rsSectorMatrix.ts';
export type {PfSpan, RsResult} from './rsSectorMatrix.ts';

export {
  breadthCounts,
  canChart,
  chartExtent,
  chartTicks,
  chartXTicks,
  clockOf,
  hasRegime,
  isBearish,
  isBullish,
  fractionPct,
  ivPointsOf,
  latestDecay,
  REGIME_LABEL,
  REGIME_ORDER,
  REGIME_READING,
  REGIME_SHORT,
  regimeChangedSince,
  regimeDistribution,
  regimeKey,
  regimeMap,
  regimeRowFor,
  regimeStamp,
  regimeTone,
  sessionOverview,
  signed,
  signedFixed,
  zBiasRegime,
} from './regimePulse.ts';
export type {
  ChartExtent,
  RegimeLean,
  RegimeStamp,
  RegimeTone,
  SessionMark,
  SessionOverview,
} from './regimePulse.ts';

export {
  filterRegimeRows,
  REGIME_DEFAULT_SORT,
  REGIME_SORT_KEYS,
  regimeScannerStatus,
  regimeSortStartsDescending,
  sortRegimeRows,
} from './regimeScanner.ts';
export type {RegimeScannerStatus, RegimeSortKey} from './regimeScanner.ts';

export {scannerSortStartsDescending, sortScannerRows} from './scannerSort.ts';
export type {ScannerSortSpec} from './scannerSort.ts';

export {
  clashesWithRegime,
  DIRECTION_DEFAULT_SORT,
  DIRECTION_PRESETS,
  DIRECTION_SORT_KEYS,
  DIRECTION_UNIVERSES,
  directionBreadth,
  directionPreset,
  directionScannerStatus,
  directionSortStartsDescending,
  directionUniverseRows,
  filterDirectionRows,
  inDirectionUniverse,
  NEAR_WALL_PCT,
  sortDirectionRows,
} from './directionScanner.ts';
export type {
  DirectionBreadth,
  DirectionPreset,
  DirectionPresetKey,
  DirectionScannerStatus,
  DirectionSortKey,
  DirectionUniverse,
} from './directionScanner.ts';

export {
  callWallSide,
  DIRECTION_LABEL,
  DIRECTION_ORDER,
  DIRECTION_SHORT,
  directionSide,
  disagreesWithRegime,
  GEX_REGIME_LABEL,
  GEX_REGIME_READING,
  gexTone,
  isThin,
  isWarmingUp,
  levelOf,
  levelsReading,
  levelsReadingParts,
  nearestWall,
  nearestWallText,
  OI_NOTE,
  parseWidthVotes,
  PATTERN_LABEL,
  PATTERN_READING,
  pctAway,
  pendingDirection,
  putWallSide,
  THIN_WIDTHS,
} from './flyone.ts';
export type {GexTone, LevelsReadingParts, WallSide} from './flyone.ts';

export {
  densityView,
  gexBarsView,
  gexTickEvery,
  isShownExpiry,
  nearestPointIndex,
  timelineIndexAt,
  timelineScoreY,
  timelineTicks,
} from './flyoneDetail.ts';
export type {DensityPoint, DensityView, GexBarsView} from './flyoneDetail.ts';

export {
  parseSectorStrengthPath,
  SECTOR_STRENGTH_ANCHOR,
  sectorStrengthPath,
} from './sectorStrength.ts';
export type {SectorStrengthLink} from './sectorStrength.ts';

export {
  isManualPagePath,
  MANUAL_PAGE_PREFIX,
  manualPageSlug,
  manualPageSlugOfUrl,
  manualPageTitle,
  manualPageUrl,
} from './manualPages.ts';
