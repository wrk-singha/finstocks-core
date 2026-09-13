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

const underlyingsOf = (raw: string): string[] =>
  raw
    .split(/[,/]/)
    .map(part => part.trim().toUpperCase())
    .filter(part => part && !isBasketOrIndex(part))
    .map(part => extractUnderlyingSymbol(part) || part);

const nameOf = (strategy: Strategy): string =>
  (strategy.strategy_hname ?? '').trim() ||
  strategy.symbol ||
  'Untitled strategy';

/** Names of the running strategies (same book) already trading any of the planned tickers. */
export function findConflictingStrategies(
  planTickers: string | undefined,
  strategies: Strategy[] | undefined,
  isMock: boolean,
): string[] {
  if (!planTickers || !strategies?.length) return [];

  const planned = new Set(underlyingsOf(planTickers));
  if (!planned.size) return [];

  return strategies
    .filter(strategy => {
      // Backtests replay history and hold nothing; mock and live are separate books.
      if (strategy.is_backtest || strategy.is_mock !== isMock) return false;
      if (!isInProgress(strategy)) return false;
      const symbol = strategy.symbol || (strategy.stock_symbol ?? '');
      return underlyingsOf(symbol).some(underlying => planned.has(underlying));
    })
    .map(nameOf);
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
