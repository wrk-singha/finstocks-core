import type {
  EsfBacktestDetail,
  EsfBasketDetail,
  EsfBasketsResponse,
  EsfScore,
} from '../types/esf.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

/** ESF: the FinStocks Score for one stock, and the rule-based baskets built on it. */
export const esfApi = (http: HttpClient) => ({
  /** Scores change once an evening. A symbol with no score is the endpoint's failure, not a null. */
  getScore: (symbol: string) =>
    http.request<EsfScore>(`/esf/score${query({symbol})}`),

  /** Every rule-based basket as a card, with the caller's own subscription mode on each. */
  getBaskets: () => http.request<EsfBasketsResponse>('/esf/baskets'),

  /** One basket: holdings, history, value since launch, backtests and the caller's subscription. */
  getBasket: (slug: string) =>
    http.request<EsfBasketDetail>(`/esf/baskets/${encodeURIComponent(slug)}`),

  /** Every month, pick and day of one backtest run — the logs behind its summary. */
  getBacktest: (slug: string, id: number) =>
    http.request<EsfBacktestDetail>(
      `/esf/baskets/${encodeURIComponent(slug)}/backtests/${String(id)}`,
    ),
});

export type EsfApi = ReturnType<typeof esfApi>;
