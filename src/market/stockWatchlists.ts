import type {
  StockWatchlist,
  StockWatchlistSection,
} from '../types/stockWatchlist.ts';

/** Server caps (handlers/stockwatchlists): lists per account, symbols per list. */
export const MAX_WATCHLISTS = 20;
export const MAX_WATCHLIST_ITEMS = 250;

/** Which lists hold which symbols, and every symbol on any list — what a bookmark reads. */
export interface WatchlistMembership {
  byListId: Map<string, Set<string>>;
  all: Set<string>;
}

/** Sections keep only symbols still on the list — the server prunes the same way. */
export const pruneSections = (
  sections: readonly StockWatchlistSection[],
  symbols: readonly string[],
): StockWatchlistSection[] => {
  const onList = new Set(symbols);
  return sections.map(section => ({
    ...section,
    symbols: section.symbols.filter(symbol => onList.has(symbol)),
  }));
};

/**
 * What an add would actually put on the list: each symbol once, none it already holds, in the
 * order asked. An unknown list holds nothing, so every symbol is new to it.
 */
export const freshSymbols = (
  list: Pick<StockWatchlist, 'symbols'> | undefined,
  symbols: readonly string[],
): string[] => {
  const have = new Set(list?.symbols ?? []);
  return [...new Set(symbols)].filter(symbol => !have.has(symbol));
};

/**
 * Whether adding `count` more symbols takes the list past what the server keeps. It refuses the
 * whole batch rather than the excess, so the check is on the total.
 */
export const exceedsWatchlistCap = (
  list: Pick<StockWatchlist, 'symbols'>,
  count: number,
): boolean => list.symbols.length + count > MAX_WATCHLIST_ITEMS;

/** The list after an add: the new symbols go on top, since a list reads newest first. */
export const withSymbolsAdded = (
  list: StockWatchlist,
  symbols: readonly string[],
): StockWatchlist => ({
  ...list,
  symbols: [...freshSymbols(list, symbols), ...list.symbols],
});

/** The list after a removal, with its sections pruned to match. */
export const withSymbolRemoved = (
  list: StockWatchlist,
  symbol: string,
): StockWatchlist => {
  const symbols = list.symbols.filter(entry => entry !== symbol);
  return {...list, symbols, sections: pruneSections(list.sections, symbols)};
};

/** The list with its whole order and grouping replaced; a section keeps only listed symbols. */
export const withItemsReplaced = (
  list: StockWatchlist,
  symbols: readonly string[],
  sections: readonly StockWatchlistSection[],
): StockWatchlist => ({
  ...list,
  symbols: [...symbols],
  sections: pruneSections(sections, symbols),
});

/**
 * A row the server returned, written into the lists: it replaces the list with its id, or joins
 * the end, where a list the server has just made comes back on the next fetch.
 */
export const upsertWatchlist = (
  lists: readonly StockWatchlist[] | undefined,
  row: StockWatchlist,
): StockWatchlist[] => {
  const rows = lists ?? [];
  return rows.some(list => list.id === row.id)
    ? rows.map(list => (list.id === row.id ? row : list))
    : [...rows, row];
};

export const watchlistMembership = (
  lists: readonly StockWatchlist[],
): WatchlistMembership => {
  const byListId = new Map<string, Set<string>>();
  const all = new Set<string>();
  for (const list of lists) {
    const symbols = new Set(list.symbols);
    byListId.set(list.id, symbols);
    for (const symbol of symbols) all.add(symbol);
  }
  return {byListId, all};
};
