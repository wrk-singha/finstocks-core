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
