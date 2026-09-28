/**
 * The industry classification tree: macro sector, sector, industry, and the vendor industry a
 * company is filed under. Node ids are paths (`a/b/c`), so a node's descendants share its id as a
 * prefix. The screener's sector picker and the industry pages read the same tree.
 */
export interface IndustryNode {
  id: string;
  name: string;
  level: number;
  /** Companies filed under this node, at any depth. */
  count: number;
  children?: IndustryNode[];
}

export interface IndustryTree {
  total: number;
  nodes: IndustryNode[];
}

/** One step of a company's place in the tree, macro sector down to its own industry. */
export interface IndustryCrumb {
  id: string;
  name: string;
  level: number;
}

export type PeerColumnUnit =
  'crore' | 'rupees' | 'pct' | 'x' | 'days' | 'count' | 'score';

/** What a figure describes: the latest period, the one before it, or a multi-year history. */
export type PeerColumnKind = 'recent' | 'preceding' | 'historical';

/** One column a peer table can show. */
export interface PeerColumn {
  id: string;
  label: string;
  header: string;
  unit: PeerColumnUnit;
  /** The catalogue tab the column picker files it under. */
  tab: string;
  kind: PeerColumnKind;
  most_used: boolean;
  default: boolean;
  /** Which way is favourable against the median: 1 higher, -1 lower, 0 neither. */
  better: -1 | 0 | 1;
  description?: string;
}

export interface PeerColumnCatalog {
  tabs: {id: string; label: string}[];
  columns: PeerColumn[];
}

export interface PeerRow {
  /** The id a `symbols` query and a search hit carry. */
  symbol: string;
  /** The NSE ticker the stock page opens on. */
  ticker: string;
  name: string;
  /** Keyed by column id; a figure the company does not file is absent. */
  values: Record<string, number | undefined>;
  /** The company a `symbol` query asked about. */
  current?: boolean;
}

export type PeerSortOrder = 'asc' | 'desc';

/**
 * One page of an industry's companies. A `symbol` query answers with that company's own industry,
 * and when the company ranks below the page it rides after it as one extra row, so `rows` can hold
 * `per_page + 1`.
 */
export interface PeerTable {
  path: IndustryCrumb[];
  node: IndustryCrumb;
  total: number;
  page: number;
  per_page: number;
  sort: string;
  order: PeerSortOrder;
  columns: string[];
  rows: PeerRow[];
  /** Over every company in the node, not only the page shown. */
  median: Record<string, number> | null;
  index_membership?: string[];
}

/** One of `node`, `symbol` or `symbols` says whose companies; the rest shape the page. */
export interface PeerTableQuery {
  node?: string | undefined;
  symbol?: string | undefined;
  symbols?: readonly string[] | undefined;
  columns: readonly string[];
  sort?: string | undefined;
  order?: PeerSortOrder | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
}

export interface IndustrySearchHit {
  symbol: string;
  ticker: string;
  name: string;
  /** Where the company is filed, as one line. */
  path: string;
}
