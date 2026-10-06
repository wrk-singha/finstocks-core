import type {
  LogFeedLogEntry,
  StrategyLog,
  StrategyLogRow,
} from '../types/strategyLogs.ts';
import type {Strategy} from '../types/trade.ts';

export interface StrategySnapshot {
  isReadOnly: boolean;
  sharedStrategies?: Strategy[] | undefined;
  sharedLogs?: StrategyLog[] | undefined;
}

/**
 * The backend canonicalises strategy ids (lower-case UUIDs) before it looks them up, so an id a
 * message carries in capitals names the same strategy.
 */
const idKey = (id: string): string => id.toLowerCase();

/**
 * Which data a strategy card reads from. A forked chat holds the sharer's strategies as a
 * read-only snapshot, so a card whose ids are in it renders that snapshot; every other card keeps
 * its live queries. A read-only chat (a share link) passes its snapshot to every card, as it
 * always has.
 */
export const strategyCardSource = (
  strategyIds: readonly string[],
  chat: StrategySnapshot,
): StrategySnapshot & {fromSource: boolean} => {
  if (chat.isReadOnly) return {...chat, fromSource: false};
  const keys = new Set(strategyIds.map(idKey));
  const fromSource = !!chat.sharedStrategies?.some(s =>
    keys.has(idKey(s.strategy_id)),
  );
  return fromSource
    ? {...chat, isReadOnly: true, fromSource}
    : {isReadOnly: false, fromSource};
};

/**
 * A card's ids split by whose they are, for a card that names the sharer's strategies beside the
 * viewer's own: `shared` holds the snapshot's rows among them, in the card's order and once each,
 * and `liveIds` the rest, once each, which the card reads live as any other.
 */
export const splitSharedIds = (
  strategyIds: readonly string[],
  sharedStrategies: readonly Strategy[] | undefined,
): {shared: Strategy[]; liveIds: string[]} => {
  const byKey = new Map(
    (sharedStrategies ?? []).map(row => [idKey(row.strategy_id), row]),
  );
  const seen = new Set<string>();
  const shared: Strategy[] = [];
  const liveIds: string[] = [];
  for (const id of strategyIds) {
    const key = idKey(id);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = byKey.get(key);
    if (row === undefined) liveIds.push(id);
    else shared.push(row);
  }
  return {shared, liveIds};
};

const timeOf = (row: StrategyLogRow): number => {
  const time = Date.parse(row.created_at);
  return Number.isNaN(time) ? 0 : time;
};

/**
 * A forked chat's `source_strategy_logs` as the items get-logs answers with: each raw row wrapped
 * as a `log` item, newest first as get-logs sorts them, with a left-out payload read as none. So a
 * card reading the snapshot finds the same result row the live feed would have given it first.
 */
export const sourceLogTimeline = (
  rows: readonly StrategyLogRow[],
): LogFeedLogEntry[] =>
  [...rows]
    .sort((a, b) => timeOf(b) - timeOf(a))
    .map(row => ({
      entry_type: 'log',
      created_at: row.created_at,
      log: {
        log_id: row.log_id,
        strategy_id: row.strategy_id,
        log_level: row.log_level,
        ...(row.message === undefined ? {} : {message: row.message}),
        payload: row.payload ?? null,
        symbol: row.symbol,
      },
    }));
