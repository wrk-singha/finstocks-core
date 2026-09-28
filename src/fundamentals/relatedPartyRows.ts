import type {
  RelatedPartyColumn,
  RelatedPartyResponse,
} from '../types/relatedParty.ts';
import type {StatementRow} from './statementRows.ts';

/** How many parties the table opens with, the largest first; the rest wait behind "Show more". */
export const RELATED_PARTY_TOP = 15;

// The label column is frozen, so one long trust name would push every figure off a phone screen.
// The full name stays in the row's hint.
const MAX_LABEL = 34;
// The fiscal year ends in March: a half-year ending in any later month is the first half of the
// fiscal year that ends the following March.
const FISCAL_YEAR_END_MONTH = 3;

const shorten = (name: string): string =>
  name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1).trimEnd()}…` : name;

/**
 * Screener's related-party table: the parties the company deals with in the order the server
 * ranks them (the size of every amount across the years), each "+" opening what it bought, sold,
 * paid or gave. `limit` is how many parties to show.
 *
 * Every figure is whole crore, as Screener prints these: two decimals on "13.00" beside "1,470"
 * read as a different unit rather than as more precision.
 */
export function buildRelatedPartyRows(
  data: RelatedPartyResponse,
  limit: number = RELATED_PARTY_TOP,
): StatementRow[] {
  return data.parties.slice(0, limit).map((party, i) => {
    const id = `party-${i}`;
    const children: StatementRow[] = party.txns.map((txn, j) => ({
      id: `${id}-${j}`,
      label: txn.type,
      kind: 'count',
      values: txn.values,
    }));
    return {
      id,
      label: party.relationship
        ? `${shorten(party.name)} · ${party.relationship}`
        : shorten(party.name),
      hint: party.relationship
        ? `${party.name} (${party.relationship})`
        : party.name,
      kind: 'count',
      values: party.values,
      // A party with nothing itemised gets no "+", rather than one that opens on nothing.
      ...(children.length ? {children} : {}),
    };
  });
}

/**
 * Which half of which fiscal year a lone half-year column covers: the half to September is H1 and
 * the half to March is H2 of the fiscal year ending that March. Null for a full year.
 */
export function relatedPartyHalf(
  column: RelatedPartyColumn,
): {half: 1 | 2; fiscalYear: number} | null {
  if (!column.partial) return null;
  const year = Math.floor(column.period_end / 100);
  return column.period_end % 100 > FISCAL_YEAR_END_MONTH
    ? {half: 1, fiscalYear: year + 1}
    : {half: 2, fiscalYear: year};
}
