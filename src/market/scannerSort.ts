// The sort web's shared ScannerTable (components/shared/scanner/ScannerTable.tsx, dev 0b090599)
// puts both options scanners' rows in: a column sorts by its text or by a figure, a fresh column
// starts high-first on a figure and A–Z on text, ties fall back to the row's key A–Z whichever way
// the sort runs, and a missing figure sorts below every number, as web's −∞ does.

export type ScannerSortSpec<T> =
  | {readonly text: (row: T) => string}
  | {readonly num: (row: T) => number | null | undefined};

/** A figure starts high-first, text A–Z, as a fresh column does on web. */
export const scannerSortStartsDescending = <T>(
  spec: ScannerSortSpec<T>,
): boolean => 'num' in spec;

// The tie-break compares code points where web calls localeCompare: the keys are upper-case
// tickers, which order the same either way, and a collator per comparison is slow on Hermes.
const byKey =
  <T>(keyOf: (row: T) => string) =>
  (a: T, b: T): number => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };

/** The rows in `spec` order, a new array. */
export function sortScannerRows<T>(
  rows: readonly T[],
  spec: ScannerSortSpec<T>,
  isDescending: boolean,
  keyOf: (row: T) => string,
): T[] {
  const dir = isDescending ? -1 : 1;
  const tie = byKey(keyOf);
  if ('text' in spec) {
    return [...rows].sort((a, b) => {
      const va = spec.text(a);
      const vb = spec.text(b);
      return va < vb ? -dir : va > vb ? dir : tie(a, b);
    });
  }
  const valueOf = (row: T): number => spec.num(row) ?? Number.NEGATIVE_INFINITY;
  return [...rows].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    return va < vb ? -dir : va > vb ? dir : tie(a, b);
  });
}
