import type {
  ManualReportPayload,
  ReportFact,
  ReportGap,
  ReportGapStatus,
  ReportGateSummary,
  ReportHistoryPoint,
  ReportKpi,
  ReportMark,
  ReportStageNumber,
  ReportViewKind,
  ResearchNote,
} from '../types/manualReport.ts';

// What the research report page says of a mark, a view, a stage and a gap's status: the report's
// vocabulary, as web's ResearchReport and ManualReportCard carry it.

export const REPORT_MARK_GLYPH: Readonly<Record<ReportMark, string>> = {
  pass: '✓',
  fail: '✕',
  mixed: '◐',
  not_available: '–',
};

/** What a mark says of a check or a key metric. */
export const REPORT_MARK_WORD: Readonly<Record<ReportMark, string>> = {
  pass: 'Meets',
  fail: 'Falls short',
  mixed: 'Partly',
  not_available: 'No data',
};

/** What a mark says of a red flag: a pass is one that is not present. */
export const REPORT_STOP_WORD: Readonly<Record<ReportMark, string>> = {
  pass: 'Not present',
  fail: 'Present',
  mixed: 'Unclear',
  not_available: 'No data',
};

export const REPORT_VIEW_LABEL: Readonly<Record<ReportViewKind, string>> = {
  watch: 'Watch',
  buy: 'Buy candidate',
  avoid: 'Avoid',
  wait: 'Wait',
};

/** The cap band as the chat card names it, an unknown band included. */
export const REPORT_BAND_LABEL: Readonly<
  Record<ManualReportPayload['cap']['band'], string>
> = {
  large: 'Large cap',
  mid: 'Mid cap',
  small: 'Small cap',
  unknown: 'Band unknown',
};

export type ReportStageWords = {
  readonly name: string;
  readonly action: string;
};

export const REPORT_STAGES: Readonly<
  Record<ReportStageNumber, ReportStageWords>
> = {
  1: {name: 'Basing', action: 'Watch list'},
  2: {name: 'Advancing', action: 'The buy zone'},
  3: {name: 'Topping', action: 'Reassess'},
  4: {name: 'Declining', action: 'Avoid or exit'},
};

export const REPORT_GAP_STATUS_WORDS: Readonly<
  Record<ReportGapStatus, string>
> = {
  A: 'From our data',
  B: 'Exchange filings, not yet read',
  C: 'Company reports, not yet extracted',
  D: 'Public source, not yet fetched',
  E: 'Paid data; free proxy',
  F: 'Not disclosed; estimate',
};

/** The words for a gap's status; a status the table does not know reads as itself. */
export const gapStatusWord = (status: string): string =>
  (REPORT_GAP_STATUS_WORDS as Partial<Record<string, string>>)[status] ??
  status;

const REPORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// Hoisted: the figures table formats every cell with these.
const reportFormatters = new Map<number, Intl.NumberFormat>();
const formatterFor = (decimals: number): Intl.NumberFormat => {
  let formatter = reportFormatters.get(decimals);
  if (formatter === undefined) {
    formatter = new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: decimals,
    });
    reportFormatters.set(decimals, formatter);
  }
  return formatter;
};

/** A report figure as the page prints it: Indian grouping, at most `decimals` places, none forced. */
export const reportNumber = (value: number, decimals = 2): string =>
  formatterFor(decimals).format(value);

/** A leading hyphen-minus as the typographic minus the page sets figures in. */
export const typographicMinus = (text: string): string =>
  text.replace(/^-/, '−');

/** The unit a figure's label ends in: "(%)" and "(x)" are printed against the number. */
export const factUnit = (label: string): '' | '%' | 'x' =>
  /\(%\)\s*$/.test(label) ? '%' : /\(x\)\s*$/.test(label) ? 'x' : '';

/** The unit in a label's trailing parenthesis when it is not one printed against the number. */
export const factUnitWord = (label: string): string | undefined =>
  factUnit(label) === '' ? /\(([^)]*)\)\s*$/.exec(label)?.[1] : undefined;

/** A figure's label without its trailing unit. */
export const bareLabel = (label: string): string =>
  label.replace(/\s*\([^)]*\)\s*$/, '');

