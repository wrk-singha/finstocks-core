/** The timeframes a live strategy can run on, as the rules editor offers them. */
export const STRATEGY_TIMEFRAMES = ['1m', '5m', '15m', '1D'] as const;

export type StrategyTimeframe = (typeof STRATEGY_TIMEFRAMES)[number];

/**
 * A backend timeframe ("5m", "1d") as one of the editor's options. The backend is lowercase and the
 * options mix case, so this matches case-insensitively; anything unknown reads as daily.
 */
export function normalizeStrategyTimeframe(
  raw: string | null | undefined,
): StrategyTimeframe {
  const wanted = (raw ?? '').toLowerCase();
  return (
    STRATEGY_TIMEFRAMES.find(value => value.toLowerCase() === wanted) ?? '1D'
  );
}
