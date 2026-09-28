import type {DeliverableRow} from '../types/fundamentalsDetail.ts';

// What share of traded volume was actually delivered.
//
// The exchange reports, per day, how much of the volume settled into someone's
// demat account rather than being squared off the same session. It answers a
// question neither price nor volume does: whether a move was accumulation or
// churn. A 40% day on heavy volume is people buying stock; a 12% day on the
// same volume is people trading it.

/** How many sessions the trend reads back. */
export const DELIVERY_SESSIONS = 60;

export interface DeliverySession {
  date: string;
  /** Delivered share of the session's traded volume, in percent. */
  pct: number;
}

export interface DeliveryTrend {
  /** Oldest first: a trend reads left to right in time. */
  sessions: DeliverySession[];
  /** The last session's delivered share, in percent. */
  latest: number;
  /** The mean across the sessions read, in percent. */
  average: number;
  /** The highest session, which the trend is drawn against. */
  peak: number;
}

/**
 * The last sixty sessions with a delivered share on file, or null with fewer
 * than two: one day is a figure, not a trend. The feed runs newest first.
 */
export function deliveryTrend(
  rows: readonly DeliverableRow[],
): DeliveryTrend | null {
  const sessions = rows
    .flatMap(row =>
      row.delv_pct == null ? [] : [{date: row.date, pct: row.delv_pct}],
    )
    .slice(0, DELIVERY_SESSIONS)
    .reverse();
  const latest = sessions.at(-1);
  if (latest === undefined || sessions.length < 2) return null;
  const values = sessions.map(session => session.pct);
  return {
    sessions,
    latest: latest.pct,
    average: values.reduce((sum, pct) => sum + pct, 0) / values.length,
    peak: Math.max(...values),
  };
}
