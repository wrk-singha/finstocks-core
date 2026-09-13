/**
 * Reading strategy_logs rows: IST timestamps for the log tables and the BUY/SELL action a
 * dynamic log level encodes. The backtest-payload helpers live in strategyStatus. Web-only
 * today.
 */
import {istDateTimeParts} from '../format/index.ts';

export interface LogDateTime {
  full: string;
  date: string;
  time: string;
}

/**
 * IST date/time for a strategy-log row, as parts or as one of them. `formatLogDateTime` rather
 * than the web's `formatDateTime`, which core's format module already uses for the plain
 * locale stamp.
 */
export function formatLogDateTime(
  timestamp: string | null | undefined,
): LogDateTime;
export function formatLogDateTime(
  timestamp: string | null | undefined,
  format: 'full' | 'date' | 'time',
): string;
export function formatLogDateTime(
  timestamp: string | null | undefined,
  format?: 'full' | 'date' | 'time',
): string | LogDateTime {
  const parts = istDateTimeParts(timestamp);
  if (!parts) {
    const fallback = '—';
    if (format) return fallback;
    return {full: fallback, date: fallback, time: fallback};
  }

  const {date: dateStr, time: timeStr} = parts;
  if (format === 'date') return dateStr;
  if (format === 'time') return timeStr;
  if (format === 'full') return `${dateStr} ${timeStr}`;
  return {full: `${dateStr} ${timeStr}`, date: dateStr, time: timeStr};
}

export type TradeLogAction = 'BUY' | 'SELL';

const TRADE_LOG_LEVEL_PATTERNS: Record<TradeLogAction, RegExp> = {
  BUY: /^BUY(?:$|[\s:_-])/,
  SELL: /^SELL(?:$|[\s:_-])/,
};

/** The side a dynamic log level encodes ("BUY 99 ADANIPOWER", "SELL:..."), or null. */
export const getTradeLogAction = (
  logLevel: string | null | undefined,
): TradeLogAction | null => {
  const normalizedLevel = (logLevel ?? '').trim().toUpperCase();
  if (!normalizedLevel) return null;
  if (normalizedLevel === 'EXECUTION_FILLED') return 'BUY';

  if (TRADE_LOG_LEVEL_PATTERNS.BUY.test(normalizedLevel)) return 'BUY';
  if (TRADE_LOG_LEVEL_PATTERNS.SELL.test(normalizedLevel)) return 'SELL';
  return null;
};
