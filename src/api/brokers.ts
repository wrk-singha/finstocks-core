import type {
  BrokerOptions,
  updateDhannRequest,
  updateGrowwRequest,
  updateUpstoxRequest,
  updateZerodhaRequest,
  upstoxCallbackResponse,
  upstoxRedirectResponse,
} from '../types/broker.ts';
import type {ReserveIpAddressResponse} from '../types/trade.ts';
import type {HttpClient} from './http.ts';

export const brokersApi = (http: HttpClient) => ({
  updateZerodha: (data: updateZerodhaRequest) =>
    http.request<{success: boolean}>('/update-zerodha', {
      method: 'POST',
      body: data,
    }),

  updateGroww: (data: updateGrowwRequest) =>
    http.request<{success: boolean}>('/update-groww', {
      method: 'POST',
      body: data,
    }),

  updateDhann: (data: updateDhannRequest) =>
    http.request<{success: boolean}>('/update-dhann', {
      method: 'POST',
      body: data,
    }),

  /** Upstox is OAuth: connecting returns a redirect_url the app opens in a browser. */
  updateUpstox: (data: updateUpstoxRequest) =>
    http.request<upstoxRedirectResponse>('/broker/upstox/connect', {
      method: 'POST',
      body: data,
    }),

  /**
   * Finalizes the Upstox link by trading the `code` Upstox appended to the
   * redirect for an access token. Each app exchanges with its own session.
   */
  exchangeUpstoxCode: (code: string) =>
    http.request<upstoxCallbackResponse>('/broker/upstox/callback', {
      method: 'POST',
      body: {code},
    }),

  disconnect: (broker: BrokerOptions) =>
    http.request<{success: boolean}>('/disconnect-broker', {
      method: 'POST',
      body: {broker},
    }),

  /** Reserved outbound IP the user whitelists with their broker (critical for Dhan). */
  reserveIp: () => http.request<ReserveIpAddressResponse>('/trading/get-ip'),
});

export type BrokersApi = ReturnType<typeof brokersApi>;
