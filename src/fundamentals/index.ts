export {
  ADJ_EPS_HINT,
  atTier,
  formatFamily,
  hiddenCount,
  prettifyKey,
  REPORTED_EPS_HINT,
  resolveGroups,
} from './schema.ts';
export type {
  FormatFamily,
  GroupSpec,
  LineSpec,
  ResolvedGroup,
  ResolvedLine,
  Tier,
  ValueKind,
} from './schema.ts';

export {PROFIT_LOSS_SCHEMA} from './profitLoss.ts';
export {QUARTERLY_SCHEMA} from './quarterly.ts';

export {
  annualTable,
  daysOf,
  filed,
  has,
  oldestFirst,
  or,
  orZero,
  pctOf,
  reader,
  rest,
  row,
  withChildren,
  yoy,
  zip,
} from './statementRows.ts';
export type {AnnualTable, Col, StatementRow} from './statementRows.ts';

export {buildQuarterTable} from './quarterlyResults.ts';
export type {QuarterTable} from './quarterlyResults.ts';

export {
  averageOf,
  buildProfitLossTable,
  cagr,
  materialCost,
  priceCagr,
} from './profitLossTable.ts';
export type {ProfitLossTable} from './profitLossTable.ts';

export {buildBalanceSheetTable} from './balanceSheetTable.ts';
export {buildCashFlowTable} from './cashFlowTable.ts';
export {buildRatiosTable} from './ratiosTable.ts';

export {buildEquityHistory} from './equityHistory.ts';
export type {EquityYear} from './equityHistory.ts';

export {
  OWNERSHIP_BY_CODE,
  OWNERSHIP_HEADLINE,
  OWNERSHIP_TREE,
} from './ownership.ts';
export type {OwnershipNode} from './ownership.ts';

export {
  diiConstituents,
  latestPctIndex,
  ownershipBuckets,
} from './ownershipSummary.ts';
export type {
  DiiConstituentKey,
  OwnershipBucket,
  OwnershipBucketKey,
  OwnershipConstituent,
} from './ownershipSummary.ts';

export {
  changeVsPrior,
  compactCrore,
  niceTicks,
  performanceCagr,
  performanceScale,
  periodLabel,
  toPoints,
  ttmGrowth,
} from './financialPerformance.ts';
export type {
  PerformanceFeed,
  PerformanceMeasure,
  PerformanceScale,
  PeriodPoint,
} from './financialPerformance.ts';

export {ownershipRowsAtTier, ownershipTableRows} from './ownershipTable.ts';
export type {OwnershipMeasure, OwnershipTableRow} from './ownershipTable.ts';

export {holderConcentration, isBuyDeal} from './ownershipRegister.ts';
export type {HolderBand, HolderBandKey} from './ownershipRegister.ts';

export {promoterPledge} from './promoterPledge.ts';
export type {PledgeQuarter, PromoterPledge} from './promoterPledge.ts';

export {DELIVERY_SESSIONS, deliveryTrend} from './deliveryTrend.ts';
export type {DeliverySession, DeliveryTrend} from './deliveryTrend.ts';