/** A fact's value with its unit: "18.4%", "2.1x", "1,240". */
export const factText = (fact: ReportFact): string =>
  typographicMinus(reportNumber(fact.value)) + factUnit(fact.label);

/** One of a fact's history values, in the fact's own unit. */
export const factHistoryText = (fact: ReportFact, value: number): string =>
  typographicMinus(reportNumber(value)) + factUnit(fact.label);

/** A key metric's value with its unit: "%" and "x" close up, any other unit follows a space. */
export const kpiValueText = (value: number, unit?: string): string =>
  typographicMinus(reportNumber(value)) +
  (unit === '%' || unit === 'x'
    ? unit
    : unit !== undefined && unit !== ''
      ? ` ${unit}`
      : '');

/** A signed percentage change: "+3.2%", "−1.4%". */
export const signedChangeText = (value: number): string =>
  `${value >= 0 ? '+' : ''}${typographicMinus(reportNumber(value))}%`;

/** "2026-09-30" as "30 Sep 2026"; anything else as it came, and nothing for nothing. */
export const reportDay = (date?: string | null): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  return match
    ? `${Number(match[3])} ${REPORT_MONTHS[Number(match[2]) - 1]} ${match[1]}`
    : (date ?? '');
};

/** The company without its "Limited". */
export const reportShortName = (company: string): string =>
  company.replace(/ Limited$/, '');

/** "Large cap", "Mid cap", "Small cap"; nothing for an unknown band. */
export const capBandLabel = (
  band: ManualReportPayload['cap']['band'],
): string =>
  band === 'unknown'
    ? ''
    : `${band[0]?.toUpperCase() ?? ''}${band.slice(1)} cap`;

/** The benchmark the stage was read against: the one used in place of the one asked, else the one asked. */
export const reportBenchmark = (stage: ManualReportPayload['stage']): string =>
  stage.used?.used !== undefined && stage.used.used !== ''
    ? stage.used.used
    : stage.benchmark;

/** "Parent · Industry", as much of it as the guidance names. */
export const reportSector = (manual: ManualReportPayload['manual']): string =>
  [manual.parent?.name, manual.name]
    .filter((part): part is string => part !== undefined && part !== '')
    .join(' · ');

/** The report's facts by key. */
export const reportFactIndex = (
  facts: readonly ReportFact[] | undefined,
): ReadonlyMap<string, ReportFact> =>
  new Map((facts ?? []).map(fact => [fact.key, fact]));

/** The facts a check cites, in the order it cites them, dropping any the report does not carry. */
export const citedFacts = (
  index: ReadonlyMap<string, ReportFact>,
  keys: readonly string[] | undefined,
): ReportFact[] =>
  (keys ?? []).flatMap(key => {
    const fact = index.get(key);
    return fact === undefined ? [] : [fact];
  });

/** "Based on ROCE 18.4% (31 Mar 2026) · …", or nothing when a check cites no fact the report carries. */
export const citesLine = (
  index: ReadonlyMap<string, ReportFact>,
  keys: readonly string[] | undefined,
): string => {
  const facts = citedFacts(index, keys);
  return facts.length === 0
    ? ''
    : `Based on ${facts
        .map(
          fact =>
            `${bareLabel(fact.label)} ${factText(fact)} (${reportDay(fact.period)})`,
        )
        .join(' · ')}`;
};

/** The line a key metric with a gap carries: what it needs, where that is published, and the proxy. */
export const kpiGapLine = (gap: ReportGap): string =>
  `Needs ${gap.needs.toLowerCase()}. ${REPORT_GAP_STATUS_WORDS[gap.status] ?? gap.label}: ${gap.sources.join(', ')}` +
  (gap.refresh !== '' ? ` · ${gap.refresh}` : '') +
  (gap.proxy !== '' && gap.proxy !== 'None' ? ` · Proxy: ${gap.proxy}` : '');

/** The trend a key metric sparkline draws: the history of the first fact it cites, once it has a value. */
export const kpiTrail = (
  index: ReadonlyMap<string, ReportFact>,
  kpi: ReportKpi,
): number[] =>
  kpi.value === undefined || kpi.value === null
    ? []
    : (index.get(kpi.facts[0] ?? '')?.history ?? []).map(point => point.value);

