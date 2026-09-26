import type {IndustryNode} from '../types/industries.ts';

/**
 * Selecting industries from the four-level tree.
 *
 * The selection is stored as the highest nodes that are fully chosen — pick
 * every bank and the list says "Banks", not sixteen leaves. That is what the
 * server screens by, and what the chips can name without running out of room.
 */

export interface TreeEntry {
  node: IndustryNode;
  parent: string | null;
  depth: number;
}

export interface TreeIndex {
  byId: Map<string, TreeEntry>;
  roots: IndustryNode[];
}

export function indexTree(nodes: IndustryNode[] | undefined): TreeIndex {
  const byId = new Map<string, TreeEntry>();
  const walk = (list: IndustryNode[], parent: string | null, depth: number) => {
    for (const node of list) {
      byId.set(node.id, {node, parent, depth});
      walk(node.children ?? [], node.id, depth + 1);
    }
  };
  walk(nodes ?? [], null, 0);
  return {byId, roots: nodes ?? []};
}

const ancestors = (index: TreeIndex, id: string): string[] => {
  const out: string[] = [];
  let parent = index.byId.get(id)?.parent ?? null;
  // A tree that repeats an id indexes the last copy, which can leave two ids each other's parent;
  // without the check this walk would never end.
  while (parent && parent !== id && !out.includes(parent)) {
    out.push(parent);
    parent = index.byId.get(parent)?.parent ?? null;
  }
  return out;
};

export type NodeState = 'on' | 'partial' | 'off';

export function nodeState(
  index: TreeIndex,
  selected: string[],
  id: string,
): NodeState {
  if (
    selected.includes(id) ||
    ancestors(index, id).some(a => selected.includes(a))
  )
    return 'on';
  const entry = index.byId.get(id);
  if (!entry) return 'off';
  const children = entry.node.children ?? [];
  return children.some(c => nodeState(index, selected, c.id) !== 'off')
    ? 'partial'
    : 'off';
}

/** Everything chosen under this node, so a parent can be swapped for its
 *  children when one of them is unchecked. */
const pathTo = (index: TreeIndex, from: string, to: string): string[] => {
  const chain = [to, ...ancestors(index, to)];
  const at = chain.indexOf(from);
  return at < 0 ? [to] : chain.slice(0, at + 1).reverse();
};

export function toggleNode(
  index: TreeIndex,
  selected: string[],
  id: string,
): string[] {
  const selectedAncestor = [id, ...ancestors(index, id)].find(candidate =>
    selected.includes(candidate),
  );

  if (selectedAncestor) {
    const next = selected.filter(s => s !== selectedAncestor);
    // Unchecking one industry inside a chosen sector keeps the rest: the
    // sector becomes its other children, level by level down to the one left out.
    const path = pathTo(index, selectedAncestor, id);
    for (const [i, step] of path.slice(0, -1).entries()) {
      const children = index.byId.get(step)?.node.children ?? [];
      for (const child of children) {
        if (child.id !== path[i + 1]) next.push(child.id);
      }
    }
    return next;
  }

  const next = selected.filter(s => !s.startsWith(`${id}/`));
  next.push(id);
  return collapse(index, next);
}

/** A parent whose every child is chosen stands in for them. */
function collapse(index: TreeIndex, selected: string[]): string[] {
  let current = [...new Set(selected)];
  for (;;) {
    const parents = new Set(
      current
        .map(id => index.byId.get(id)?.parent)
        .filter((p): p is string => !!p),
    );
    const merged = [...parents].find(parent => {
      const children = index.byId.get(parent)?.node.children ?? [];
      return children.length > 0 && children.every(c => current.includes(c.id));
    });
    if (!merged) return current;
    const children = new Set(
      (index.byId.get(merged)?.node.children ?? []).map(c => c.id),
    );
    current = [merged, ...current.filter(id => !children.has(id))];
  }
}

export const nodeName = (index: TreeIndex, id: string): string =>
  index.byId.get(id)?.node.name ?? id;

/** How many companies the current selection covers. */
export function selectedCount(index: TreeIndex, selected: string[]): number {
  return selected.reduce(
    (total, id) => total + (index.byId.get(id)?.node.count ?? 0),
    0,
  );
}

/** Nodes matching a search, with the ancestors needed to show them in place. */
export function matchingNodes(index: TreeIndex, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  if (!q) return new Set();
  const keep = new Set<string>();
  for (const [id, entry] of index.byId) {
    if (!entry.node.name.toLowerCase().includes(q)) continue;
    keep.add(id);
    for (const parent of ancestors(index, id)) keep.add(parent);
  }
  return keep;
}
