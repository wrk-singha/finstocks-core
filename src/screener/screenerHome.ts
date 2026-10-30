import type {PrebuiltScreen} from '../data/prebuiltScreens.ts';
import {pluralCount} from '../format/text.ts';
import type {ScreenFilter} from '../types/screen.ts';
import {EMPTY_SCREEN, isActiveFilter, type ScreenState} from './screenModel.ts';

/*
 * The screener's home and a screen's own page: the plain rules their cards and
 * headers follow. Which page an address or a route opens is each app's own;
 * what a card lists, what a search finds and what a page is called are the same
 * in both.
 */

/** A prebuilt screen as the screener opens it, marked with its id so the page can name it. */
export const prebuiltScreenState = (screen: PrebuiltScreen): ScreenState => ({
  ...EMPTY_SCREEN,
  universes: screen.universes ?? [],
  filters: screen.filters,
  columns: screen.columns ?? [],
  sort: screen.sort ?? EMPTY_SCREEN.sort,
  preset: screen.id,
});

/** The fields a screen asks about, each once, in the order asked — a compared-with field included. */
export function screenFields(filters: readonly ScreenFilter[]): string[] {
  const out: string[] = [];
  for (const filter of filters) {
    for (const id of [filter.field, filter.ref]) {
      if (id && !out.includes(id)) out.push(id);
    }
  }
  return out;
}

/**
 * A card's footer: the first few names, then how many more. Names that read the
 * same (a field and its compared-with twin can share a header) count once.
 */
export function footerFields(
  labels: readonly string[],
  max = 3,
): {shown: string[]; more: number} {
  const unique = [...new Set(labels.filter(label => label.trim() !== ''))];
  return {
    shown: unique.slice(0, max),
    more: Math.max(0, unique.length - max),
  };
}

const fold = (text: string): string =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Every word of the query, in any order, anywhere in the text; case and accents aside. */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = fold(text);
  const words = fold(query).split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every(word => haystack.includes(word));
}

/** The screens whose name or blurb answer the query, in their own order. */
export function searchScreens<T extends {name: string; blurb: string}>(
  items: readonly T[],
  query: string,
): T[] {
  return items.filter(item =>
    matchesQuery(`${item.name} ${item.blurb}`, query),
  );
}

const filterKey = (f: ScreenFilter) => [
  f.field,
  f.min ?? null,
  f.max ?? null,
  f.flag ?? null,
  f.op ?? null,
  f.ref ?? null,
  f.factor ?? null,
];

/** What a stock screen scans; `symbols` is a fixed list of names, which only web's chat saves. */
export type ScreenScope = Pick<ScreenState, 'universes' | 'industries'> & {
  readonly symbols?: readonly string[] | undefined;
};

/**
 * What a stock screen asks — its stocks and its conditions — as one string, so
 * two screens can be told apart from what they ask rather than from how they
 * were reached. Columns and sort are left out: they change how the answer is
 * shown, not the answer. Pass only the filters that narrow (isActiveFilter).
 */
export function stockScreenKey(
  state: ScreenScope,
  activeFilters: readonly ScreenFilter[],
): string {
  return JSON.stringify([
    state.universes,
    state.industries,
    state.symbols ?? [],
    activeFilters.map(filterKey),
  ]);
}

/** The key of a whole screen: its own active filters. */
export const stockScreenKeyOf = (state: ScreenState & ScreenScope): string =>
  stockScreenKey(state, state.filters.filter(isActiveFilter));

/**
 * A name no other saved screen uses. Saving under a name already taken replaces
 * that screen, which a one-tap bookmark must never do to something else.
 */
export function uniqueName(name: string, taken: readonly string[]): string {
  const used = new Set(taken.map(t => t.trim().toLowerCase()));
  if (!used.has(name.trim().toLowerCase())) return name;
  for (let n = 2; ; n++) {
    const next = `${name} (${String(n)})`;
    if (!used.has(next.toLowerCase())) return next;
  }
}

/**
 * Whether a saved screen is the copy a card's bookmark made: saved under the
 * card's name, or the numbered name a bookmark falls back to when that one is
 * taken. A copy the reader named themselves is theirs, and the card never deletes it.
 */
export function isBookmarkCopy(savedName: string, cardName: string): boolean {
  const saved = savedName.trim().toLowerCase();
  const card = cardName.trim().toLowerCase();
  if (saved === card) return true;
  return (
    saved.startsWith(`${card} (`) &&
    /^\(\d+\)$/.test(saved.slice(card.length + 1))
  );
}

/** Of the screens matching what is on the page, the one saved last. */
export function latestMatch<T extends {savedAt: number}>(
  screens: readonly T[],
  matches: (screen: T) => boolean,
): T | undefined {
  let best: T | undefined;
  for (const screen of screens) {
    if (matches(screen) && (!best || screen.savedAt >= best.savedAt))
      best = screen;
  }
  return best;
}

