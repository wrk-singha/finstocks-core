/**
 * The screen engine's model: the field catalogue indexed for picking, the screen a reader builds
 * (universes, industries, filters, columns, sort), the request it becomes, and the link it packs
 * into. The server runs the screen; everything here is what both apps do around it.
 *
 * The English readers (`fieldLabel`, `filterLabel`, `formatFieldValue`) are the web's; each is
 * built on a `…Parts` form that mobile words through its own strings, so the two cannot drift.
 */
import {indicatorSections} from '../data/indicatorsConfig.ts';
import {formatNumber} from '../format/number.ts';
import {pluralCount} from '../format/text.ts';
import type {
  ScreenCatalog,
  ScreenField,
  ScreenFilter,
  ScreenRequest,
  ScreenRow,
  ScreenUnit,
} from '../types/screen.ts';

/** Timeframe labels, in the order the pickers offer them. */
export const TIMEFRAME_LABEL: Readonly<Record<string, string>> = {
  '1m': '1 min',
  '5m': '5 min',
  '15m': '15 min',
  '1d': '1 day',
  '1w': '1 week',
};

/**
 * The timeframe a field id without `@` is read on. Web calls it DEFAULT_TIMEFRAME; here that name
 * already belongs to the legacy screener's '15m' at the package root.
 */
export const SCREEN_DEFAULT_TIMEFRAME = '1d';

/** The columns the server always returns, in its order. */
export const BASE_COLUMNS: readonly string[] = [
  'price',
  'return_1d',
  'market_cap',
];

/** Category ids that hold the pattern vocabularies. */
export const CANDLE_CATEGORY = 'candlesticks';
export const CHART_PATTERN_CATEGORY = 'chart_patterns';

/** A field id with its timeframe, e.g. `rsi14@15m`. */
export const withTimeframe = (id: string, tf: string): string =>
  tf && tf !== SCREEN_DEFAULT_TIMEFRAME ? `${id}@${tf}` : id;

export const splitFieldId = (key: string): {id: string; tf: string} => {
  const at = key.indexOf('@');
  return at < 0
    ? {id: key, tf: SCREEN_DEFAULT_TIMEFRAME}
    : {id: key.slice(0, at), tf: key.slice(at + 1)};
};

/** The labels the indicators panel already uses, so the screener never invents
 *  a second name for the same line. */
const INDICATOR_META = new Map<
  string,
  {label: string; description: string | undefined}
>(
  indicatorSections.flatMap(section =>
    section.fields.map(
      f => [f.key, {label: f.label, description: f.description}] as const,
    ),
  ),
);

const humanize = (key: string): string =>
  key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** One entry of the picker: a field, or a family of the same figure at
 *  several periods (profit growth over a quarter, a year, three years). */
export interface CatalogEntry {
  key: string;
  label: string;
  description?: string | undefined;
  category: string;
  tag?: string | undefined;
  popular: boolean;
  /** The member shown when the entry is chosen without picking a period. */
  primary: ScreenField;
  members: ScreenField[];
  /** Search text, lowercased. */
  haystack: string;
}

export interface CatalogIndex {
  byId: Map<string, ScreenField>;
  entries: CatalogEntry[];
  byCategory: Map<string, CatalogEntry[]>;
  categoryLabel: Map<string, string>;
  timeframes: string[];
}

export const isLibrary = (field: ScreenField): boolean =>
  field.id.startsWith('lib.');
export const isPattern = (field: ScreenField): boolean =>
  field.kind === 'pattern';

/** Fields the picker never offers on their own: raw moving-average levels are
 *  for comparing against, and the distance fields say the same thing plainly. */
const COMPARE_ONLY_FAMILIES = new Set(['sma', 'ema']);

/** An empty family or label is none at all, so the fallback covers '' as well as absent. */
const nonEmpty = (value: string | undefined, fallback: string): string =>
  value === undefined || value === '' ? fallback : value;

