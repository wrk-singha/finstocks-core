import type {RecommendationHorizon} from '../types/market.ts';

export interface RecommendationHorizonOption {
  key: RecommendationHorizon;
  label: string;
  sub: string;
  /** Shipped inert: visible on the roadmap, not tappable into an empty horizon. */
  soon?: boolean;
  /**
   * When the next batch lands, IST. Horizon-specific because the deadline is:
   * intraday picks are useless after the 9:15 open, so they have to be out
   * before it. Swing and long term carry no such constraint, so they take
   * whatever the API reports rather than a time invented here.
   */
  batchAt?: string;
}

/**
 * Shared by the market page's preview section and the all-recommendations page,
 * which also reads the horizon back off the URL. A horizon with no picker behind
 * it ships `soon` rather than hidden, so the roadmap stays visible without
 * letting anyone tap into an empty tab; drop the flag once its pipeline produces.
 */
export const HORIZONS: RecommendationHorizonOption[] = [
  {key: 'intraday', label: 'Intraday', sub: 'Same day', batchAt: '09:10'},
  {key: 'swing', label: 'Swing', sub: 'Days to weeks'},
  {key: 'longterm', label: 'Long term', sub: 'Months+'},
];

/**
 * Only a horizon a user can actually land on is valid URL state - a `soon` key
 * in the query string would otherwise select a tab that renders nothing.
 */
export const isHorizon = (
  value: string | null,
): value is RecommendationHorizon =>
  HORIZONS.some(h => h.key === value && !h.soon);
