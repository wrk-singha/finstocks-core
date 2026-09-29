import {extractUnderlyingSymbol} from '../market/symbols.ts';
import type {Strategy} from '../types/trade.ts';
import {isInProgress} from './strategyStatus.ts';

// Indices and baskets must be dropped before extractUnderlyingSymbol, which
// collapses every spelling of them ("NIFTY 50", "NIFTY500", "NIFTY BANK") to
// the single key "NIFTY" and so made an index strategy conflict with a plan on
// an unrelated stock. The digit/space/end anchor keeps tradeable tickers that
// merely start with an index name (NIFTYBEES) in the comparison.
const BASKETS = new Set(['CUSTOM_LIST', 'ALL', 'FNO', 'NSE500']);
const INDEX_NAME =
  /^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|BANKEX)(\s|\d|$)/;

const MAX_LISTED_NAMES = 3;

const isBasketOrIndex = (part: string): boolean =>
  BASKETS.has(part) || INDEX_NAME.test(part.replace(/[._-]+/g, ' '));

/** The tradeable underlyings a symbol list names, upper-cased; indices and baskets are dropped. */
export const underlyingsOf = (raw: string): string[] =>
  raw
    .split(/[,/]/)
    .map(part => part.trim().toUpperCase())
    .filter(part => part && !isBasketOrIndex(part))
    .map(part => extractUnderlyingSymbol(part) || part);

// The API can send is_mock null despite its type; null is the live book, as the console reads it.
const isMockBook = (strategy: {is_mock?: boolean | null}): boolean =>
  !!strategy.is_mock;

const nameOf = (strategy: Strategy): string =>
  (strategy.strategy_hname ?? '').trim() ||
  strategy.symbol ||
  'Untitled strategy';

/**
 * The strategies out of `strategies` whose own symbol shares an underlying with
 * `tickers`. Callers that have already narrowed the set (by mock/live, status
 * or anything else) pass `prefiltered` so the book filter below is skipped —
 * applying it twice would only re-answer a question they already answered.
 */
export function strategiesMatchingSymbols(
  tickers: string | undefined,
  strategies: readonly Strategy[] | undefined,
  isMock: boolean,
  prefiltered = false,
): Strategy[] {
  if (!tickers || !strategies?.length) return [];

  const planned = new Set(underlyingsOf(tickers));
  if (!planned.size) return [];

  return strategies.filter(strategy => {
    if (!prefiltered) {
      // Backtests replay history and hold nothing; mock and live are separate books.
      if (strategy.is_backtest || isMockBook(strategy) !== isMock) return false;
      if (!isInProgress(strategy)) return false;
    }
    const symbol = strategy.symbol || (strategy.stock_symbol ?? '');
    return underlyingsOf(symbol).some(underlying => planned.has(underlying));
  });
}

/** Names of the running strategies (same book) already trading any of the planned tickers. */
export function findConflictingStrategies(
  planTickers: string | undefined,
  strategies: readonly Strategy[] | undefined,
  isMock: boolean,
): string[] {
  return strategiesMatchingSymbols(planTickers, strategies, isMock).map(nameOf);
}

// Generated titles repeat, so a raw join reads as one name listed 20 times.
const labelCounts = (names: string[]): string[] => {
  const counts = new Map<string, number>();
  names.forEach(name => counts.set(name, (counts.get(name) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => (count > 1 ? `${name} (${count})` : name));
};

export function conflictWarning(names: string[]): string {
  const [first] = names;
  if (first === undefined) return '';
  if (names.length === 1) {
    return `"${first}" is already running on this stock. Creating this one means two strategies trading it at once.`;
  }

  const labels = labelCounts(names);
  const listed = labels.slice(0, MAX_LISTED_NAMES).join(', ');
  const remaining = labels.length - MAX_LISTED_NAMES;
  const summary = remaining > 0 ? `${listed} and ${remaining} more` : listed;

  return `${names.length} strategies are already running on these stocks: ${summary}. Creating this one adds another.`;
}
