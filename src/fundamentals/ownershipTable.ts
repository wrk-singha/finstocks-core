import type {
  FundamentalsOwnership,
  OwnershipCategory,
} from '../types/fundamentalsDetail.ts';
import {OWNERSHIP_BY_CODE, OWNERSHIP_TREE} from './ownership.ts';
import {prettifyKey, type Tier} from './schema.ts';

// The full SEBI shareholding pattern, across quarters.
//
// The vendor files ~55 categories under five separate measures, and they are
// genuinely different questions: a percentage, a share count, a number of
// holding entities, and the pledged share of the promoter's own stake. A single
// table cannot carry all five without becoming unreadable, so the measure is
// chosen by the reader and the tree stays constant beneath it.

/** The measures a reader can switch the table between, named as the filing names them. */
export type OwnershipMeasure = 'pct' | 'shares' | 'holders';

export interface OwnershipTableRow {
  code: string;
  label: string;
  tier: Tier;
  depth: 0 | 1 | 2;
  /** Promoter, Public and the grand total: the rows the rest add up to. */
  total: boolean;
  hint?: string;
  /** One value per quarter of the filing, newest first; null where nothing was filed. */
  values: (number | null)[];
}

const valuesOf = (
  category: OwnershipCategory | undefined,
  measure: OwnershipMeasure,
  quarters: number,
): (number | null)[] | null => {
  const filed = category?.[measure];
  if (!filed?.some(v => v != null)) return null;
  // Aligned to the quarters rather than to whatever length the vendor sent, so
  // a short row leaves its missing quarters empty instead of shifting a column.
  return Array.from({length: quarters}, (_, i) => filed[i] ?? null);
};

/**
 * Every row the filing carries for `measure`, in the tree's order. A category
 * with nothing filed for the measure is left out rather than drawn as a row of
 * dashes, and anything the tree does not name still reaches the reader, at the
 * deepest tier under its filed code, as the statements do.
 */
export function ownershipTableRows(
  ownership: FundamentalsOwnership,
  measure: OwnershipMeasure,
): OwnershipTableRow[] {
  const quarters = ownership.quarters.length;
  const byCode = new Map(ownership.categories.map(c => [c.code, c]));
  const rows: OwnershipTableRow[] = [];
  for (const node of OWNERSHIP_TREE) {
    const values = valuesOf(byCode.get(node.code), measure, quarters);
    if (values === null) continue;
    rows.push({
      code: node.code,
      label: node.label,
      tier: node.tier,
      depth: node.depth,
      total: node.total ?? false,
      ...(node.hint === undefined ? {} : {hint: node.hint}),
      values,
    });
  }
  for (const category of ownership.categories) {
    if (OWNERSHIP_BY_CODE.has(category.code)) continue;
    const values = valuesOf(category, measure, quarters);
    if (values === null) continue;
    rows.push({
      code: category.code,
      label: prettifyKey(category.code),
      tier: 3,
      depth: 2,
      total: false,
      values,
    });
  }
  return rows;
}

/**
 * The rows a table opened to `tier` shows, and how many it still folds away —
 * counted by the same test the rows are shown by, so a "N more" can never
 * disagree with what pressing it reveals.
 */
export function ownershipRowsAtTier(
  rows: readonly OwnershipTableRow[],
  tier: Tier,
): {shown: OwnershipTableRow[]; hidden: number} {
  const shown = rows.filter(row => row.tier <= tier);
  return {shown, hidden: rows.length - shown.length};
}
