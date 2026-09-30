import {findAlertField} from '../data/alertFields.ts';
import type {SavedAlert} from '../types/savedAlert.ts';
import {extractUnderlyingSymbol} from './symbols.ts';

/**
 * One side of a condition as the chart's Signal Markers study reads a series: the price itself, an
 * average or RSI of it, or (for the second side) a fixed value.
 */
export type SignalSide =
  | {kind: 'Price' | 'EMA' | 'SMA' | 'WMA' | 'RSI'; length?: number}
  | {value: number};

/** A condition between two sides, in the Signal Markers study's own condition words. */
export interface SignalRule {
  a: SignalSide;
  condition: string;
  b: SignalSide;
}

/**
 * The alert fields the chart computes itself, as the Signal Markers study reads a series, so a
 * fired alert's condition can be marked on the chart's own candles from then on. A field missing
 * here is marked only where it fired.
 */
export const CHART_SERIES: Readonly<Record<string, SignalSide>> = {
  close_price: {kind: 'Price'},
  ema9: {kind: 'EMA', length: 9},
  ema21: {kind: 'EMA', length: 21},
  ema50: {kind: 'EMA', length: 50},
  ema100: {kind: 'EMA', length: 100},
  ema200: {kind: 'EMA', length: 200},
  sma20: {kind: 'SMA', length: 20},
  sma50: {kind: 'SMA', length: 50},
  sma100: {kind: 'SMA', length: 100},
  sma200: {kind: 'SMA', length: 200},
  wma20: {kind: 'WMA', length: 20},
  rsi7: {kind: 'RSI', length: 7},
  rsi9: {kind: 'RSI', length: 9},
  rsi14: {kind: 'RSI', length: 14},
};

/** The alert form's operators in the Signal Markers study's condition words. */
const CONDITION_WORDS: Readonly<Record<string, string>> = {
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
  '>': 'above',
  '>=': 'above',
  '<': 'below',
  '<=': 'below',
};

// Own keys only: a condition's column is server data, and a plain lookup reads `constructor` or
// `toString` off the prototype as though the chart computed them.
const own = <T>(
  map: Readonly<Record<string, T>>,
  key: string,
): T | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

type Leaf = {var?: unknown; op?: unknown; val?: unknown};

/**
 * How a fired alert's condition is marked on the chart from then on: rules the chart evaluates on
 * its own candles, patterns its scan finds, or null when the condition reads something the chart
 * does not compute — then only the moment it fired is marked.
 */
export type LiveMarks =
  {rules: SignalRule[]; join: 'AND' | 'OR'} | {patterns: string[]} | null;

const sideOf = (value: unknown): SignalSide | undefined =>
  typeof value === 'number' ? {value} : own(CHART_SERIES, String(value));

/** A yes/no pattern in the alert form's field list, which the chart's view scan finds. */
const isPatternField = (fieldId: string): boolean =>
  findAlertField(fieldId)?.kind === 'pattern';

/**
 * An alert's own rule ({var, op, val} leaves, at most one AND/OR group deep) as the chart can
 * mark it. Which fields are patterns is the alert field list's `kind: 'pattern'`.
 */
export function liveMarksFor(condition: unknown): LiveMarks {
  if (!condition || typeof condition !== 'object') return null;
  const node = condition as {logic?: unknown; conditions?: unknown};
  const leaves = (
    Array.isArray(node.conditions) ? node.conditions : [condition]
  ) as unknown[];
  const join = node.logic === 'OR' ? 'OR' : 'AND';
  if (
    leaves.some(
      leaf => !leaf || typeof leaf !== 'object' || 'conditions' in leaf,
    )
  )
    return null;
  const fields = (leaves as Leaf[]).map(leaf => String(leaf.var));

  const patterns = fields.filter(isPatternField);
  if (patterns.length === leaves.length) {
    // Several patterns on one candle is not something the scan answers.
    return join === 'OR' || patterns.length === 1 ? {patterns} : null;
  }
  if (patterns.length) return null;

  const rules: SignalRule[] = [];
  for (const leaf of leaves as Leaf[]) {
    const a = own(CHART_SERIES, String(leaf.var));
    const b = sideOf(leaf.val);
    const words = own(CONDITION_WORDS, String(leaf.op));
    if (!a || !b || !words) return null;
    rules.push({a, condition: words, b});
  }
  return {rules, join};
}

/** A condition marked on every candle it holds on from `from` (epoch seconds). */
export interface AlertWatch {
  readonly rules: readonly SignalRule[];
  readonly join: 'AND' | 'OR';
  readonly from: number;
}

/**
 * What the user's alerts put on one chart: where each fired, and where its condition has held
 * since — as rules the chart evaluates, or times a scan found (a pattern). Epoch seconds; the
 * chart's Trades study draws them.
 */
export interface AlertMarks {
  readonly fires: readonly number[];
  readonly hits: readonly number[];
  readonly watches: readonly AlertWatch[];
}

