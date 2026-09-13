// Live-price helpers for the holdings table: day change and latest close from
// a symbol's price series.

// TODO(core-types): unify with types/graphData (GraphDataPoint, StockGraphData)
export interface PricePoint {
  time: string;
  close: number;
}

// TODO(core-types): unify with types/graphData (StockGraphData)
export type PriceSeriesBySymbol = Record<string, PricePoint[]>;

export interface DayChange {
  oneDayChange: number;
  oneDayChangePercent: number;
  hasDayChange: boolean;
}

// Day change from a symbol's price series (newest first). Intraday series
// compare newest vs the session's oldest point; the off-hours daily fallback
// compares the two most recent closes. hasDayChange is false when there aren't
// enough points to be real.
export const computeDayChange = (
  series: readonly {close: number}[],
  intradayEmpty: boolean,
): DayChange => {
  const newest = series[0];
  const base = intradayEmpty ? series[1] : series[series.length - 1];
  if (series.length <= 1 || !newest || !base) {
    return {oneDayChange: 0, oneDayChangePercent: 0, hasDayChange: false};
  }
  const oneDayChange = newest.close - base.close;
  const oneDayChangePercent =
    base.close > 0 ? (oneDayChange / base.close) * 100 : 0;
  return {oneDayChange, oneDayChangePercent, hasDayChange: true};
};

// Raw (newest-first, as served) series for a symbol, case-tolerant, for computeDayChange.
export const getRawSeriesFromGraphData = (
  graphData: PriceSeriesBySymbol | undefined,
  stockSymbol: string,
): PricePoint[] => {
  if (!graphData) return [];
  for (const key of [
    stockSymbol,
    stockSymbol.toUpperCase(),
    stockSymbol.toLowerCase(),
  ]) {
    const series = graphData[key];
    if (series && series.length > 0) return series;
  }
  return [];
};

// Latest close for a symbol from the graph-data map, as the two-decimal string
// the holdings tables render. Null when no series backs the symbol — an
// unpriced position must stay distinguishable from a flat one.
export const getCurrentPriceFromGraphData = (
  graphData: PriceSeriesBySymbol | undefined,
  stockSymbol: string,
): string | null => {
  let latest: PricePoint | undefined;
  let latestTime = -Infinity;
  for (const point of getRawSeriesFromGraphData(graphData, stockSymbol)) {
    const t = new Date(point.time).getTime();
    if (!Number.isNaN(t) && t > latestTime) {
      latestTime = t;
      latest = point;
    }
  }
  return latest ? parseFloat(String(latest.close)).toFixed(2) : null;
};

/**
 * A watchlist row's quote from its price series. Series arrive newest-first, and `computeDayChange`
 * reads them that way: the newest close against the day's first bar while the market is trading,
 * against the previous daily close when the intraday feed is empty.
 */
export const quoteFromSeries = (
  series: readonly PricePoint[] | undefined,
  intradayEmpty: boolean,
): {price: number | null; changePct: number | null} => {
  const first = series?.[0];
  if (!series || first === undefined) return {price: null, changePct: null};
  const {oneDayChangePercent, hasDayChange} = computeDayChange(
    series,
    intradayEmpty,
  );
  return {
    price: first.close,
    changePct: hasDayChange ? oneDayChangePercent : null,
  };
};
