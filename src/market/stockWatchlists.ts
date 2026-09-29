import type {
  FlagColor,
  StockWatchlist,
  StockWatchlistFlag,
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

/** The seven flag colours, in the order TradingView offers them. */
export const FLAG_COLORS: readonly FlagColor[] = [
  'red',
  'blue',
  'green',
  'orange',
  'purple',
  'cyan',
  'pink',
];

/** Each flagged symbol's colour, read off the flags the server keeps. */
export const flagsBySymbol = (
  flags: readonly StockWatchlistFlag[],
): Map<string, FlagColor> => {
  const out = new Map<string, FlagColor>();
  for (const flag of flags) out.set(flag.symbol, flag.color);
  return out;
};

/**
 * The flags with `symbol`'s set to `color`, or cleared when it is null. A symbol carries one flag,
 * so a new colour replaces the old one, and goes first as the newest.
 */
export const withFlag = (
  flags: readonly StockWatchlistFlag[] | undefined,
  symbol: string,
  color: FlagColor | null,
  at: string,
): StockWatchlistFlag[] => {
  const rest = (flags ?? []).filter(flag => flag.symbol !== symbol);
  return color === null ? rest : [{symbol, color, updated_at: at}, ...rest];
};

/** The symbols one colour flags, in the flags' own order: a flag colour opened as a list. */
export const flaggedSymbols = (
  flags: ReadonlyMap<string, FlagColor>,
  color: FlagColor,
): string[] =>
  [...flags.entries()]
    .filter(([, flagged]) => flagged === color)
    .map(([symbol]) => symbol);

/** How many symbols each colour flags; a colour that flags none is left out. */
export const flagCounts = (
  flags: ReadonlyMap<string, FlagColor>,
): Map<FlagColor, number> => {
  const counts = new Map<FlagColor, number>();
  for (const color of flags.values())
    counts.set(color, (counts.get(color) ?? 0) + 1);
  return counts;
};

/** Whether the list has a section of that name; names are compared case aside. */
export const hasSection = (
  sections: readonly StockWatchlistSection[],
  name: string,
): boolean =>
  sections.some(section => section.name.toLowerCase() === name.toLowerCase());

/** The sections with `symbol` filed under `section` at its end, or under none when it is null. */
export const withSymbolMoved = (
  sections: readonly StockWatchlistSection[],
  symbol: string,
  section: string | null,
): StockWatchlistSection[] =>
  sections.map(entry => {
    const symbols = entry.symbols.filter(filed => filed !== symbol);
    return {
      ...entry,
      symbols: entry.name === section ? [...symbols, symbol] : symbols,
    };
  });

/** The sections with one renamed; its symbols stay under it. */
export const withSectionRenamed = (
  sections: readonly StockWatchlistSection[],
  from: string,
  to: string,
): StockWatchlistSection[] =>
  sections.map(section =>
    section.name === from ? {...section, name: to} : section,
  );

/** The sections without one; its symbols stay on the list, filed under none. */
export const withoutSection = (
  sections: readonly StockWatchlistSection[],
  name: string,
): StockWatchlistSection[] => sections.filter(section => section.name !== name);

/** What Clear list leaves: no symbols, and every section still there, empty. */
export const clearedItems = (
  list: Pick<StockWatchlist, 'sections'>,
): {symbols: string[]; sections: StockWatchlistSection[]} => ({
  symbols: [],
  sections: list.sections.map(section => ({...section, symbols: []})),
});

/** Where a list with a public link opens, under the web app's origin. */
export const sharedWatchlistPath = (shareId: string): string =>
  `/watchlist/shared/${encodeURIComponent(shareId)}`;
