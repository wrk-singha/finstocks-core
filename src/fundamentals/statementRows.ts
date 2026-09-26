import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';
import type {ValueKind} from './schema.ts';

/**
 * The building blocks every Screener-style statement table is made of: the
 * quarterly results, the profit & loss, the balance sheet, the cash flows and
 * the ratios all derive their lines from the filing with these, so a "+" or a
 * balancing line behaves the same in every one of them.
 *
 * Values run oldest first, one per column, the way the table reads left to
 * right.
 */

export interface StatementRow {
  id: string;
  label: string;
  kind: ValueKind;
  values: (number | null)[];
  strong?: boolean;
  hint?: string;
  children?: StatementRow[];
}

/** A derived statement: its columns and its lines. */
export interface AnnualTable {
  periods: number[];
  rows: StatementRow[];
}

export type Col = (number | null)[];

export const has = (c: Col): boolean => c.some(v => v != null && v !== 0);

/** Applies `f` column by column; a column missing any input stays empty. */
export const zip = (cols: Col[], f: (...v: number[]) => number | null): Col =>
  (cols[0] ?? []).map((_, i) => {
    const vals: number[] = [];
    for (const c of cols) {
      const v = c[i];
      if (v == null) return null;
      vals.push(v);
    }
    const out = f(...vals);
    return out != null && Number.isFinite(out) ? out : null;
  });

// A negative base is a real figure, not a missing one: tax on a pre-tax loss is
// a percentage worth showing, and blanking it reads as "not filed". Only a zero
// base has no percentage to give.
export const pctOf = (part: Col, whole: Col): Col =>
  zip([part, whole], (p, w) => (w !== 0 ? (p / w) * 100 : null));

/** `part` as days of `whole` over a 365-day year: debtor days, payable days. */
export const daysOf = (part: Col, whole: Col): Col =>
  zip([part, whole], (p, w) => (w > 0 ? (p / w) * 365 : null));

export const or = (a: Col, b: Col): Col => a.map((v, i) => v ?? b[i] ?? null);
export const orZero = (c: Col): Col => c.map(v => v ?? 0);

/**
 * Screener's balancing line: a total less every named part of it. Anything
 * under half a crore is float residue from the subtraction, not a filed
 * amount, and is snapped to zero so it cannot surface as a line of zeros.
 */
export const rest = (total: Col, parts: Col[]): Col =>
  zip([total, ...parts.map(orZero)], (t, ...p) => {
    const left = p.reduce((acc, v) => acc - v, t);
    return Math.abs(left) < 0.5 ? 0 : left;
  });

export const yoy = (c: Col): Col =>
  c.map((v, i) => {
    const prev = i > 0 ? (c[i - 1] ?? null) : null;
    return v != null && prev != null && prev > 0
      ? ((v - prev) / prev) * 100
      : null;
  });

export const row = (
  id: string,
  label: string,
  values: Col,
  extra: Partial<StatementRow> = {},
): StatementRow => ({
  id,
  label,
  kind: 'currency',
  values,
  ...extra,
});

// Children with nothing filed are dropped, so a "+" is only offered where the
// breakdown exists.
export const withChildren = (
  parent: StatementRow,
  children: StatementRow[],
): StatementRow => {
  const shown = children.filter(c => has(c.values));
  return shown.length ? {...parent, children: shown} : parent;
};

/** Drops the lines a company filed nothing against. */
export const filed = (rows: StatementRow[]): StatementRow[] =>
  rows.filter(r => has(r.values));

/**
 * Assembles an annual table: lines filed nowhere are dropped, and so are years
 * no line has a figure for — a stray row the vendor holds for an old year
 * would otherwise print a column of dashes.
 */
export const annualTable = (
  periods: number[],
  rows: StatementRow[],
): AnnualTable => {
  const shown = filed(rows);
  const keep = periods.map((_, i) => shown.some(r => r.values[i] != null));
  const pick = <T>(xs: T[]): T[] => xs.filter((_, i) => keep[i]);
  const trim = (r: StatementRow): StatementRow =>
    r.children
      ? {...r, values: pick(r.values), children: r.children.map(trim)}
      : {...r, values: pick(r.values)};
  return {periods: pick(periods), rows: shown.map(trim)};
};

/** A series' periods oldest first; the endpoint sends them newest first. */
export const oldestFirst = (series: FundamentalsSeries): number[] =>
  [...series.periods].reverse();

/**
 * Reads one series onto the given columns, null where that year was not filed.
 * Lets a table built on the balance sheet's years read the profit & loss
 * without assuming the two were filed for the same span.
 */
export const reader =
  (series: FundamentalsSeries | undefined, periods: number[]) =>
  (key: string): Col =>
    periods.map(p => {
      if (!series) return null;
      const i = series.periods.indexOf(p);
      return i < 0 ? null : (series.items[key]?.[i] ?? null);
    });