export const NO_ALERT_MARKS: AlertMarks = {fires: [], hits: [], watches: []};

/**
 * "NSE:RELIANCE", "RELIANCE-EQ" and a Reliance option all name RELIANCE. Total, as web's `ticker()`
 * is: a match is server data, and one without a symbol names nothing rather than throwing.
 */
const tickerUnderlying = (symbol: string | null | undefined): string =>
  extractUnderlyingSymbol((symbol ?? '').split(':').pop() ?? '');

/**
 * The saved alerts on one underlying: a single stock's alert as itself, a list's through the match
 * for it. An option contract's alert counts under its underlying.
 */
export function alertsOnUnderlying(
  alerts: readonly SavedAlert[],
  underlying: string,
): SavedAlert[] {
  const target = tickerUnderlying(underlying);
  return alerts.filter(alert =>
    [alert.symbol, ...(alert.matches ?? []).map(match => match.symbol)].some(
      symbol => !!symbol && tickerUnderlying(symbol) === target,
    ),
  );
}

/**
 * When an alert fired on this underlying: a list's alert through the match for it, a single
 * stock's as itself. An alert fires once, so that moment is its whole record.
 */
export function alertFiredOn(
  alert: SavedAlert,
  underlying: string,
): string | null {
  const target = tickerUnderlying(underlying);
  return (
    alert.matches?.find(match => tickerUnderlying(match.symbol) === target)
      ?.triggered_at ??
    (alert.symbol && tickerUnderlying(alert.symbol) === target
      ? (alert.last_triggered_at ?? null)
      : null)
  );
}

/** A pattern the chart's scan of the view found, as far as marking an alert needs it. */
export interface AlertPatternHit {
  pattern: string;
  to_epoch: number;
}

/** A fired pattern alert's pattern, marked wherever the scan finds it from `from` (epoch seconds). */
export interface AlertPatternWatch {
  readonly pattern: string;
  readonly from: number;
}

export interface AlertMarksOptions {
  /** Whether an alert is marked on the chart; every one is unless the user turned it off. */
  isPlotted?: (id: string) => boolean;
  /** The view scan's hits; a fired pattern alert is marked where its pattern completes since. */
  patternHits?: readonly AlertPatternHit[];
}

const always = (): boolean => true;

/** Each plotted alert that has fired on this underlying: from when, and how it is marked since. */
function plottedFires(
  alerts: readonly SavedAlert[],
  underlying: string,
  isPlotted: (id: string) => boolean,
): {from: number; live: LiveMarks}[] {
  return alertsOnUnderlying(alerts, underlying).flatMap(alert => {
    const at = alertFiredOn(alert, underlying);
    const from = at ? Date.parse(at) / 1000 : NaN;
    if (!Number.isFinite(from) || !isPlotted(alert.id)) return [];
    return [{from, live: liveMarksFor(alert.condition)}];
  });
}

const patternWatchesOf = (
  fires: readonly {from: number; live: LiveMarks}[],
): AlertPatternWatch[] =>
  fires.flatMap(({from, live}) =>
    live && 'patterns' in live
      ? live.patterns.map(pattern => ({pattern, from}))
      : [],
  );

/**
 * The patterns the plotted, fired alerts on this underlying are marked by: while there are any, the
 * chart has to scan its view for them, whether or not anything else asked for a scan.
 */
export function alertPatternWatches(
  alerts: readonly SavedAlert[],
  underlying: string,
  {isPlotted = always}: Pick<AlertMarksOptions, 'isPlotted'> = {},
): AlertPatternWatch[] {
  return patternWatchesOf(plottedFires(alerts, underlying, isPlotted));
}

/** Where the scan found a watched pattern completing at or after its alert fired, epoch seconds. */
export function alertPatternHits(
  watches: readonly AlertPatternWatch[],
  patternHits: readonly AlertPatternHit[],
): number[] {
  return patternHits
    .filter(hit =>
      watches.some(
        watch => watch.pattern === hit.pattern && hit.to_epoch >= watch.from,
      ),
    )
    .map(hit => hit.to_epoch);
}

/**
 * Each plotted alert that has fired on this underlying: a flag where it fired, then every candle
 * its condition holds on from that moment — evaluated by the chart for price and indicator
 * conditions, found by the view scan for patterns. A condition the chart cannot compute keeps
 * only its flag, and a fire time that does not parse marks nothing.
 */
export function alertMarksFor(
  alerts: readonly SavedAlert[],
  underlying: string,
  {isPlotted = always, patternHits = []}: AlertMarksOptions = {},
): AlertMarks {
  const plotted = plottedFires(alerts, underlying, isPlotted);
  return {
    fires: plotted.map(({from}) => from),
    hits: alertPatternHits(patternWatchesOf(plotted), patternHits),
    watches: plotted.flatMap(({from, live}) =>
      live && 'rules' in live
        ? [{rules: live.rules, join: live.join, from}]
        : [],
    ),
  };
}
