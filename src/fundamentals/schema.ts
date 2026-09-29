// How a filing is turned into something readable.
//
// The endpoint sends every line the company filed, keyed by Accord's own
// spelling. These specs decide three things about each one: what to call it,
// which group it sits in, and how deep a reader has to go to see it.
//
// Tier is the whole progressive-disclosure mechanism:
//   1  the shape of the business — always on screen
//   2  the working detail — one "Show more" away
//   3  the filing as filed — behind "Full statement"
//
// A key with no spec is NOT dropped. It renders at tier 3 with its vendor name
// prettified, so a line added by the vendor next quarter shows up without a
// code change, and nothing a company filed is ever invisible.
//
// Labels are English data, as every other core catalogue is: the apps render
// them as filed-line names, not through their string tables.

export type Tier = 1 | 2 | 3;

export type ValueKind =
  | 'currency' // ₹ crore
  | 'pct' // already a percentage
  | 'ratio' // bare multiple, e.g. current ratio
  | 'x' // times, e.g. EV/EBITDA
  | 'rupees' // per-share rupees
  | 'days'
  | 'count'
  | 'shares';

export interface LineSpec {
  key: string;
  label: string;
  tier: Tier;
  kind?: ValueKind;
  // Renders as a totals row: heavier weight and a rule above it.
  total?: boolean;
  // A cost line. Shown as a magnitude with expense styling rather than as a
  // negative, because the vendor files most of them positive.
  expense?: boolean;
  // One line of plain English, surfaced on hover/tap. Only where the name
  // genuinely does not explain itself.
  hint?: string;
}

export interface GroupSpec {
  id: string;
  title: string;
  tier: Tier;
  lines: LineSpec[];
}

// Per-share figures come in two vendor flavours and only one can be read down a
// column. The as-filed lines (`Reported_EPS`, `EPS`) are measured against the
// share count of their own period, so a split or bonus makes them discontinuous
// mid-window — Reliance's 1:1 bonus halves them between FY24 and FY25 while
// profit rises, which reads as a crash that never happened. The adjusted lines
// (`Adj_Eps`, `Adjusted_EPS`, `Adj_eps_abs`) are the same earnings restated onto
// the current share count and are the ones shown; the as-filed lines stay
// available at tier 3 so the filing is still reachable in full.
export const ADJ_EPS_HINT =
  "Earnings per share restated onto today's share count, so splits and bonus issues don't break the trend.";
export const REPORTED_EPS_HINT =
  'Per share as filed at the time, against the share count of that year.';

// Which statement schema a company gets. Sixteen fformat values collapse to
// three real layouts: a bank's statement shares nothing with a manufacturer's,
// a lender's shares most of it but leads with interest income, and everyone
// else differs only by which revenue lines they happen to file.
export type FormatFamily = 'bank' | 'lender' | 'general';

const BANK_FORMATS = new Set(['BNK']);
const LENDER_FORMATS = new Set(['FIN', 'INS']);

export function formatFamily(fformat?: string): FormatFamily {
  const f = (fformat ?? '').toUpperCase();
  if (BANK_FORMATS.has(f)) return 'bank';
  if (LENDER_FORMATS.has(f)) return 'lender';
  return 'general';
}

// Turns an unlabelled vendor key into something a human can read:
// "Sellg_Admn_Exps" → "Sellg Admn Exps", "priting_stationery" → "Priting
// stationery". Deliberately conservative — it does not try to expand the
// vendor's abbreviations, because guessing wrong on a financial line is worse
// than showing it verbatim.
export function prettifyKey(key: string): string {
  const spaced = key
    .replace(/[_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Whether a line is worth a row.
//
// Absent is nil, but the quarterly feed does not use nil - it zero-fills every
// field the company did not report, so Operating_Profit and Exception_Items
// arrive as 0.00 on filings that never carried them. A line that is zero in
// every period is therefore "not reported" far more often than it is a fact,
// and rendering it puts a row of 0.00 under a tier-1 heading. A line that is
// zero in SOME periods still shows, because there the zero is informative.
function hasSignal(
  values: (number | null)[] | undefined,
): values is (number | null)[] {
  if (!values) return false;
  return values.some(v => v != null && v !== 0);
}

export interface ResolvedLine extends LineSpec {
  values: (number | null)[];
  known: boolean;
}

export interface ResolvedGroup {
  id: string;
  title: string;
  tier: Tier;
  lines: ResolvedLine[];
}

// Matches the filing against the schema.
//
// Every key present in `items` comes back exactly once. Specced keys keep
// their group, label and tier; the rest are collected into a trailing
// "As reported" group at tier 3 — that group is what guarantees the reader can
// always reach the complete filing, whatever the schema knows about.
export function resolveGroups(
  groups: readonly GroupSpec[],
  items: Record<string, (number | null)[]> | undefined,
  extraTitle = 'As reported',
): ResolvedGroup[] {
  if (!items) return [];
  const claimed = new Set<string>();
  const out: ResolvedGroup[] = [];

  for (const group of groups) {
    const lines: ResolvedLine[] = [];
    for (const spec of group.lines) {
      const values = items[spec.key];
      if (!hasSignal(values)) continue;
      claimed.add(spec.key);
      lines.push({...spec, values, known: true});
    }
    if (lines.length > 0) out.push({...group, lines});
  }

  const leftovers = Object.entries(items)
    .filter(([key]) => !claimed.has(key))
    .filter(([, values]) => hasSignal(values))
    .sort(([a], [b]) => a.localeCompare(b));

  if (leftovers.length > 0) {
    out.push({
      id: 'as-reported',
      title: extraTitle,
      tier: 3,
      lines: leftovers.map(([key, values]) => ({
        key,
        label: prettifyKey(key),
        tier: 3,
        kind: 'currency',
        values,
        known: false,
      })),
    });
  }
  return out;
}

// Whether a line shows at a given depth. The line's own tier is the whole rule,
// and the group's tier is not a gate on top of it: the schemas nest headline
// lines inside groups that are themselves detail — a bank files "Total income"
// under other income, a lender its finance cost under costs, a balance sheet
// loans and advances under contingent items. Dropping the group first took
// those tier-1 lines with it, so they appeared at no depth and were missing
// from the "N more" count too. The group tier now only orders and titles.
const lineShows = (line: ResolvedLine, tier: Tier): boolean =>
  line.tier <= tier;

// Groups visible at a given depth, each filtered to the lines that qualify. A
// group carried only by a nested shallower line brings just that line; one with
// nothing left to show drops out entirely.
export function atTier(
  groups: readonly ResolvedGroup[],
  tier: Tier,
): ResolvedGroup[] {
  return groups
    .map(g => ({...g, lines: g.lines.filter(l => lineShows(l, tier))}))
    .filter(g => g.lines.length > 0);
}

// How many lines are still folded away — the number that makes a "Show more"
// honest about what it costs to press. Counted through the same predicate
// `atTier` renders by, so the count and the table cannot disagree about which
// lines a deeper tier brings.
export function hiddenCount(
  groups: readonly ResolvedGroup[],
  tier: Tier,
): number {
  let n = 0;
  for (const g of groups) {
    for (const l of g.lines) if (!lineShows(l, tier)) n += 1;
  }
  return n;
}