export type ReportHistoryTable = {
  readonly periods: readonly string[];
  readonly rows: readonly {
    readonly key: string;
    readonly label: string;
    readonly values: readonly string[];
  }[];
};

/** The last three periods of the facts a watch item tables, or null when none of them has a history. */
export const historyTable = (
  index: ReadonlyMap<string, ReportFact>,
  keys: readonly string[] | undefined,
): ReportHistoryTable | null => {
  const facts = citedFacts(index, keys).filter(
    (fact): fact is ReportFact & {history: ReportHistoryPoint[]} =>
      fact.history !== undefined && fact.history.length > 0,
  );
  const first = facts[0];
  if (first === undefined) return null;
  const last = (fact: ReportFact & {history: ReportHistoryPoint[]}) =>
    fact.history.slice(-3);
  return {
    periods: last(first).map(point => point.period),
    rows: facts.map(fact => ({
      key: fact.key,
      label: bareLabel(fact.label),
      values: last(fact).map(point => factHistoryText(fact, point.value)),
    })),
  };
};

export type ReportCoverageRow = {
  readonly kind: 'Metric' | 'Input';
  readonly name: string;
  readonly gap?: ReportGap | undefined;
  /** What the report has: a value and its period, or "Served"; empty when it has nothing. */
  readonly have: string;
};

export type ReportCoverageGroup = {
  readonly status: ReportGapStatus;
  readonly rows: readonly ReportCoverageRow[];
};

/** Every metric and input, grouped by where what is missing is published; A (from our data) first. */
export const coverageGroups = (
  report: ManualReportPayload,
): ReportCoverageGroup[] => {
  const rows: ReportCoverageRow[] = [
    ...report.scorecard.map((kpi): ReportCoverageRow => ({
      kind: 'Metric',
      name: kpi.name,
      gap: kpi.gap,
      have:
        kpi.value !== undefined && kpi.value !== null
          ? `${kpiValueText(kpi.value, kpi.unit)} · ${kpi.period ?? ''}`
          : '',
    })),
    ...report.data_requirements.map((requirement): ReportCoverageRow => ({
      kind: 'Input',
      name: requirement.item,
      gap: requirement.gap,
      have: requirement.served ? 'Served' : '',
    })),
  ];
  const groups = new Map<ReportGapStatus, ReportCoverageRow[]>();
  for (const row of rows) {
    const status = row.gap?.status ?? 'A';
    const group = groups.get(status);
    if (group === undefined) groups.set(status, [row]);
    else group.push(row);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, group]) => ({status, rows: group}));
};

/** The fiscal years the figures cover, read from the figures themselves; the last five. */
export const fiscalYears = (facts: readonly ReportFact[]): string[] =>
  [
    ...new Set(
      facts
        .flatMap(fact => (fact.history ?? []).map(point => point.period))
        .filter(period => /^FY\d{2}$/.test(period)),
    ),
  ]
    .sort()
    .slice(-5);

export type ReportFigureRow = {
  readonly key: string;
  readonly label: string;
  /** A unit the label carries that is not printed against the number ("₹ cr"). */
  readonly unit: string | undefined;
  /** One cell per fiscal year column; empty where the figure has no value for that year. */
  readonly byYear: readonly string[];
  readonly latest: string;
  readonly latestDay: string;
  readonly trail: readonly number[];
};

/** The "Every figure" table: one row a fact, its value in each of the fiscal years and the latest. */
export const figureRows = (
  facts: readonly ReportFact[],
  years: readonly string[],
): ReportFigureRow[] =>
  facts.map(fact => {
    const byPeriod = new Map(
      (fact.history ?? []).map(point => [point.period, point.value]),
    );
    return {
      key: fact.key,
      label: bareLabel(fact.label),
      unit: factUnitWord(fact.label),
      byYear: years.map(year => {
        const value = byPeriod.get(year);
        return value === undefined ? '' : factHistoryText(fact, value);
      }),
      latest: factText(fact),
      latestDay: reportDay(fact.period),
      trail: (fact.history ?? []).map(point => point.value),
    };
  });

/** How many of the note's quality areas read as good. */
export const qualityGoodCount = (note: ResearchNote): number =>
  note.quality.filter(area => /good/i.test(area.status)).length;

export const isQualityGood = (status: string): boolean => /good/i.test(status);

