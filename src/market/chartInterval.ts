// Chart intervals as the chart can draw them, not as the picker lists them. The
// presets are a ladder (CHART_INTERVAL_RESOLUTION); a chat plan can set any rung
// of the chart's own dropdown and a user can add an interval nobody enumerated,
// so every conversion here parses rather than looks up. A lookup was why an
// interval off the table could not survive a round trip: the chart drew "45",
// the reverse lookup found nothing, and the chip above it kept naming the
// resolution the plot had left.
//
// Named `chartInterval…` where web says `interval…`: `Interval` here is the
// fetchable pair (see graphData.ts).

import {
  CHART_INTERVAL_RESOLUTION,
  type ChartInterval,
  type ChartIntervalUnit,
  type PresetChartInterval,
} from '../types/graphData.ts';

// Capped so a typo'd 70000m can't ask the feed for a century of minute bars.
export const MAX_CUSTOM_INTERVAL_COUNT = 999;

const INTERVAL_PATTERN = /^([1-9][0-9]{0,2})(m|h|d|w|M)$/;

export type ParsedChartInterval = {
  readonly count: number;
  readonly unit: ChartIntervalUnit;
};

export function parseChartInterval(
  value: string | null | undefined,
): ParsedChartInterval | null {
  const match = value ? INTERVAL_PATTERN.exec(value) : null;
  const count = match?.[1];
  const unit = match?.[2];
  return count === undefined || unit === undefined
    ? null
    : {count: Number(count), unit: unit as ChartIntervalUnit};
}

export const isChartInterval = (
  value: string | null | undefined,
): value is ChartInterval => parseChartInterval(value) !== null;

/**
 * The canonical interval for a count and unit: 90m stays 90m, 120m is 2h, so a
 * custom interval that equals a preset is that preset. Null outside 1–999.
 */
export function makeChartInterval(
  count: number,
  unit: ChartIntervalUnit,
): ChartInterval | null {
  if (!Number.isInteger(count) || count <= 0) return null;
  const canonical =
    unit === 'm' && count % 60 === 0 ? `${count / 60}h` : `${count}${unit}`;
  return isChartInterval(canonical) ? canonical : null;
}

const PRESETS: ReadonlySet<string> = new Set(
  Object.keys(CHART_INTERVAL_RESOLUTION),
);

export const isPresetChartInterval = (
  interval: string,
): interval is PresetChartInterval => PRESETS.has(interval);

// Nominal widths, for ordering and for sizing a fetch window only: a month is
// not 30 days, and day-and-longer buckets sit on the calendar, never on this.
const UNIT_MINUTES: Readonly<Record<ChartIntervalUnit, number>> = {
  m: 1,
  h: 60,
  d: 24 * 60,
  w: 7 * 24 * 60,
  M: 30 * 24 * 60,
};

/** An interval's nominal width in minutes; 0 for anything unparseable. */
export function chartIntervalMinutes(interval: string): number {
  const parsed = parseChartInterval(interval);
  return parsed === null ? 0 : parsed.count * UNIT_MINUTES[parsed.unit];
}

/**
 * What an interval is called on a button: minutes and hours as written, day and
 * longer in TradingView's own capitals (1D, 2W, 3M) — "1m" reads as a minute, so
 * a month cannot share its spelling.
 */
export function chartIntervalLabel(interval: ChartInterval): string {
  const parsed = parseChartInterval(interval);
  if (parsed === null || parsed.unit === 'm' || parsed.unit === 'h') {
    return interval;
  }
  return `${parsed.count}${parsed.unit.toUpperCase()}`;
}

/**
 * The TradingView resolution for an interval. Hours are written in minutes
 * there ("180" is 3h), which is what the library's own ladder and dialog use.
 * Anything unparseable asks for the 1-minute chart rather than nothing.
 */
export function chartIntervalToResolution(interval: ChartInterval): string {
  const parsed = parseChartInterval(interval);
  if (parsed === null) return '1';
  const {count, unit} = parsed;
  if (unit === 'm') return String(count);
  if (unit === 'h') return String(count * 60);
  return `${count}${unit.toUpperCase()}`;
}

const RESOLUTION_PATTERN = /^([0-9]*)([A-Za-z]?)$/;

// Seconds, ticks and range bars are absent on purpose: the backend serves
// minute and daily bars only, so nothing finer than a minute can be built.
const UNIT_OF_SUFFIX: Readonly<Record<string, ChartIntervalUnit>> = {
  '': 'm',
  H: 'h',
  D: 'd',
  W: 'w',
  M: 'M',
};

/**
 * The interval a TradingView resolution draws, from every spelling the library
 * emits: "7", "180", "3H", "D", "2W", "6M". Null for a resolution a chart here
 * cannot draw.
 */
export function resolutionToChartInterval(
  resolution: string,
): ChartInterval | null {
  const match = RESOLUTION_PATTERN.exec(resolution.trim());
  const digits = match?.[1] ?? '';
  const suffix = (match?.[2] ?? '').toUpperCase();
  if (match === null || (digits === '' && suffix === '')) return null;
  const unit = UNIT_OF_SUFFIX[suffix];
  if (unit === undefined) return null;
  // TradingView omits the 1 in "D", "W" and "M".
  return makeChartInterval(digits === '' ? 1 : Number(digits), unit);
}
