import type {
  ScreenerStrategiesResponse,
  ScreenerStrategyDetailResponse,
} from '../types/screener.ts';
import type {
  StrategyLibraryActivityResponse,
  StrategyLibraryDetailResponse,
  StrategyLibraryResponse,
} from '../types/strategyLibrary.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

export interface ScreenerStrategiesQuery {
  page: number;
  limit: number;
  isIntraday?: boolean;
  isPremium?: boolean;
  isFno?: boolean;
  /**
   * Narrows the page to strategies that already carry a live (non-backtest)
   * pick. Opt-in: the server ignores anything but an explicit true.
   */
  hasTodaysPick?: boolean;
}

export const templatesApi = (http: HttpClient) => ({
  // drift resolved 2026-09-13: the mobile sent has_todays_pick=false explicitly, the web
  // only ever sent true; the web copy won because the server ignores anything but an
  // explicit true, so false was a byte-for-byte no-op.
  getScreenerStrategies: (params: ScreenerStrategiesQuery) =>
    http.request<ScreenerStrategiesResponse>(
      `/templates/screener-strategies${query({
        page: params.page,
        limit: params.limit,
        is_intraday: params.isIntraday,
        is_premium: params.isPremium,
        is_fno: params.isFno,
        has_todays_pick: params.hasTodaysPick === true ? true : undefined,
      })}`,
    ),

  /** Pagination is intentionally omitted — the detail returns every result. */
  getScreenerStrategyDetail: (id: number, timeframe: string, year: number) =>
    http.request<ScreenerStrategyDetailResponse>(
      `/templates/screener-strategies/${id}${query({timeframe, year})}`,
    ),

  /** The black-box strategy library, whole, in one response. */
  getStrategyLibrary: () =>
    http.request<StrategyLibraryResponse>('/templates/strategy-library'),

  /**
   * One library strategy, by its slug or its id, with its published backtest (null without one).
   * 404 for an unknown key.
   */
  getStrategyLibraryDetail: (key: string) =>
    http.request<StrategyLibraryDetailResponse>(
      `/templates/strategy-library/${encodeURIComponent(key)}`,
    ),

  /**
   * What a live strategy's simulation bought and sold on its latest session, by slug or id;
   * `activity` is null for a strategy without a live run. Its `/source` sibling is the LLM
   * service's and is never called from an app.
   */
  getStrategyLibraryActivity: (key: string) =>
    http.request<StrategyLibraryActivityResponse>(
      `/templates/strategy-library/${encodeURIComponent(key)}/activity`,
    ),
});

export type TemplatesApi = ReturnType<typeof templatesApi>;