/** The takeaway's "what to monitor", one chip per item. */
export const monitorChips = (note: ResearchNote): string[] =>
  note.takeaway.monitor
    .split('+')
    .map(item => item.trim())
    .filter(item => item !== '');

/** A risk's chain of consequences, one step per arrow. */
export const riskChainSteps = (chain: string): string[] =>
  chain
    .split('→')
    .map(step => step.trim())
    .filter(step => step !== '');

export type ReportKeyFigure = {
  readonly key:
    'stage' | 'roce' | 'pe' | 'redFlags' | 'supporting' | 'coverage';
  readonly value: string;
  /** The small print under the value: a date, "Confirmed", "3 not checked". */
  readonly detail: string;
};

/**
 * The strip of figures under the summary: the stage, ROCE and P/E where the report has them, then
 * the gate's tallies and the data coverage. Each is a key for the host to name; the values are
 * the report's.
 */
export const reportKeyFigures = (
  report: ManualReportPayload,
  index: ReadonlyMap<string, ReportFact>,
): ReportKeyFigure[] => {
  const stage = report.stage.result ?? null;
  const gate = report.gate.summary;
  const roce = index.get('f.roce');
  const pe = index.get('f.pe');
  return [
    ...(stage === null
      ? []
      : [
          {
            key: 'stage' as const,
            value: `${stage.stage} · ${REPORT_STAGES[stage.stage].name}`,
            detail: stage.confirmed ? 'Confirmed' : 'Unconfirmed',
          },
        ]),
    ...(roce === undefined
      ? []
      : [
          {
            key: 'roce' as const,
            value: factText(roce),
            detail: reportDay(roce.period),
          },
        ]),
    ...(pe === undefined
      ? []
      : [{key: 'pe' as const, value: factText(pe), detail: 'Today'}]),
    {
      key: 'redFlags',
      value: `${gate.stops_hit.length} of ${gate.stops_total}`,
      detail: `${gate.stops_unchecked} not checked`,
    },
    {
      key: 'supporting',
      value: `${gate.go_met} of ${gate.go_total}`,
      detail: `${gate.go_unchecked} not checked`,
    },
    {
      key: 'coverage',
      value: `${report.coverage.settled} of ${report.coverage.items}`,
      detail: 'items settled',
    },
  ];
};

/** The decision gate's one-line tally, as the page states it. */
export const gateTally = (gate: ReportGateSummary): string =>
  `${gate.stops_hit.length} of ${gate.stops_total} red flags present, ${gate.stops_unchecked} not checked · ${gate.go_met} of ${gate.go_total} supporting signs met, ${gate.go_unchecked} not checked` +
  (gate.go_missed.length > 0 ? ` · Missed: ${gate.go_missed.join(', ')}` : '') +
  (gate.stops_hit.length > 0 ? ` · Present: ${gate.stops_hit.join(', ')}` : '');

/** The share of the report's items our data settled, 0–100. */
export const coveragePct = (
  coverage: ManualReportPayload['coverage'],
): number =>
  coverage.items > 0 ? (coverage.settled / coverage.items) * 100 : 0;

/** "Part 2 · Title", or "Part 2" when the part has no title. */
export const partTitle = (part: ManualReportPayload['parts'][number]): string =>
  `Part ${part.no}${part.title !== undefined && part.title !== '' ? ` · ${part.title}` : ''}`;

/** The marks a part's checks carry, for its aside: how many meet, how many have no data. */
export const partTally = (
  part: ManualReportPayload['parts'][number],
): {readonly meet: number; readonly noData: number} => {
  const items = part.cards.flatMap(card => card.checks);
  return {
    meet: items.filter(item => item.mark === 'pass').length,
    noData: items.filter(item => item.mark === 'not_available').length,
  };
};

/** A sparkline's points on a `width` × `height` box with `pad` inside; null with fewer than two values. */
export const sparkPoints = (
  values: readonly number[],
  width: number,
  height: number,
  pad: number,
): [number, number][] | null => {
  if (values.length < 2) return null;
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  return values.map((value, i) => [
    pad + (i * (width - 2 * pad)) / (values.length - 1),
    height - pad - ((value - low) / span) * (height - 2 * pad),
  ]);
};
