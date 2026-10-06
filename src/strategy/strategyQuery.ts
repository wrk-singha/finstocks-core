import type {Strategy} from '../types/trade.ts';

const orElse = (value: string | undefined, fallback: string): string =>
  value === undefined || value === '' ? fallback : value;

// Carries every rule shown in the confirm dialog into the message — entry text alone can omit the
// universe/timeframe/exit rules the user just confirmed, leaving the LLM to guess them from
// surrounding chat context.
const describeStrategy = (
  strategy: Strategy,
  capital?: number,
  symbolOverride?: string,
  timeframeOverride?: string,
): string[] => {
  const parts: string[] = [];
  // An empty override is no override, as for an absent one.
  const symbol = orElse(symbolOverride, strategy.symbol);
  if (symbol && symbol !== 'CUSTOM_LIST') {
    parts.push(`on ${symbol}`);
  }
  if (strategy.is_intraday) {
    parts.push('intraday, squared off same day');
  } else {
    const timeframe = orElse(timeframeOverride, strategy.timeframe);
    if (timeframe) parts.push(`on the ${timeframe} timeframe`);
  }
  if (strategy.take_profit != null)
    parts.push(`take profit +${strategy.take_profit}%`);
  if (strategy.stop_loss != null)
    parts.push(`stop loss -${strategy.stop_loss}%`);
  // A news strategy's exit is prose, not TP/SL. Omitting it here leaves the LLM to regenerate the
  // strategy with no exit at all — the exact failure this function exists to prevent.
  for (const t of strategy.rules?.nlp_triggers ?? [])
    parts.push(`exit when ${t.summary}`);
  if (capital != null) parts.push(`with a capital of ${capital}`);
  return parts;
};

export const buildDeployQuery = (
  strategy: Strategy,
  entryQuery: string,
  capital?: number,
  symbolOverride?: string,
  timeframeOverride?: string,
): string =>
  [
    `Instantly run this exact strategy now: ${entryQuery}`,
    ...describeStrategy(strategy, capital, symbolOverride, timeframeOverride),
  ].join(', ');

/**
 * A strategy the viewer does not own, asked for again as an ordinary message (a forked chat's
 * "Run again"): the backtest comes back as the viewer's own.
 */
export const buildBacktestAgainQuery = (strategy: Strategy): string =>
  [
    `Backtest this exact strategy: ${strategy.original_query}`,
    ...describeStrategy(strategy),
  ].join(', ');
