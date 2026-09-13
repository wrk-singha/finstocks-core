/**
 * Query-string helpers for the two shapes `query()` cannot express: repeated
 * keys, and a symbol list split into parallel requests.
 */

/**
 * The Go handlers read `r.URL.Query()["symbols"]`, which collects repeated
 * params and never splits on commas — a joined "ACE,ESCORTS" arrives as one
 * symbol and matches no row.
 */
export const repeatedParam = (key: string, values: readonly string[]): string =>
  values.map(v => `${key}=${encodeURIComponent(v)}`).join('&');

export const symbolQuery = (symbols: readonly string[]): string =>
  repeatedParam('symbols', symbols);

/** Joins already-encoded query fragments, skipping empty ones; '' when nothing is left. */
export const joinQuery = (...fragments: readonly string[]): string => {
  const parts = fragments
    .map(f => (f.startsWith('?') ? f.slice(1) : f))
    .filter(f => f.length > 0);
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
};

/**
 * Both symbol endpoints cost far more than linearly past roughly fifty
 * symbols (one 102-symbol call ~580ms vs ~170ms in parallel batches).
 */
export const SYMBOL_BATCH_SIZE = 26;

export const batchSymbols = (symbols: readonly string[]): string[][] => {
  if (symbols.length <= SYMBOL_BATCH_SIZE) return [[...symbols]];
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += SYMBOL_BATCH_SIZE) {
    batches.push(symbols.slice(i, i + SYMBOL_BATCH_SIZE));
  }
  return batches;
};
