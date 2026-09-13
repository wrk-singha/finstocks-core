import {formatDateString} from './portfolio.ts';

export type PerfFilter = 'all' | 'winners' | 'losers';
export type HoldingSortField = 'return' | 'price' | 'name';
export type SortDir = 'asc' | 'desc';
export type SortUnit = 'amount' | 'percent';

// TODO(core-types): unify with types/components (DateRange)
export interface DateRange {
  start: Date;
  end: Date;
}

export const flipSortDir = (dir: SortDir): SortDir =>
  dir === 'desc' ? 'asc' : 'desc';

interface DateFilterableTrade {
  buy_time?: string | null;
  sell_time?: string | null;
  sell_price?: number | null;
  status?: string;
  execution_strategy?: string | null;
}

export interface RelevantTradeOptions {
  dateRange?: DateRange | null;
  isMockEnabled: boolean;
  selectedMarket: string;
  disableFiltering?: boolean;
}

// Shared date/mode/market filter for holdings — was copy-pasted across both tables.
export function filterRelevantTrades<T extends DateFilterableTrade>(
  trades: T[],
  {dateRange, isMockEnabled, disableFiltering = false}: RelevantTradeOptions,
): T[] {
  const today = new Date();
  const startStr = formatDateString(dateRange?.start ?? today);
  const endStr = formatDateString(dateRange?.end ?? today);
  const inRange = (dateStr: string): boolean =>
    dateStr >= startStr && dateStr <= endStr;

  const matchesDate = (trade: T): boolean => {
    if (trade.buy_time && inRange(formatDateString(new Date(trade.buy_time))))
      return true;
    if (trade.sell_time && inRange(formatDateString(new Date(trade.sell_time))))
      return true;
    if (trade.sell_price === null || trade.sell_price === undefined) {
      if (
        trade.buy_time &&
        formatDateString(new Date(trade.buy_time)) <= endStr
      )
        return true;
    }
    return false;
  };

  return trades.filter(trade => {
    if (disableFiltering) return matchesDate(trade);

    const modeMatches = isMockEnabled
      ? trade.status === 'SIMULATION'
      : trade.status === 'LIVE';
    if (!modeMatches) return false;

    return matchesDate(trade);
  });
}

export interface FilterableHolding {
  pnl: number | null;
  strategyId: string | null;
  strategyDisplay: string;
  strategyNumber?: number | null;
  strategyDescription?: string;
}

export interface SortableHolding {
  currentPrice: number;
  symbol: string;
  returnPercent: number;
  todayPercent: number;
  pnl: number | null;
  hasSoldTrades: boolean;
  hasLivePrice: boolean;
}

export interface StrategyFilterOption {
  value: string;
  label: string;
  description?: string;
  count: number;
}

export function applyPerfFilter<
  T extends {pnl: number | null; hasSoldTrades: boolean; hasLivePrice: boolean},
>(rows: T[], perf: PerfFilter): T[] {
  // Closed positions have a realized return; open positions with a live price
  // show an unrealized one. Rows with neither show N/A and only appear under "all".
  const hasReturn = (row: T): boolean => row.hasSoldTrades || row.hasLivePrice;
  if (perf === 'winners')
    return rows.filter(
      row => hasReturn(row) && row.pnl !== null && row.pnl >= 0,
    );
  if (perf === 'losers')
    return rows.filter(
      row => hasReturn(row) && row.pnl !== null && row.pnl < 0,
    );
  return rows;
}

export function applySearchFilter<T extends {symbol: string}>(
  rows: T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter(row => row.symbol.toLowerCase().includes(query));
}

export function strategyKeyOf(row: FilterableHolding): string {
  return row.strategyId ?? row.strategyDisplay;
}

// An empty description falls through to the number, not to a blank option.
function strategyLabelOf(row: FilterableHolding): string {
  if (row.strategyDescription) return row.strategyDescription;
  return row.strategyNumber != null
    ? `Strategy ${row.strategyNumber}`
    : 'Strategy';
}

