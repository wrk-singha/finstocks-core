import type {WorldIndexRow} from '../api/market.ts';
import {formatNumber} from '../format/index.ts';

export type Region = 'Americas' | 'Europe' | 'Asia Pacific';

/**
 * Oldest first by the row's date. Plain code-point order, which is chronological for dates of one
 * ISO shape; `localeCompare` goes through the ICU collator on every comparison, which on Hermes
 * turns sorting a year of daily rows into a stall the screen waits on.
 */
export const byRowDate = (
  a: {readonly date: string},
  b: {readonly date: string},
): number => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export const REGION_ORDER: readonly Region[] = [
  'Americas',
  'Europe',
  'Asia Pacific',
];

export interface WorldMarketRow {
  indexId: number;
  name: string;
  symbol: string;
  country: string;
  region: Region;
  close: number;
  /** The latest session's own bar — the rest of the row the table shows. */
  high: number;
  low: number;
  change: number;
  changePct: number | null;
  asOf: string;
  /** Closes rebased to the window's first value, so the final point's sign is the window's
   *  direction. */
  series: number[];
}

export interface RegionGroup {
  region: Region;
  rows: WorldMarketRow[];
}

/**
 * The vendor's country strings, as a region and a readable label.
 *
 * "Mexican" is theirs, not a typo of ours — it is the adjective where every other row carries a
 * noun, so it is renamed here rather than shipped to the screen. Anything unlisted falls through to
 * Asia Pacific with its raw label, so a new index appears rather than vanishing.
 */
const COUNTRIES: Readonly<
  Record<string, {readonly label: string; readonly region: Region}>
> = {
  US: {label: 'United States', region: 'Americas'},
  Brazil: {label: 'Brazil', region: 'Americas'},
  Mexican: {label: 'Mexico', region: 'Americas'},
  UK: {label: 'United Kingdom', region: 'Europe'},
  Germany: {label: 'Germany', region: 'Europe'},
  France: {label: 'France', region: 'Europe'},
  Switzerland: {label: 'Switzerland', region: 'Europe'},
  Japan: {label: 'Japan', region: 'Asia Pacific'},
  'Hong Kong': {label: 'Hong Kong', region: 'Asia Pacific'},
  Singapore: {label: 'Singapore', region: 'Asia Pacific'},
  'South Korea': {label: 'South Korea', region: 'Asia Pacific'},
  Taiwan: {label: 'Taiwan', region: 'Asia Pacific'},
  Malaysia: {label: 'Malaysia', region: 'Asia Pacific'},
  Indonesia: {label: 'Indonesia', region: 'Asia Pacific'},
};

/**
 * Folds the world-indices history into one row per index.
 *
 * The join in the middle exists because `in_world_indices` carries two generations of row for the
 * same `index_id`: the historical ones name the index and its country, and the ones written since
 * early September leave all three identity columns blank while still carrying prices. Taking the
 * newest row alone — which is what the `/world-indices/master` endpoint does — yields sixteen
 * nameless rows, so identity is recovered from whichever row in the window still has it and the
 * latest row supplies only the numbers.
 *
 * Fix the ingestion and this keeps working unchanged: a window where every row is named resolves
 * identity from the newest one.
 */
