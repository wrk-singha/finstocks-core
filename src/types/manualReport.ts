// A stock's research report (llm graph/nodes/report): Finstocks research guidance for its industry
// and its cap band applied item by item. Every item carries a mark; "not_available" is an honest
// answer when our data cannot settle it, and a KPI we cannot compute carries its gap. Arrives in
// the chat `report` card; there is no endpoint.

export type ReportMark = 'pass' | 'fail' | 'mixed' | 'not_available';

export interface ReportItem {
  id: string;
  text: string;
  mark: ReportMark;
  facts: string[];
  note: string;
}

export type ReportGapStatus = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** A KPI or data point we cannot fill, in the guidance's own words. */
export interface ReportGap {
  status: ReportGapStatus;
  label: string;
  needs: string;
  sources: string[];
  proxy: string;
  refresh: string;
}

export interface ReportHistoryPoint {
  period: string;
  value: number;
}

export interface ReportKpi extends ReportItem {
  name: string;
  formula: string;
  good: string;
  warn: string;
  why: string;
  value?: number;
  unit?: string;
  period?: string;
  history?: ReportHistoryPoint[];
  gap?: ReportGap;
}

export interface ReportCardSection {
  num: string;
  title: string;
  tier?: string;
  checks: ReportItem[];
}

export type ReportStageNumber = 1 | 2 | 3 | 4;

export interface StageResult {
  as_of: string;
  stage: ReportStageNumber;
  confirmed: boolean;
  close: number;
  ma50: number;
  ma200: number;
  conditions: {name: string; met: boolean}[];
  name?: string;
  ma200_slope_pct?: number;
  volume_ratio?: number;
  rs?: {change_pct: number; rising: boolean} | null;
}

export type ReportCapBand = 'large' | 'mid' | 'small' | 'unknown';

export interface ReportManual {
  id?: string;
  name?: string;
  page?: string;
  rev?: string;
  reason?: string;
  parent?: {id: string; name: string; page: string};
}

export interface ReportCap {
  band: ReportCapBand;
  rank: number | null;
  ranked_of: number | null;
  mcap_cr: number | null;
  as_of: string;
  rule: string;
  overlay?: string;
  page?: string;
  cards: ReportCardSection[];
}

export interface ReportPart {
  no: string;
  title?: string;
  cards: ReportCardSection[];
}

export interface ReportStage {
  benchmark: string;
  available: boolean;
  reason?: string;
  checks: ReportItem[];
  used?: {requested: string; used: string; priced: boolean};
  result?: StageResult | null;
}

export interface ReportGateSummary {
  stops_hit: string[];
  stops_total: number;
  stops_unchecked: number;
  go_met: number;
  go_total: number;
  go_unchecked: number;
  go_missed: string[];
}

export interface ReportGate {
  stop: ReportItem[];
  go: ReportItem[];
  summary: ReportGateSummary;
}

export interface ReportDataRequirement {
  item: string;
  served: boolean;
  gap?: ReportGap;
}

export interface ReportCoverage {
  items: number;
  settled: number;
  not_available: number;
}

export interface ManualReportPayload {
  symbol: string;
  company: string;
  industry: string;
  manual: ReportManual;
  cap: ReportCap;
  scorecard: ReportKpi[];
  parts: ReportPart[];
  inversion: {text: string; checks: ReportItem[]};
  stage: ReportStage;
  gate: ReportGate;
  data_requirements: ReportDataRequirement[];
  coverage: ReportCoverage;
  facts?: ReportFact[];
  /** The view, decided by code from the red flags and the trend; the same on card, note and answer. */
  verdict?: ReportVerdict;
  /** The end-user research note; absent when it could not be written cleanly. */
  note?: ResearchNote | null;
  industry_guide?: IndustryGuide;
}

export type ReportViewKind = 'avoid' | 'watch' | 'buy' | 'wait';

export interface ReportVerdict {
  kind: ReportViewKind;
  line: string;
}

/** A figure the report was built on, with its recent history where it has one. */
export interface ReportFact {
  key: string;
  label: string;
  period: string;
  value: number;
  history?: ReportHistoryPoint[];
}

export interface IndustryGuide {
  one_liner?: string;
  value_drivers?: string[];
  cycle?: string;
  valuation?: {
    primary: string[];
    avoid: string[];
    discount_rate: string;
    notes: string;
  };
}

/** The research note an investor reads: findings, why they matter, and what could change them. */
export interface ResearchNote {
  lead: string;
  lead_bullets: string[];
  strengths: {title: string; text: string}[];
  watch: {title: string; text: string; table_keys?: string[]}[];
  trend_text: string;
  industry: {area: string; questions: string[]}[];
  quality: {area: string; status: string; text: string}[];
  valuation_text: string;
  improve: string[];
  worsen: string[];
  size_question: string;
  size_evidence: string[];
  risks: {name: string; chain: string}[];
  known: string[];
  needs: string[];
  sources_line: string;
  takeaway: {why: string; why_not: string; monitor: string};
}
