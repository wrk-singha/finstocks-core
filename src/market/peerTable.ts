import type {
  IndustryCrumb,
  PeerColumn,
  PeerRow,
  PeerTable,
} from '../types/industries.ts';

/**
 * The row a `symbol` query's own company starts at when it ranks below the page: the server
 * appends it after the page, so any row past `per_page` is that company, pinned under the ranked
 * ones. Null when it ranks inside the page.
 */
export const peerPinnedFrom = (
  table: Pick<PeerTable, 'rows' | 'per_page'>,
): number | null =>
  table.rows.length > table.per_page ? table.per_page : null;

/**
 * Where a company sits, macro sector down to its own industry. Several of NSE's macro sectors hold
 * a single sector of the same name ("Healthcare › Healthcare"); the repeat is dropped, since it
 * covers the same companies and reads as a stutter.
 */
export const industryCrumbs = (
  path: readonly IndustryCrumb[],
): IndustryCrumb[] =>
  path.filter((crumb, i) => i === 0 || crumb.name !== path[i - 1]?.name);

/** The columns a phone keeps, in this order, whenever the selection has them. */
export const PHONE_PEER_COLUMNS: readonly string[] = [
  'price',
  'pe',
  'market_cap',
  'roce',
];

/**
 * A selection narrowed for a phone, never written back: nine columns on a 375pt screen is a table
 * read three numbers at a time. The preferred ids lead when the selection has them, and the rest
 * follow in their chosen order, so a selection that keeps none of them still fills the row.
 */
export const narrowPeerColumnsForPhone = (ids: readonly string[]): string[] => {
  const preferred = PHONE_PEER_COLUMNS.filter(id => ids.includes(id));
  const rest = ids.filter(id => !preferred.includes(id));
  return [...preferred, ...rest].slice(0, PHONE_PEER_COLUMNS.length);
};

export type PeerCompareSectionId =
  'valuation' | 'growth' | 'quality' | 'safety' | 'size' | 'returns';

/** The lines two companies are compared on, section by section. */
export const PEER_COMPARE_SECTIONS: readonly {
  readonly id: PeerCompareSectionId;
  readonly columns: readonly string[];
}[] = [
  {
    id: 'valuation',
    columns: ['pe', 'pb', 'ev_ebitda', 'peg', 'dividend_yield'],
  },
  {
    id: 'growth',
    columns: [
      'sales_growth',
      'profit_growth',
      'sales_growth_3y',
      'profit_growth_3y',
    ],
  },
  {id: 'quality', columns: ['roce', 'roe', 'opm', 'cfo_to_op']},
  {
    id: 'safety',
    columns: [
      'debt_to_equity',
      'interest_cover',
      'promoter_holding',
      'pledged',
    ],
  },
  {id: 'size', columns: ['market_cap', 'sales', 'pat']},
  {id: 'returns', columns: ['return_1y', 'return_3y']},
];

/** Every column the comparison asks the peer table for. */
export const PEER_COMPARE_COLUMNS: readonly string[] =
  PEER_COMPARE_SECTIONS.flatMap(section => section.columns);

/**
 * The two rows of a `symbols` query, in the order they were asked for, so the company the reader
 * came from keeps its colour whichever way the server sorted them. Null unless both came back.
 */
export const peerComparePair = (
  rows: readonly PeerRow[],
  symbols: readonly [string, string],
): [PeerRow, PeerRow] | null => {
  const [first, second] = rows;
  if (rows.length !== 2 || first === undefined || second === undefined) {
    return null;
  }
  const find = (symbol: string) =>
    rows.find(row => row.symbol.toUpperCase() === symbol.toUpperCase());
  const asked = find(symbols[0]);
  const other = find(symbols[1]);
  return asked !== undefined && other !== undefined && asked !== other
    ? [asked, other]
    : [first, second];
};

/** Which of the pair does better on one line: 0 the first, 1 the second, null when it cannot be judged. */
export const peerCompareWinner = (
  first: number | null | undefined,
  second: number | null | undefined,
  column: Pick<PeerColumn, 'better'>,
): 0 | 1 | null => {
  if (first == null || second == null) return null;
  if (first === second || column.better === 0) return null;
  const isFirstHigher = first > second;
  return isFirstHigher === column.better > 0 ? 0 : 1;
};

/**
 * How many compared lines each company wins, for the reader who wants one sentence out of twenty
 * rows. A column the catalogue does not know is skipped: without its direction nobody wins it.
 */
export const peerCompareTally = (
  pair: readonly [PeerRow, PeerRow],
  columns: ReadonlyMap<string, Pick<PeerColumn, 'better'>>,
): [number, number] => {
  const wins: [number, number] = [0, 0];
  for (const id of PEER_COMPARE_COLUMNS) {
    const column = columns.get(id);
    if (column === undefined) continue;
    const winner = peerCompareWinner(
      pair[0].values[id],
      pair[1].values[id],
      column,
    );
    if (winner !== null) wins[winner] += 1;
  }
  return wins;
};

export type PeerCompareBar = {
  /** Share of the line's larger magnitude, 2 to 100. */
  readonly pct: number;
  readonly isNegative: boolean;
};

const MIN_BAR_PCT = 2;

/**
 * The pair of bars on one compare line. Each line is scaled to its own larger figure, so the bars
 * say "how much bigger" for that metric alone: a P/E and a market cap share no scale and are never
 * drawn against each other. A figure too small to see still shows a sliver; a missing one has no
 * bar.
 */
export const peerCompareBars = (
  first: number | null | undefined,
  second: number | null | undefined,
): [PeerCompareBar | null, PeerCompareBar | null] => {
  const scale = Math.max(Math.abs(first ?? 0), Math.abs(second ?? 0)) || 1;
  const bar = (value: number | null | undefined): PeerCompareBar | null =>
    value == null
      ? null
      : {
          pct: Math.max((Math.abs(value) / scale) * 100, MIN_BAR_PCT),
          isNegative: value < 0,
        };
  return [bar(first), bar(second)];
};
