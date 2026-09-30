import type {
  StockWatchlist,
  StockWatchlistDetail,
  StockWatchlistSection,
} from '../types/stockWatchlist.ts';

/** The advanced view's figure tabs, in the order it draws them. */
export type WatchlistTab =
  'price' | 'financials' | 'performance' | 'risk' | 'technicals';

type NumericDetailKey = {
  [K in keyof StockWatchlistDetail]-?: StockWatchlistDetail[K] extends
    number | null
    ? K
    : never;
}[keyof StockWatchlistDetail];

/** A figure of a list's row: a number, or the two text columns, the trend and the sector. */
export type WatchlistColumnKey = NumericDetailKey | 'signal' | 'sector';

export interface WatchlistColumn {
  key: WatchlistColumnKey;
  label: string;
}

export const WATCHLIST_TABS: readonly {id: WatchlistTab; label: string}[] = [
  {id: 'price', label: 'Price'},
  {id: 'financials', label: 'Financials'},
  {id: 'performance', label: 'Performance'},
  {id: 'risk', label: 'Risk'},
  {id: 'technicals', label: 'Technicals'},
];

/** Every column the advanced view can show, grouped the way its tabs are. */
export const WATCHLIST_COLUMNS: Readonly<
  Record<WatchlistTab, readonly WatchlistColumn[]>
> = {
  price: [
    {key: 'last', label: 'Last'},
    {key: 'change_pct', label: 'Chg%'},
    {key: 'change', label: 'Chg'},
    {key: 'volume', label: 'Volume'},
    {key: 'avg_vol_10', label: 'Avg Vol (10)'},
    {key: 'market_cap', label: 'Market Cap'},
  ],
  financials: [
    {key: 'market_cap', label: 'Market Cap'},
    {key: 'pe', label: 'P/E (TTM)'},
    {key: 'eps', label: 'EPS (TTM)'},
    {key: 'pb', label: 'P/B'},
    {key: 'ev_ebitda', label: 'EV/EBITDA'},
    {key: 'dividend_yield', label: 'Div Yield'},
    {key: 'sector', label: 'Sector'},
  ],
  performance: [
    {key: 'perf_1w', label: '1W'},
    {key: 'perf_1m', label: '1M'},
    {key: 'perf_3m', label: '3M'},
    {key: 'perf_6m', label: '6M'},
    {key: 'perf_ytd', label: 'YTD'},
    {key: 'perf_1y', label: '1Y'},
  ],
  risk: [
    {key: 'volatility', label: 'Volatility (1Y)'},
    {key: 'beta', label: 'Beta (1Y)'},
    {key: 'max_drawdown', label: 'Max Drawdown (1Y)'},
    {key: 'high_52w', label: '52W High'},
    {key: 'low_52w', label: '52W Low'},
  ],
  technicals: [
    {key: 'signal', label: 'Trend'},
    {key: 'rsi_14', label: 'RSI (14)'},
    {key: 'macd_hist', label: 'MACD Hist'},
    {key: 'sma_20', label: 'SMA 20'},
    {key: 'sma_50', label: 'SMA 50'},
    {key: 'sma_200', label: 'SMA 200'},
  ],
};

/** Excel reads a CSV as UTF-8 only when it starts with a byte-order mark; a file writer prepends it. */
export const CSV_BOM = '\uFEFF';

/** One CSV field: empty for no value, a number at most six decimals, quoted when it must be. */
export const csvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'number' ? String(Number(value.toFixed(6))) : value;
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** A file name from a list's name: word characters, dashes and underscores only. */
export const exportFileName = (
  name: string,
  extension: string,
  fallback = 'export',
): string =>
  `${
    name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '_') || fallback
  }.${extension}`;

/**
 * The list as TradingView exports it: one symbol per line, the unfiled ones first, then each
 * section as a "###Name" line over its symbols — the same file Import reads back.
 */
export const watchlistTxt = (
  list: Pick<StockWatchlist, 'symbols' | 'sections'>,
): string => {
  const sectioned = new Set(list.sections.flatMap(section => section.symbols));
  const lines = list.symbols.filter(symbol => !sectioned.has(symbol));
  for (const section of list.sections)
    lines.push(`###${section.name}`, ...section.symbols);
  return lines.join('\n');
};

/**
 * Every figure on every tab as raw numbers, one row per detail row in the order the server sent
 * them, with each symbol's section. The text only: a file writer adds `CSV_BOM`.
 */
export const watchlistCsv = (
  list: Pick<StockWatchlist, 'sections'>,
  details: readonly StockWatchlistDetail[],
): string => {
  const columns = WATCHLIST_TABS.flatMap(
    tab => WATCHLIST_COLUMNS[tab.id],
  ).filter(
    (column, index, all) =>
      all.findIndex(other => other.key === column.key) === index,
  );
  const sectionOf = new Map<string, string>();
  for (const section of list.sections)
    for (const symbol of section.symbols) sectionOf.set(symbol, section.name);
  const header = [
    'Symbol',
    'Name',
    'Type',
    'Exchange',
    'Section',
    ...columns.map(column => column.label),
    'As of',
  ];
  const rows = details.map(detail => [
    detail.symbol,
    detail.name,
    detail.type,
    detail.exchange,
    sectionOf.get(detail.symbol) ?? '',
    ...columns.map(column => detail[column.key]),
    detail.as_of ?? '',
  ]);
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
};

const SYMBOL_LINE = /^[A-Z0-9][A-Z0-9&._ -]{0,47}$/;
const SECTION_NAME_MAX = 40;

/**
 * Reads an exported list back: a symbol per line or per comma, an exchange prefix ("NSE:") dropped,
 * each once, and a "###Name" line opening a section the symbols after it fall under. A line that
 * cannot be a symbol is skipped.
 */
export const parseWatchlistFile = (
  text: string,
): {symbols: string[]; sections: StockWatchlistSection[]} => {
  const symbols: string[] = [];
  const sections: StockWatchlistSection[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('###')) {
      sections.push({
        name: line.slice(3).trim().slice(0, SECTION_NAME_MAX) || 'Section',
        symbols: [],
      });
      continue;
    }
    const symbol = line.replace(/^[A-Z]+:/i, '').toUpperCase();
    if (!SYMBOL_LINE.test(symbol) || symbols.includes(symbol)) continue;
    symbols.push(symbol);
    sections.at(-1)?.symbols.push(symbol);
  }
  return {symbols, sections};
};
