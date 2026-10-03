import type {
  ProfileInstrument,
  ProfileLevels,
  ProfileRow,
  ProfileScreenStatus,
} from '../types/marketProfile.ts';

/** One instrument's name in a cache key: a stock's symbol, a future's `UNDERLYING:YYYY-MM`. */
export const profileInstrumentKey = (instrument: ProfileInstrument): string =>
  'symbol' in instrument
    ? instrument.symbol
    : `${instrument.underlying}:${instrument.month}`;

export type ValuePosition = 'above' | 'inside' | 'below';

export const VALUE_POSITION_COPY: Record<ValuePosition, string> = {
  above: 'Above value',
  inside: 'Inside value',
  below: 'Below value',
};

export function valuePosition(
  price: number | null,
  levels: ProfileLevels,
): ValuePosition | null {
  if (price == null || levels.val == null || levels.vah == null) return null;
  if (price > levels.vah) return 'above';
  if (price < levels.val) return 'below';
  return 'inside';
}

/** The setups by what they say: triggered, checked and quiet, or not readable yet. */
export function groupScreens<T extends {status: ProfileScreenStatus}>(
  screens: readonly T[],
): {triggered: T[]; quiet: T[]; waiting: T[]} {
  return {
    triggered: screens.filter(s => s.status === 'triggered'),
    quiet: screens.filter(s => s.status === 'none'),
    waiting: screens.filter(s => s.status === 'insufficient'),
  };
}

const onGrid = (price: number) => Math.round(price * 1e8) / 1e8;

export interface LadderRow extends ProfileRow {
  top: number;
}

/**
 * The profile's rows as the ladder draws them, at most about `maxRows`: neighbouring rows are
 * summed into one when the session spans more, each keeping its lowest price and the top of its
 * highest row.
 */
export function ladderRows(
  rows: readonly ProfileRow[],
  rowSize: number,
  maxRows: number,
): LadderRow[] {
  const factor = Math.max(1, Math.ceil(rows.length / maxRows));
  const out: LadderRow[] = [];
  for (let i = 0; i < rows.length; i += factor) {
    const bucket = rows.slice(i, i + factor);
    const highest = bucket[0];
    const lowest = bucket[bucket.length - 1];
    if (highest === undefined || lowest === undefined) continue;
    out.push({
      price: lowest.price,
      top: onGrid(highest.price + rowSize),
      volume: bucket.reduce((sum, r) => sum + r.volume, 0),
      tpo: bucket.reduce((sum, r) => sum + r.tpo, 0),
    });
  }
  return out;
}

export const rowContains = (row: LadderRow, price: number | null) =>
  price != null && price >= row.price && price < row.top;

export const rowInValue = (row: LadderRow, levels: ProfileLevels) =>
  levels.val != null &&
  levels.vah != null &&
  row.price >= levels.val &&
  row.top <= levels.vah;

/** The `count` levels nearest the price, highest first; the first `count` as served without one. */
export function nearestLevels(
  levels: readonly number[],
  price: number | null,
  count: number,
): number[] {
  const ranked =
    price == null
      ? levels
      : [...levels].sort((a, b) => Math.abs(a - price) - Math.abs(b - price));
  return ranked.slice(0, count).sort((a, b) => b - a);
}

/** The newest minute's reading that is not null: a minute without a book carries none. */
export function latestReading<T>(
  minutes: readonly T[],
  pick: (m: T) => number | null,
): number | null {
  for (let i = minutes.length - 1; i >= 0; i--) {
    const minute = minutes[i];
    if (minute === undefined) continue;
    const value = pick(minute);
    if (value != null) return value;
  }
  return null;
}

export type LadderTag = 'VAH' | 'POC' | 'VAL' | 'LTP';

export interface LadderMarker {
  index: number;
  price: number;
  tags: LadderTag[];
}

/**
 * The ladder rows that carry a label, with what each is. The value-area high is the top edge of
 * its row, so it is looked for half a row lower, inside the row it closes.
 */
export function ladderMarkers(
  ladder: readonly LadderRow[],
  levels: ProfileLevels,
  lastPrice: number | null,
  rowSize: number,
): LadderMarker[] {
  const anchors: [LadderTag, number | null][] = [
    ['VAH', levels.vah == null ? null : levels.vah - rowSize / 2],
    ['POC', levels.poc],
    ['VAL', levels.val],
    ['LTP', lastPrice],
  ];
  return ladder.flatMap((row, index) => {
    const tags = anchors
      .filter(([, price]) => rowContains(row, price))
      .map(([tag]) => tag);
    return tags.length > 0 ? [{index, price: row.price, tags}] : [];
  });
}

/**
 * Label centres pushed apart to at least `gap`, kept inside `height`: first downwards off each
 * other, then back up off the floor.
 */
export function spreadLabels(
  centers: readonly number[],
  gap: number,
  height: number,
): number[] {
  const out = [...centers];
  for (let i = 1; i < out.length; i++) {
    out[i] = Math.max(out[i] ?? 0, (out[i - 1] ?? 0) + gap);
  }
  for (let i = out.length - 1; i >= 0; i--) {
    const ceiling =
      i === out.length - 1 ? height - gap / 2 : (out[i + 1] ?? 0) - gap;
    out[i] = Math.max(Math.min(out[i] ?? 0, ceiling), gap / 2);
  }
  return out;
}

/** An SVG path through the values, scaled to the box; '' for fewer than two. */
export function cvdPath(
  values: readonly number[],
  width: number,
  height: number,
): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo || 1;
  const step = width / (values.length - 1);
  return values
    .map(
      (v, i) =>
        `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(height - ((v - lo) / span) * height).toFixed(1)}`,
    )
    .join(' ');
}
