/**
 * Reading a symbol's series out of the graph-data map for the screener charts, chronologically
 * sorted. portfolio/holdingsPricing keeps the unsorted lookup and the latest-close helper the
 * holdings tables use; this one is typed to the full GraphDataPoint the chart draws.
 */
import type {GraphDataPoint, StockGraphData} from '../types/graphData.ts';

/**
 * One symbol's price series, chronologically ascending, tolerant of case differences in the
 * key. Empty array when absent - callers render an honest empty state rather than any
 * fabricated fallback.
 */
export const getSeriesFromGraphData = (
  graphData: StockGraphData | undefined,
  stockSymbol: string,
): GraphDataPoint[] => {
  if (!graphData) return [];
  for (const key of [
    stockSymbol,
    stockSymbol.toUpperCase(),
    stockSymbol.toLowerCase(),
  ]) {
    const series = graphData[key];
    if (series && series.length > 0) {
      return [...series].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      );
    }
  }
  return [];
};