export const buildWorldMarkets = (
  rows: readonly WorldIndexRow[],
): WorldMarketRow[] => {
  const byIndex = new Map<number, WorldIndexRow[]>();
  for (const row of rows) {
    const bucket = byIndex.get(row.index_id);
    if (bucket) bucket.push(row);
    else byIndex.set(row.index_id, [row]);
  }

  const out: WorldMarketRow[] = [];

  for (const [indexId, bucket] of byIndex) {
    // Oldest first: the series reads left to right and the last two entries are the pair the day
    // change comes from.
    const series = bucket
      .filter(row => Number.isFinite(row.close) && row.close > 0)
      .sort(byRowDate);
    const first = series[0];
    const latest = series.at(-1);
    if (first === undefined || latest === undefined) continue;

    // The type says string, but nothing checks a blank identity column arrives as '' rather than
    // null — `?.` keeps a null from throwing mid-table.
    const named = bucket.find(row => row.index_name?.trim());
    const name = named?.index_name?.trim();
    // No name anywhere in the window means the whole window is post-regression rows. Nothing
    // honest to label it with, so it is dropped rather than rendered as a blank line with a price
    // against it.
    if (!name) continue;

    const country = named?.country?.trim() ?? '';
    const meta = COUNTRIES[country];
    const previous = series.at(-2);
    const change = previous ? latest.close - previous.close : 0;

    out.push({
      indexId,
      name,
      symbol: named?.index_symbol?.trim() ?? '',
      country: meta?.label ?? country,
      region: meta?.region ?? 'Asia Pacific',
      close: latest.close,
      high:
        Number.isFinite(latest.high) && latest.high > 0
          ? latest.high
          : latest.close,
      low:
        Number.isFinite(latest.low) && latest.low > 0
          ? latest.low
          : latest.close,
      change,
      changePct: previous?.close ? (change / previous.close) * 100 : null,
      asOf: latest.date,
      series: series.map(row => row.close - first.close),
    });
  }

  // Within a region, biggest mover first — the row worth reading is the one that moved, not the
  // one whose country sorts early.
  return out.sort(
    (a, b) =>
      REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region) ||
      Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0),
  );
};

/** Index levels span 1,686 (KLSE) to 187,206 (Bovespa), so decimals are spent where they carry
 *  information and dropped where they are noise. */
export const formatIndexLevel = (value: number): string =>
  formatNumber(value, value >= 10_000 ? 0 : 2);

export const groupByRegion = (rows: readonly WorldMarketRow[]): RegionGroup[] =>
  REGION_ORDER.map(region => ({
    region,
    rows: rows.filter(row => row.region === region),
  })).filter(group => group.rows.length > 0);

/** The newest session any row closed on — the date the table's end-of-day note names. */
export const latestWorldClose = (
  rows: readonly WorldMarketRow[],
): string | null =>
  rows.reduce<string | null>(
    (latest, row) => (latest === null || row.asOf > latest ? row.asOf : latest),
    null,
  );

/**
 * A world benchmark's address segment: a readable name with the vendor's numeric `index_id` kept
 * as the last run of digits.
 *
 * The id has to stay, because it is the only identity the feed carries on every row —
 * `index_symbol` is blank on everything written since the September ingestion regression (see
 * buildWorldMarkets). But an id alone made the address `/indices/global/13`, which says nothing to
 * whoever it is sent to and leaves the screen unable to name what it is loading until the fetch
 * lands. The slug is decoration the reader can use; the trailing id is what resolves, so a bare
 * `13` still works.
 */
export const globalIndexParam = (indexId: number, name?: string): string => {
  const slug = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${slug}-${indexId}` : String(indexId);
};

/** The benchmark's own URL, `/indices/global/<slug>-<id>`. */
export const globalIndexPath = (indexId: number, name?: string): string =>
  `/indices/global/${globalIndexParam(indexId, name)}`;

/** Title Case back out of the slug, for the header before the fetch lands. "s-p-500-26" ->
 *  "S P 500"; imperfect on punctuation the slug flattened, which is why the fetched name replaces
 *  it on arrival. */
export const globalIndexNameFromParam = (param?: string): string | null => {
  const slug = (param ?? '').trim().replace(/-?\d+$/, '');
  if (!slug) return null;
  return slug
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/** The id is the last `-`-separated run of digits, so both the slugged form and a bare id
 *  resolve. Null when there is no id to read. */
export const parseGlobalIndexParam = (param?: string): number | null => {
  const digits = /(\d+)$/.exec(param?.trim() ?? '')?.[1];
  if (digits === undefined) return null;
  const id = Number(digits);
  return Number.isFinite(id) && id > 0 ? id : null;
};