/**
 * A filter's line in the Filters pane, as a label over its value, cut from the
 * words the filter's chip has always shown (filterLabel) so the two cannot
 * disagree. `name` is the field's own label as filterLabel names it. A chip
 * that is its bare name reads "Yes" only for a yes/no field; anything else
 * that cannot be cut cleanly is shown whole, never reworded.
 * English for the web app; mobile builds its lines from `filterParts`.
 */
export function splitFilterText(
  full: string,
  name: string,
  isFlag: boolean,
): {label: string; value: string} {
  if (isFlag && full === name) return {label: name, value: 'Yes'};
  if (isFlag && full === `Not ${name.toLowerCase()}`)
    return {label: name, value: 'No'};
  if (full.startsWith(name) && full.length > name.length) {
    const value = full
      .slice(name.length)
      .replace(/^\s*·\s*/, '')
      .trim();
    if (value) return {label: name, value};
  }
  return {label: name, value: full};
}

/**
 * A filter's condition as the screen states it, for a field the catalogue
 * could not name: its bounds or comparison as stored, without units it cannot
 * know. A shape it cannot read plainly (a pattern's window) says so rather
 * than read a value into it.
 */
export type RawConditionParts =
  | {
      kind: 'compare';
      op: 'gt' | 'lt';
      /** Null when the comparison is one-to-one. */
      factor: number | null;
      ref: string;
    }
  | {kind: 'flag'; want: boolean}
  | {kind: 'unreadable'}
  | {kind: 'between'; min: number; max: number}
  | {kind: 'above'; min: number}
  | {kind: 'below'; max: number}
  | {kind: 'incomplete'};

export function rawConditionParts(filter: ScreenFilter): RawConditionParts {
  if (filter.ref) {
    return {
      kind: 'compare',
      op: filter.op === 'lt' ? 'lt' : 'gt',
      factor:
        filter.factor != null && filter.factor !== 1 ? filter.factor : null,
      ref: filter.ref,
    };
  }
  const {min, max, flag} = filter;
  if (flag != null)
    return min == null && max == null
      ? {kind: 'flag', want: flag}
      : {kind: 'unreadable'};
  if (min != null && max != null) return {kind: 'between', min, max};
  if (min != null) return {kind: 'above', min};
  if (max != null) return {kind: 'below', max};
  return {kind: 'incomplete'};
}

/** `rawConditionParts` in words: "> 15", "0 – 2", "> 0.2 × market_cap". English for the web app. */
export function rawCondition(filter: ScreenFilter): string {
  const parts = rawConditionParts(filter);
  switch (parts.kind) {
    case 'compare': {
      const factor = parts.factor === null ? '' : `${String(parts.factor)} × `;
      return `${parts.op === 'lt' ? '<' : '>'} ${factor}${parts.ref}`;
    }
    case 'flag':
      return parts.want ? 'Yes' : 'No';
    case 'unreadable':
      return 'Condition could not be loaded';
    case 'between':
      return `${String(parts.min)} – ${String(parts.max)}`;
    case 'above':
      return `> ${String(parts.min)}`;
    case 'below':
      return `< ${String(parts.max)}`;
    case 'incomplete':
      return 'Incomplete — choose a value';
  }
}

/** A saved screen as much as its description reads: its conditions, a fixed list, options. */
export interface SavedScreenShape {
  state: {
    filters: readonly unknown[];
    symbols?: readonly string[] | undefined;
  };
  options?: {filters: readonly unknown[]} | undefined;
}

/** What a saved screen is, in parts: so many filters, or a fixed list of so many names. */
export type SavedScreenParts =
  {kind: 'filters'; count: number} | {kind: 'fixedList'; count: number};

export function savedScreenParts(screen: SavedScreenShape): SavedScreenParts {
  if (screen.options)
    return {kind: 'filters', count: screen.options.filters.length};
  const {filters, symbols} = screen.state;
  return symbols?.length
    ? {kind: 'fixedList', count: symbols.length}
    : {kind: 'filters', count: filters.length};
}

/** A screen over a fixed list of names, which only the chat saves: "12 stocks saved from the chat". */
export const fixedListLabel = (count: number): string =>
  `${pluralCount(count, 'stock')} saved from the chat`;

/** What a saved screen is, in a few words: "3 filters", "12 stocks saved from the chat". English for the web app. */
export function describeSavedScreen(screen: SavedScreenShape): string {
  const parts = savedScreenParts(screen);
  return parts.kind === 'fixedList'
    ? fixedListLabel(parts.count)
    : pluralCount(parts.count, 'filter');
}
