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
  const fromSource = !!chat.sharedStrategies?.some(s =>
    strategyIds.includes(s.strategy_id),
  );
  return fromSource
    ? {...chat, isReadOnly: true, fromSource}
    : {isReadOnly: false, fromSource};
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