export function buildStrategyOptions(
  rows: FilterableHolding[],
): StrategyFilterOption[] {
  const options: StrategyFilterOption[] = [
    {value: 'all', label: 'All strategies', count: rows.length},
  ];

  // One pass for the counts: each option used to re-scan every row, so a book of
  // n holdings across m strategies cost n*m comparisons plus two more sweeps.
  const seen = new Map<string, FilterableHolding>();
  const counts = new Map<string, number>();
  let autopilotCount = 0;
  let manualCount = 0;

  for (const row of rows) {
    const key = strategyKeyOf(row);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    if (row.strategyDisplay === 'AUTOPILOT') autopilotCount++;
    if (row.strategyDisplay === 'MANUAL') manualCount++;
    if (
      row.strategyDisplay === 'STRATEGY' &&
      row.strategyId &&
      !seen.has(row.strategyId)
    ) {
      seen.set(row.strategyId, row);
    }
  }

  const distinctStrategies = [...seen.entries()].sort(
    ([, a], [, b]) => (a.strategyNumber ?? 0) - (b.strategyNumber ?? 0),
  );
  for (const [id, row] of distinctStrategies) {
    options.push({
      value: id,
      label: strategyLabelOf(row),
      count: counts.get(id) ?? 0,
    });
  }

  if (autopilotCount > 0) {
    options.push({
      value: 'AUTOPILOT',
      label: 'Autopilot',
      count: autopilotCount,
    });
  }

  if (manualCount > 0) {
    options.push({value: 'MANUAL', label: 'Manual', count: manualCount});
  }

  return options;
}

export function applyStrategyFilter<T extends FilterableHolding>(
  rows: T[],
  key: string,
): T[] {
  if (key === 'all') return rows;
  return rows.filter(row => strategyKeyOf(row) === key);
}

// The unit toggle picks which lens ranks the money fields:
//   percent → today's % move for "price", % return for "return".
//   amount  → each field's natural ₹: LTP for "price", P&L for "return".
// "name" is alphabetical and ignores the unit. Rows with no return to show
// (no sale, no live price) sort as neutral (0).
function sortMetric(
  row: SortableHolding,
  field: HoldingSortField,
  pct: boolean,
): number {
  if (field === 'price') return pct ? row.todayPercent : row.currentPrice;
  if (!row.hasSoldTrades && !row.hasLivePrice) return 0;
  return pct ? row.returnPercent : (row.pnl ?? 0);
}

export function sortHoldings<T extends SortableHolding>(
  rows: T[],
  field: HoldingSortField,
  dir: SortDir = 'desc',
  unit: SortUnit = 'percent',
): T[] {
  const sorted = [...rows];
  const mult = dir === 'asc' ? 1 : -1;
  if (field === 'name') {
    sorted.sort((a, b) => mult * a.symbol.localeCompare(b.symbol));
    return sorted;
  }
  const pct = unit === 'percent';
  sorted.sort(
    (a, b) => mult * (sortMetric(a, field, pct) - sortMetric(b, field, pct)),
  );
  return sorted;
}

// Positions carry `sym` rather than Holdings' `symbol`, and their pnl is null
// when no honest price backs the row, so they get their own sort rather than
// being forced through the holdings helpers.
export interface SortablePosition {
  sym: string;
  pnl: number | null;
  valueNum: number;
}

// Unpriced rows (pnl === null) always sort last regardless of direction: they
// carry no ranking information, and letting them lead an ascending P&L sort
// would read as "these are the worst performers".
export function sortPositions<T extends SortablePosition>(
  rows: T[],
  field: HoldingSortField,
  dir: SortDir = 'desc',
  unit: SortUnit = 'percent',
): T[] {
  const sorted = [...rows];
  const mult = dir === 'asc' ? 1 : -1;

  if (field === 'name') {
    sorted.sort((a, b) => mult * a.sym.localeCompare(b.sym));
    return sorted;
  }

  sorted.sort((a, b) => {
    if (a.pnl === null && b.pnl === null) return 0;
    if (a.pnl === null) return 1;
    if (b.pnl === null) return -1;
    if (field === 'price') return mult * (a.valueNum - b.valueNum);
    const aMetric = unit === 'percent' ? a.pnl / (a.valueNum || 1) : a.pnl;
    const bMetric = unit === 'percent' ? b.pnl / (b.valueNum || 1) : b.pnl;
    return mult * (aMetric - bMetric);
  });
  return sorted;
}
