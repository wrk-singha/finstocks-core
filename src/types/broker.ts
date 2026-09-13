export type BrokerOptions = 'groww' | 'zerodha' | 'dhann' | 'upstox';

export type Market = 'IN';

export interface updateZerodhaRequest {
  api_key?: string;
  request_token?: string;
  api_secret?: string;
}

export interface updateGrowwRequest {
  api_key: string;
  /** Optional so a masked (unchanged) secret can be omitted rather than sent as an empty string. */
  api_secret?: string;
}

export interface updateDhannRequest {
  request_token: string;
  user_id: string;
  validity: string;
  pin?: string;
  totp_secret?: string;
}

export interface updateUpstoxRequest {
  api_key: string;
  api_secret: string;
}

/** Upstox is OAuth: saving credentials returns a login URL to open in the browser. */
export interface upstoxRedirectResponse {
  redirect_url: string;
}

export interface upstoxCallbackResponse {
  message: string;
  static_ip?: string;
  static_ip_tied: boolean;
  static_ip_note?: string;
  reauth_required?: boolean;
}

export interface BrokerInfo {
  id: BrokerOptions;
  name: string;
  market: Market;
}
