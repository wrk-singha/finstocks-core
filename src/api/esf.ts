import type {
  EsfBacktestDetail,
  EsfBasketDetail,
  EsfBasketsResponse,
  EsfScore,
  EsfSubscribeRequest,
  EsfSubscription,
  EsfSubscriptionRecord,
  EsfSubscriptionStatus,
  EsfSubscriptionStatusRequest,
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

  /**
   * Invests in a basket. Money moves on this call: the backend places the first orders inside it
   * (paper fills at once; real orders go to the broker while the market is open, else at 09:20
   * next session) and trades the subscription at every review after, with no further consent.
   * One per user per basket across both modes (409). A request that got no answer may have
   * created the subscription: a caller re-reads the basket rather than sending again.
   */
  subscribe: (slug: string, body: EsfSubscribeRequest) =>
    http.request<EsfSubscription>(
      `/esf/baskets/${encodeURIComponent(slug)}/subscriptions`,
      {method: 'POST', body},
    ),

  /**
   * Pauses, resumes or cancels a subscription. Nothing held is sold by any of these; `cancelled`
   * removes the subscription, so the basket can be invested in afresh.
   */
  setSubscriptionStatus: (id: number, status: EsfSubscriptionStatus) =>
    http.request<EsfSubscriptionRecord>(`/esf/subscriptions/${String(id)}`, {
      method: 'PATCH',
      body: {status} satisfies EsfSubscriptionStatusRequest,
    }),
});

export type EsfApi = ReturnType<typeof esfApi>;