/** Indicator fields arrive keyed by column; the app already names them. */
function decorate(field: ScreenField): ScreenField {
  if (!field.id.startsWith('ind.')) return field;
  const column = field.id.slice(4);
  const meta = INDICATOR_META.get(column);
  const name = meta?.label ?? humanize(column);
  const decorated: ScreenField = {...field, label: name, header: name};
  if (meta?.description === undefined) delete decorated.description;
  else decorated.description = meta.description;
  return decorated;
}

export function buildCatalogIndex(
  catalog: ScreenCatalog | undefined,
): CatalogIndex {
  const byId = new Map<string, ScreenField>();
  const entries: CatalogEntry[] = [];
  const families = new Map<string, CatalogEntry>();
  const categoryLabel = new Map(
    (catalog?.categories ?? []).map(c => [c.id, c.label] as const),
  );

  for (const raw of catalog?.fields ?? []) {
    const field = decorate(raw);
    byId.set(field.id, field);
    if (COMPARE_ONLY_FAMILIES.has(field.family ?? '')) continue;

    const existing = field.family ? families.get(field.family) : undefined;
    if (existing) {
      existing.members.push(field);
      // Lowercased like the rest of the haystack: web appends the period as filed, so a search
      // for "3y" never found "3Y CAGR".
      existing.haystack += ` ${field.period ?? ''}`.toLowerCase();
      if (field.popular) existing.popular = true;
      continue;
    }
    const entry: CatalogEntry = {
      key: nonEmpty(field.family, field.id),
      label: nonEmpty(field.family_label, field.label),
      description: field.description,
      category: field.category,
      tag: field.tag,
      popular: !!field.popular,
      primary: field,
      members: [field],
      haystack: [
        field.label,
        field.family_label,
        field.header,
        field.description,
        ...(field.aliases ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
    entries.push(entry);
    if (field.family) families.set(field.family, entry);
  }

  for (const entry of entries) {
    // The plainest period leads: a reader picking "Profit growth" means the
    // trailing year, not whichever period the catalogue happened to list first.
    const popular = entry.members.find(m => m.popular);
    if (popular) entry.primary = popular;
  }

  const byCategory = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const bucket = byCategory.get(entry.category);
    if (bucket) bucket.push(entry);
    else byCategory.set(entry.category, [entry]);
  }
  // Curated fields first inside a category, then the full statement lines.
  for (const bucket of byCategory.values()) {
    bucket.sort(
      (a, b) => Number(isLibrary(a.primary)) - Number(isLibrary(b.primary)),
    );
  }

  return {
    byId,
    entries,
    byCategory,
    categoryLabel,
    timeframes: catalog?.timeframes ?? [],
  };
}

export const fieldFor = (
  index: CatalogIndex,
  key: string,
): ScreenField | undefined => index.byId.get(splitFieldId(key).id);

/** A column header or filter name in parts: the catalogue's own words, and the
 *  timeframe as an id for the host to word. */
export interface FieldLabelParts {
  /** The long label or the short header; the key itself when the catalogue does not know it. */
  name: string;
  /** The field's period, on the long form only: "3Y CAGR". */
  period: string | null;
  /** The timeframe a technical is read on, when it is not the daily one: "15m". */
  timeframe: string | null;
}

export function fieldLabelParts(
  index: CatalogIndex,
  key: string,
  long = false,
): FieldLabelParts {
  const {id, tf} = splitFieldId(key);
  const field = index.byId.get(id);
  if (!field) return {name: key, period: null, timeframe: null};
  // The short header already names its period ("Qtr Profit Var"); repeating it
  // reads as "1D % · 1D".
  return {
    name: long ? field.label : field.header,
    period: long && field.period ? field.period : null,
    timeframe: field.technical && tf !== SCREEN_DEFAULT_TIMEFRAME ? tf : null,
  };
}

const joinLabel = ({name, period, timeframe}: FieldLabelParts): string => {
  const parts = [name];
  if (period !== null) parts.push(period);
  if (timeframe !== null) parts.push(TIMEFRAME_LABEL[timeframe] ?? timeframe);
  return parts.join(' · ');
};

/** The label a column header or filter chip shows, timeframe included.
 *  English for the web app; mobile renders `fieldLabelParts`. */
export const fieldLabel = (
  index: CatalogIndex,
  key: string,
  long = false,
): string => joinLabel(fieldLabelParts(index, key, long));

export const UNIT_SUFFIX: Readonly<Record<ScreenUnit, string>> = {
  crore: '₹ Cr',
  rupees: '₹',
  pct: '%',
  x: '×',
  days: 'days',
  count: '',
  score: '/ 9',
  shares: '',
  ratio: '',
  bars: 'bars',
  '': '',
};

const CELL_UNITS: ReadonlySet<ScreenUnit> = new Set<ScreenUnit>(['pct', 'x']);

export const headerUnit = (field: ScreenField | undefined): string =>
  !field || CELL_UNITS.has(field.unit) ? '' : UNIT_SUFFIX[field.unit];

const compact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${formatNumber(value / 1e7, 2)} Cr`;
  if (abs >= 1e5) return `${formatNumber(value / 1e5, 2)} L`;
  if (abs >= 1e3) return `${formatNumber(value / 1e3, 1)} K`;
  return formatNumber(value, 0);
};

function formatFigure(value: number, unit: ScreenUnit): string {
  switch (unit) {
    case 'crore':
      return formatNumber(value, Math.abs(value) >= 1000 ? 0 : 2);
    case 'pct':
      return `${formatNumber(value, Math.abs(value) >= 100 ? 0 : 1)}${UNIT_SUFFIX.pct}`;
    case 'rupees':
      return formatNumber(value, Math.abs(value) >= 1000 ? 0 : 2);
    case 'shares':
    case 'count':
      return compact(value);
    case 'days':
    case 'score':
      return formatNumber(value, 0);
    case 'x':
      return `${formatNumber(value, 2)}${UNIT_SUFFIX.x}`;
    default:
      return formatNumber(value, 2);
  }
}

/** One cell in parts: flags and patterns are words the host chooses, figures come formatted. */
export type FieldValueParts =
  | {kind: 'missing'}
  | {kind: 'flag'; value: boolean}
  | {kind: 'pattern'; barsAgo: number}
  | {kind: 'figure'; text: string};

export function fieldValueParts(
  value: number | undefined,
  field: ScreenField | undefined,
): FieldValueParts {
  if (value == null || !Number.isFinite(value)) return {kind: 'missing'};
  if (!field) return {kind: 'figure', text: formatNumber(value, 2)};
  if (field.kind === 'flag') return {kind: 'flag', value: value === 1};
  if (field.kind === 'pattern') return {kind: 'pattern', barsAgo: value};
  return {kind: 'figure', text: formatFigure(value, field.unit)};
}

/** One cell. A figure the company has no value for reads as a dash, never 0.
 *  English for the web app; mobile renders `fieldValueParts`. */
export function formatFieldValue(
  value: number | undefined,
  field: ScreenField | undefined,
): string {
  const parts = fieldValueParts(value, field);
  switch (parts.kind) {
    case 'missing':
      return '—';
    case 'flag':
      return parts.value ? 'Yes' : 'No';
    case 'pattern':
      return parts.barsAgo === 0
        ? 'Latest bar'
        : `${formatNumber(parts.barsAgo, 0)} bars ago`;
    case 'figure':
      return parts.text;
  }
}

const SIGNED_IDS = new Set([
  'change_pct',
  'gap_pct',
  'from_high_52w',
  'from_low_52w',
]);

/** Percentage moves are read as gains and losses, so they carry the tone. */
export const isSignedField = (field: ScreenField | undefined): boolean =>
  !!field &&
  field.unit === 'pct' &&
  (field.family === 'returns' ||
    field.id.startsWith('return_') ||
    SIGNED_IDS.has(field.id));

/** The value typed into a filter, formatted back into the chip. */
function amount(value: number, field: ScreenField): string {
  switch (field.unit) {
    case 'pct':
      return `${formatNumber(value, Math.abs(value) % 1 === 0 ? 0 : 1)}%`;
    case 'crore':
      return `₹${formatNumber(value, 0)} Cr`;
    case 'rupees':
      return `₹${formatNumber(value, 0)}`;
    case 'x':
      return `${formatNumber(value, Math.abs(value) % 1 === 0 ? 0 : 2)}×`;
    case 'days':
      return pluralCount(value, 'day');
    default:
      return formatNumber(value, Math.abs(value) % 1 === 0 ? 0 : 2);
  }
}

/**
 * A filter in parts, for a host that words it itself. Bounds and the multiplier come formatted
 * ("25%", "₹300 Cr", "1.50"), and a day count comes with its unit ("1 day", "10 days"), so a host
 * adds none of its own; names are the catalogue's, with the timeframe left as an id.
 *
 * Bounds that are exactly one of the field's presets also carry its label as `preset` ("Within a
 * month"), and read as it: a host that does not know the field still has the bare bounds.
 */
export type FilterParts =
  | {kind: 'unknown'; name: FieldLabelParts}
  | {kind: 'flag'; name: FieldLabelParts; want: boolean}
  | {
      kind: 'pattern';
      name: FieldLabelParts;
      want: boolean;
      /** How far back the formation may be: 0 is the latest bar alone. */
      maxBarsAgo: number;
    }
  | {
      kind: 'compare';
      name: FieldLabelParts;
      op: 'gt' | 'lt';
      /** Null for a multiplier of 1, which reads as none. */
      factor: string | null;
      ref: FieldLabelParts;
    }
  | {
      kind: 'between';
      name: FieldLabelParts;
      min: string;
      max: string;
      preset?: string;
    }
  | {kind: 'above'; name: FieldLabelParts; min: string; preset?: string}
  | {kind: 'below'; name: FieldLabelParts; max: string; preset?: string}
  | {kind: 'any'; name: FieldLabelParts; preset?: string};

export function filterParts(
  index: CatalogIndex,
  filter: ScreenFilter,
): FilterParts {
  const field = fieldFor(index, filter.field);
  const name = fieldLabelParts(index, filter.field, true);
  if (!field) return {kind: 'unknown', name};
  if (field.kind === 'flag')
    return {kind: 'flag', name, want: filter.flag !== false};
  if (field.kind === 'pattern') {
    return {
      kind: 'pattern',
      name,
      want: filter.flag !== false,
      maxBarsAgo: filter.max ?? 0,
    };
  }
  if (filter.ref) {
    return {
      kind: 'compare',
      name,
      op: filter.op === 'lt' ? 'lt' : 'gt',
      factor:
        filter.factor && filter.factor !== 1
          ? formatNumber(filter.factor, 2)
          : null,
      ref: fieldLabelParts(index, filter.ref, true),
    };
  }
  // Checked after a comparison, whose bounds are not what it asks, as the web checks it.
  const preset = field.presets?.find(
    p =>
      (p.min ?? null) === (filter.min ?? null) &&
      (p.max ?? null) === (filter.max ?? null),
  );
  const named = preset ? {preset: preset.label} : {};
  if (filter.min != null && filter.max != null) {
    return {
      kind: 'between',
      name,
      min: amount(filter.min, field),
      max: amount(filter.max, field),
      ...named,
    };
  }
  if (filter.min != null)
    return {kind: 'above', name, min: amount(filter.min, field), ...named};
  if (filter.max != null)
    return {kind: 'below', name, max: amount(filter.max, field), ...named};
  return {kind: 'any', name, ...named};
}

/** What a filter says, in words: "Profit growth · 3Y CAGR > 25%".
 *  English for the web app; mobile renders `filterParts`. */
export function filterLabel(index: CatalogIndex, filter: ScreenFilter): string {
  const parts = filterParts(index, filter);
  const name = joinLabel(parts.name);
  if ('preset' in parts && parts.preset !== undefined)
    return `${name} · ${parts.preset}`;
  switch (parts.kind) {
    case 'unknown':
      return name;
    case 'flag':
      return parts.want ? name : `Not ${name.toLowerCase()}`;
    case 'pattern': {
      const bars = parts.maxBarsAgo;
      const when = bars === 0 ? 'latest bar' : `last ${bars + 1} bars`;
      return `${parts.want ? '' : 'No '}${name} · ${when}`;
    }
    case 'compare': {
      const factor = parts.factor === null ? '' : `${parts.factor} × `;
      return `${name} ${parts.op === 'lt' ? '<' : '>'} ${factor}${joinLabel(parts.ref)}`;
    }
    case 'between':
      return `${name} ${parts.min} – ${parts.max}`;
    case 'above':
      return `${name} > ${parts.min}`;
    case 'below':
      return `${name} < ${parts.max}`;
    case 'any':
      return `${name} · any`;
  }
}

/**
 * How far back a pattern filter looks by default.
 *
 * A candlestick is its own bar, so "today" is the useful default. A formation
 * is only recognised once the swings that shape it are confirmed, and a swing
 * needs five bars on each side — so a window of a few bars finds nothing at
 * all, whatever is on the chart. A month of sessions is the honest default.
 */
export const defaultPatternWindow = (field: ScreenField): number =>
  field.category === CHART_PATTERN_CATEGORY ? 29 : 0;

export function defaultFilterFor(
  field: ScreenField,
  tf = SCREEN_DEFAULT_TIMEFRAME,
): ScreenFilter {
  const key = field.technical ? withTimeframe(field.id, tf) : field.id;
  if (field.kind === 'flag') return {field: key, flag: true};
  if (field.kind === 'pattern')
    return {field: key, max: defaultPatternWindow(field), flag: true};
  const preset = field.presets?.[0];
  return {field: key, min: preset?.min, max: preset?.max};
}

/** A filter with no bound narrows nothing; it sits on the bar until it does. */
export const isActiveFilter = (filter: ScreenFilter): boolean =>
  filter.min != null ||
  filter.max != null ||
  filter.flag != null ||
  !!filter.ref;

/** What a figure can be compared against: the other figures in the same unit,
 *  so "price above its 200-day average" is offered and "price above ROE" is not.
 *
 *  A technical carries the timeframe of the side it is compared with. Without
 *  it, a 15-minute SMA 50 was measured against the DAILY SMA 200 — two
 *  different charts, silently. */
export function compareOptions(
  index: CatalogIndex,
  field: ScreenField | undefined,
  tf: string,
): {value: string; label: string}[] {
  if (field?.kind !== 'number' || !field.unit) return [];
  return [...index.byId.values()]
    .filter(
      f =>
        f.id !== field.id &&
        f.kind === 'number' &&
        f.unit === field.unit &&
        f.technical === field.technical &&
        !isLibrary(f) &&
        (!f.technical || (f.timeframes ?? index.timeframes).includes(tf)),
    )
    .slice(0, 60)
    .map(f => ({
      value: f.technical ? withTimeframe(f.id, tf) : f.id,
      label: f.label,
    }));
}

export interface ScreenState {
  universes: string[];
  industries: string[];
  filters: ScreenFilter[];
  /** Columns the reader added; filter columns come along on their own. */
  columns: string[];
  sort: {key: string; dir: 'asc' | 'desc'} | null;
  /** The prebuilt screen this started from, for the header. */
  preset?: string | undefined;
}

export const EMPTY_SCREEN: ScreenState = {
  universes: [],
  industries: [],
  filters: [],
  columns: [],
  sort: {key: 'market_cap', dir: 'desc'},
};

export const WATCHLIST_UNIVERSE_PREFIX = 'wl:';

/** A screen that asks nothing. It stays out of the URL, so the page has a
 *  clean address until the reader has built something worth sharing. */
export const isEmptyScreen = (state: ScreenState): boolean =>
  state.universes.length === 0 &&
  state.industries.length === 0 &&
  state.filters.length === 0 &&
  state.columns.length === 0;

/** The columns a table shows: the server's base, then one per filter, then the
 *  reader's own — the order they were added in. */
export function visibleColumns(state: ScreenState): string[] {
  const out = [...BASE_COLUMNS];
  for (const key of [
    ...state.filters.filter(isActiveFilter).map(f => f.field),
    ...state.columns,
  ]) {
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

/** A watchlist's symbols by its id (without the `wl:` prefix); empty until the list has loaded. */
export type WatchlistSymbols = (id: string) => readonly string[];

/**
 * Whether this screen can be sent at all.
 *
 * A watchlist universe resolves client-side to its symbols. If the list has
 * not loaded yet, or holds nothing, that resolution is empty — and an empty
 * `universes` with an empty `symbols` is exactly how the request says "no
 * universe chosen", which the server answers with the entire market. A shared
 * link to a watchlist screen would open on four thousand rows presented as
 * matches. Better to run nothing until the list is known.
 */
export function isRunnable(
  state: ScreenState,
  watchlistSymbols: WatchlistSymbols,
): boolean {
  const fromLists = state.universes.filter(id =>
    id.startsWith(WATCHLIST_UNIVERSE_PREFIX),
  );
  if (fromLists.length === 0 || fromLists.length < state.universes.length)
    return true;
  return fromLists.some(
    id =>
      watchlistSymbols(id.slice(WATCHLIST_UNIVERSE_PREFIX.length)).length > 0,
  );
}

/** Turns the screen into a request: watchlist universes resolve to their
 *  symbols, which is what the server screens by. */
export function toRequest(
  state: ScreenState,
  watchlistSymbols: WatchlistSymbols,
): ScreenRequest {
  const universes: string[] = [];
  const symbols: string[] = [];
  for (const id of state.universes) {
    if (id.startsWith(WATCHLIST_UNIVERSE_PREFIX)) {
      symbols.push(
        ...watchlistSymbols(id.slice(WATCHLIST_UNIVERSE_PREFIX.length)),
      );
    } else {
      universes.push(id);
    }
  }
  return {
    universes,
    symbols,
    industries: state.industries,
    filters: state.filters.filter(isActiveFilter),
    columns: state.columns,
  };
}

/** A figure a company does not report sorts last, whichever way the column is
 *  ordered — a descending sort must never open on a column of dashes. */
export function sortScreenRows(
  rows: ScreenRow[],
  sort: ScreenState['sort'],
): ScreenRow[] {
  if (!sort) return rows;
  const {key, dir} = sort;
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      const cmp = a.name.localeCompare(b.name);
      return dir === 'asc' ? cmp : -cmp;
    }
    const av = a.values[key];
    const bv = b.values[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir === 'asc' ? av - bv : bv - av;
  });
}

/**
 * `btoa`/`atob` through `globalThis`, typed locally: neither is in React Native's type library,
 * and core must compile inside every consumer's program. Hermes, Node and browsers provide both.
 */
const base64 = globalThis as unknown as {
  btoa: (data: string) => string;
  atob: (data: string) => string;
};

const encode = (value: unknown): string =>
  base64.btoa(encodeURIComponent(JSON.stringify(value))).replace(/=+$/, '');

// The padding stripped above goes back before decoding: the spec's atob does without it, but a
// stricter one would turn every shared link away.
const decode = (raw: string): unknown =>
  JSON.parse(
    decodeURIComponent(
      base64.atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, '=')),
    ),
  );

/** The screen, packed small enough for a URL so a screen can be shared or
 *  bookmarked and come back exactly as it was. The two apps pack the same
 *  screen into the same string. */
export function encodeScreen(state: ScreenState): string {
  return encode({
    u: state.universes,
    i: state.industries,
    f: state.filters,
    c: state.columns,
    s: state.sort,
    p: state.preset,
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];

const isFilterShape = (value: unknown): value is ScreenFilter =>
  isRecord(value) && typeof value.field === 'string';

const isSort = (value: unknown): value is NonNullable<ScreenState['sort']> =>
  isRecord(value) &&
  typeof value.key === 'string' &&
  (value.dir === 'asc' || value.dir === 'desc');

/** A packed screen, or null when it is not one. Its ids are checked against
 *  the catalogue by `pruneScreen`, not here. */
export function decodeScreen(
  raw: string | null | undefined,
): ScreenState | null {
  if (!raw) return null;
  try {
    const v = decode(raw);
    if (!isRecord(v)) return null;
    return {
      universes: strings(v.u),
      industries: strings(v.i),
      filters: Array.isArray(v.f)
        ? (v.f as unknown[]).filter(isFilterShape)
        : [],
      columns: strings(v.c),
      sort: isSort(v.s) ? v.s : EMPTY_SCREEN.sort,
      preset: typeof v.p === 'string' ? v.p : undefined,
    };
  } catch {
    return null;
  }
}

const isBound = (value: unknown): boolean =>
  value == null || (typeof value === 'number' && Number.isFinite(value));

function isKnownField(index: CatalogIndex, key: string): boolean {
  const {id, tf} = splitFieldId(key);
  const field = index.byId.get(id);
  if (!field) return false;
  if (tf === SCREEN_DEFAULT_TIMEFRAME) return true;
  return (
    !!field.technical && (field.timeframes ?? index.timeframes).includes(tf)
  );
}

const isKnownFilter = (index: CatalogIndex, filter: ScreenFilter): boolean =>
  isKnownField(index, filter.field) &&
  (!filter.ref || isKnownField(index, filter.ref)) &&
  isBound(filter.min) &&
  isBound(filter.max) &&
  isBound(filter.factor);

export interface KnownIds {
  universes: ReadonlySet<string>;
  /** `wl:`-prefixed ids; unset while the lists load, which keeps every watchlist universe. */
  watchlists?: ReadonlySet<string> | undefined;
  /** Unset until the industry tree loads, which keeps every industry. */
  industries?: ReadonlyMap<string, unknown> | undefined;
}

const isKnownUniverse = (id: string, {universes, watchlists}: KnownIds) =>
  id.startsWith(WATCHLIST_UNIVERSE_PREFIX)
    ? !watchlists || watchlists.has(id)
    : universes.has(id);

/** The screen without the ids the catalogue, the watchlists or the industry
 *  tree do not know. The same object comes back when nothing was dropped, so a
 *  caller can tell a checked screen by reference. */
export function pruneScreen(
  state: ScreenState,
  index: CatalogIndex,
  known: KnownIds,
): ScreenState {
  const {industries} = known;
  const pruned = {
    universes: state.universes.filter(id => isKnownUniverse(id, known)),
    industries: industries
      ? state.industries.filter(id => industries.has(id))
      : state.industries,
    filters: state.filters.filter(f => isKnownFilter(index, f)),
    columns: state.columns.filter(key => isKnownField(index, key)),
  };
  const unchanged = (Object.keys(pruned) as (keyof typeof pruned)[]).every(
    key => pruned[key].length === state[key].length,
  );
  return unchanged ? state : {...state, ...pruned};
}

/**
 * Whether the catalogue knows every field a screen filters on or shows. A prebuilt screen on
 * fields this server does not compute (the ESF and options-regime screens, until their backend
 * ships) is not offered at all: `pruneScreen` would drop its every filter and open it on the whole
 * market presented as matches.
 */
export function hasKnownFields(
  index: CatalogIndex,
  screen: {
    filters: readonly ScreenFilter[];
    columns?: readonly string[] | undefined;
  },
): boolean {
  return (
    screen.filters.every(filter => isKnownFilter(index, filter)) &&
    (screen.columns ?? []).every(key => isKnownField(index, key))
  );
}
