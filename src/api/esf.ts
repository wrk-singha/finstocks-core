import type {EsfScore} from '../types/esf.ts';
import type {HttpClient} from './http.ts';
import {query} from './http.ts';

/** ESF: the FinStocks Score for one stock. */
export const esfApi = (http: HttpClient) => ({
  /** Scores change once an evening. A symbol with no score is the endpoint's failure, not a null. */
  getScore: (symbol: string) =>
    http.request<EsfScore>(`/esf/score${query({symbol})}`),
});

export type EsfApi = ReturnType<typeof esfApi>;
