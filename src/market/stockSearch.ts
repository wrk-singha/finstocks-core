import type {Stock} from '../data/stocksData.ts';

const normalizeForSearch = (value: string): string =>
  value.toLowerCase().replace(/[-&.]/g, ' ').replace(/\s+/g, ' ').trim();

// 3 = prefix match, 2 = substring, 1 = within `maxErrors` edits (Sellers'
// approximate substring matching), 0 = no match.
const fuzzyContains = (
  text: string,
  pattern: string,
  maxErrors: number,
): number => {
  if (text.includes(pattern)) {
    return text.startsWith(pattern) ? 3 : 2;
  }
  if (maxErrors === 0 || pattern.length < 3) return 0;
  const m = pattern.length;
  const n = text.length;
  if (m > n + maxErrors) return 0;
  let prev = new Uint8Array(m + 1);
  let curr = new Uint8Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  let best = Infinity;
  for (let i = 1; i <= n; i++) {
    curr[0] = 0;
    for (let j = 1; j <= m; j++) {
      curr[j] =
        text[i - 1] === pattern[j - 1]
          ? (prev[j - 1] ?? 0)
          : 1 + Math.min(prev[j - 1] ?? 0, prev[j] ?? 0, curr[j - 1] ?? 0);
    }
    const tail = curr[m] ?? Infinity;
    if (tail <= maxErrors) best = Math.min(best, tail);
    [prev, curr] = [curr, prev];
  }
  return best <= maxErrors ? 1 : 0;
};

// Above a symbol prefix (13), the best any partial match can score.
const EXACT_SYMBOL_SCORE = 14;

export const stockSearchScore = (stock: Stock, query: string): number => {
  const q = normalizeForSearch(query);
  if (!q) return 1;
  const symbol = normalizeForSearch(stock.symbol);
  // The symbol typed out in full is the instrument asked for, ahead of every
  // symbol that merely starts with it: "bse" is BSE Ltd before BSE100, and
  // without this the tie fell to list order, which puts the indices first.
  if (symbol === q) return EXACT_SYMBOL_SCORE;
  const maxTypos = q.length <= 3 ? 0 : q.length <= 5 ? 1 : 2;
  const symScore = fuzzyContains(symbol, q, maxTypos);
  const nameScore = fuzzyContains(normalizeForSearch(stock.name), q, maxTypos);
  if (symScore >= 2) return 10 + symScore;
  if (nameScore >= 2) return 5 + nameScore;
  return Math.max(symScore, nameScore);
};

export const matchesStockQuery = (stock: Stock, query: string): boolean =>
  stockSearchScore(stock, query) > 0;

// Sort is stable, so equal scores keep the curated order of the source list.
export function rankStocksByQuery<T extends Stock>(
  stocks: readonly T[],
  query: string,
): T[] {
  if (!query) return [...stocks];
  return stocks
    .map(stock => ({stock, score: stockSearchScore(stock, query)}))
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({stock}) => stock);
}
