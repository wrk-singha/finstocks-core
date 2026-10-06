import type {
  LibraryComplexity,
  LibraryDirection,
  LibraryHorizon,
  LibrarySegment,
  LibraryStrategy,
  LibraryStyle,
} from '../types/strategyLibrary.ts';

// Filtering and sorting for the black-box strategy library, client-side as web `dev` has it
// (src/utils/strategy/libraryFilters.ts). The count label is `strategyCount` in `screener/`.

/** Panel filter state for the strategy library (client-side only). Empty = any. */
export interface LibraryFilterState {
  styles: LibraryStyle[];
  segments: LibrarySegment[];
  riskLevels: number[];
  directions: LibraryDirection[];
  complexity: LibraryComplexity[];
  /** Only strategies whose worst case is fixed by the structure at entry. */
  cappedOnly: boolean;
  /** Only strategies with a protective stop or managed exit. */
  protectiveOnly: boolean;
  /** Only strategies that are flat every night. */
  flatOvernight: boolean;
  /** Show legacy versions and demonstrations alongside deployable strategies. */
  includeReference: boolean;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
  styles: [],
  segments: [],
  riskLevels: [],
  directions: [],
  complexity: [],
  cappedOnly: false,
  protectiveOnly: false,
  flatOvernight: false,
  includeReference: true,
};

export type LibraryHorizonFilter = 'ALL' | LibraryHorizon;

export type LibraryScope = 'EQUITY' | 'FNO';

/** The Stocks or F&O tab's share of the library. */
export function scopeLibrary(
  list: readonly LibraryStrategy[],
  scope: LibraryScope,
): LibraryStrategy[] {
  return list.filter(s => (scope === 'FNO' ? s.is_fno : !s.is_fno));
}

export function applyLibraryFilters(
  list: readonly LibraryStrategy[],
  f: LibraryFilterState,
): LibraryStrategy[] {
  return list.filter(s => {
    if (f.styles.length && !f.styles.includes(s.style)) return false;
    if (f.segments.length && !f.segments.includes(s.segment)) return false;
    if (f.riskLevels.length && !f.riskLevels.includes(s.risk_level))
      return false;
    if (f.directions.length && !f.directions.includes(s.direction))
      return false;
    if (f.complexity.length && !f.complexity.includes(s.complexity))
      return false;
    if (f.cappedOnly && !s.risk_capped) return false;
    if (f.protectiveOnly && !s.protective_exit) return false;
    if (f.flatOvernight && s.holds_overnight) return false;
    if (!f.includeReference && s.availability === 'reference') return false;
    return true;
  });
}

export function countActiveLibraryFilters(f: LibraryFilterState): number {
  return (
    (f.styles.length ? 1 : 0) +
    (f.segments.length ? 1 : 0) +
    (f.riskLevels.length ? 1 : 0) +
    (f.directions.length ? 1 : 0) +
    (f.complexity.length ? 1 : 0) +
    (f.cappedOnly ? 1 : 0) +
    (f.protectiveOnly ? 1 : 0) +
    (f.flatOvernight ? 1 : 0) +
    (f.includeReference ? 0 : 1)
  );
}

/**
 * The values of one field present in a list, in first-seen order — so a panel only offers chips
 * that can match something in the current tab.
 */
export function presentValues<T>(
  list: readonly LibraryStrategy[],
  pick: (s: LibraryStrategy) => T,
): T[] {
  const seen = new Set<T>();
  for (const s of list) seen.add(pick(s));
  return [...seen];
}

export type LibrarySort = 'recommended' | 'risk_asc' | 'risk_desc' | 'name';

/**
 * Recommended order is the catalogue's own, with reference strategies after the deployable ones.
 * Every sort keeps that split so a reference entry never leads.
 */
export function sortLibrary(
  list: readonly LibraryStrategy[],
  sort: LibrarySort,
): LibraryStrategy[] {
  const indexed = list.map((s, i) => ({s, i}));
  const refRank = (s: LibraryStrategy) =>
    s.availability === 'reference' ? 1 : 0;
  indexed.sort((a, b) => {
    const ref = refRank(a.s) - refRank(b.s);
    if (ref !== 0) return ref;
    switch (sort) {
      case 'risk_asc':
        return a.s.risk_level - b.s.risk_level || a.i - b.i;
      case 'risk_desc':
        return b.s.risk_level - a.s.risk_level || a.i - b.i;
      case 'name':
        return a.s.name.localeCompare(b.s.name);
      default:
        return a.i - b.i;
    }
  });
  return indexed.map(({s}) => s);
}

/** Web's Risk chip cycles ascending → descending → recommended; A–Z toggles against recommended. */
export function nextLibrarySort(
  current: LibrarySort,
  chip: 'risk' | 'name',
): LibrarySort {
  if (chip === 'name') return current === 'name' ? 'recommended' : 'name';
  return current === 'risk_asc'
    ? 'risk_desc'
    : current === 'risk_desc'
      ? 'recommended'
      : 'risk_asc';
}

/**
 * The library as a tab shows it: scoped, narrowed to one horizon, filtered and sorted. The whole
 * pipeline in one call so both apps agree on the order and the count.
 */
export function viewLibrary(
  list: readonly LibraryStrategy[],
  view: {
    scope: LibraryScope;
    horizon: LibraryHorizonFilter;
    filters: LibraryFilterState;
    sort: LibrarySort;
  },
): LibraryStrategy[] {
  const scoped = scopeLibrary(list, view.scope);
  const byHorizon =
    view.horizon === 'ALL'
      ? scoped
      : scoped.filter(s => s.horizon === view.horizon);
  return sortLibrary(applyLibraryFilters(byHorizon, view.filters), view.sort);
}
