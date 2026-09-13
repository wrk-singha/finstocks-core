import type {BrokerInfo, BrokerOptions} from '../types/broker.ts';
import type {BrokerDetails} from '../types/user.ts';

/** Canonical broker order for every picker. */
export const ALL_BROKERS: readonly BrokerOptions[] = [
  'zerodha',
  'groww',
  'dhann',
  'upstox',
];

/**
 * The broker assumed before the user picks one. One definition: the selector and the charges
 * table disagreeing means the rates shown belong to a broker other than the one on screen.
 */
export const DEFAULT_BROKER: BrokerOptions = 'zerodha';

export const BROKER_NAMES: Readonly<Record<BrokerOptions, string>> = {
  zerodha: 'Zerodha',
  groww: 'Groww',
  dhann: 'Dhan',
  upstox: 'Upstox',
};

export const BROKER_INFO: readonly BrokerInfo[] = ALL_BROKERS.map(id => ({
  id,
  name: BROKER_NAMES[id],
  market: 'IN',
}));

/** Brand colours, for the logo tile and the connected badge. Logos are app assets. */
export const BROKER_COLORS: Readonly<Record<BrokerOptions, string>> = {
  zerodha: '#387ed1',
  groww: '#00b386',
  dhann: '#12b76a',
  upstox: '#6f2da8',
};

/**
 * Where "Add money" sends the user. We can't move money ourselves — only the broker holding the
 * account can — so this hands off to the page that does it rather than pretending to be a payment
 * surface.
 */
export const BROKER_FUNDS_URLS: Readonly<Record<BrokerOptions, string>> = {
  zerodha: 'https://kite.zerodha.com/funds',
  groww: 'https://groww.in/balance',
  dhann: 'https://web.dhan.co/funds',
  upstox: 'https://pro.upstox.com/funds',
};

/** When the broker's session must be refreshed by the user; empty when it never is. */
export const BROKER_REFRESH_TIMES: Readonly<Record<BrokerOptions, string>> = {
  zerodha: 'Daily: 8:00 AM - 9:15 AM',
  groww: '',
  dhann: 'Daily: 8:00 AM - 9:15 AM',
  upstox: '',
};

export function isValidBroker(
  service: string | undefined,
): service is BrokerOptions {
  return (ALL_BROKERS as readonly string[]).includes(service ?? '');
}

/**
 * Whether a broker is fully connected, derived from the profile's `broker_details` (there is no
 * dedicated status endpoint). A broker counts as connected once both its credential and its
 * session/auth token are present.
 */
export function isBrokerConnected(
  broker: BrokerOptions,
  details: BrokerDetails | undefined,
): boolean {
  if (!details) return false;
  switch (broker) {
    case 'zerodha':
      return !!details.zerodha_api_key && !!details.zerodha_request_token;
    case 'groww':
      return (
        !!details.groww_api_key &&
        !!details.groww_api_secret &&
        !!details.groww_request_token
      );
    case 'dhann':
      return !!details.dhann_user_id && !!details.dhann_request_token;
    case 'upstox':
      return !!details.upstox_api_key && !!details.upstox_access_token;
  }
}

/** Whether any broker has a live session right now. */
export function isAnyBrokerConnected(
  details: BrokerDetails | undefined,
): boolean {
  return ALL_BROKERS.some(broker => isBrokerConnected(broker, details));
}

/**
 * Whether the user has SET UP this broker — saved the persistent credentials — regardless of the
 * daily login/session token.
 *
 * The backend nulls the ephemeral session token every market morning, so `isBrokerConnected`
 * (which needs that token) flips to false daily. Use THIS when a set-up broker shouldn't be thrown
 * back to step 1 once its session expires; use `isBrokerConnected` only when the session must be
 * live right now.
 */
export function isBrokerSetUp(
  broker: BrokerOptions,
  details: BrokerDetails | undefined,
): boolean {
  if (!details) return false;
  switch (broker) {
    case 'zerodha':
      return !!details.zerodha_api_key && !!details.zerodha_api_secret;
    case 'groww':
      return !!details.groww_api_key && !!details.groww_api_secret;
    case 'dhann':
      // The 24h access token is nightly-reset, same as Zerodha/Groww's session tokens — gate
      // setup on the persistent user_id only, so a reset doesn't bounce the user back to step 1.
      return !!details.dhann_user_id;
    case 'upstox':
      return !!details.upstox_api_key && !!details.upstox_api_secret;
  }
}

/** Prefers the active service; falls back to the first SET UP broker if that one isn't set up. */
export function connectedBrokerKey(
  details: BrokerDetails | undefined,
  service?: BrokerOptions,
): BrokerOptions | null {
  if (service && isBrokerSetUp(service, details)) return service;
  return ALL_BROKERS.find(broker => isBrokerSetUp(broker, details)) ?? null;
}

export function connectedBrokerName(
  details: BrokerDetails | undefined,
  service?: BrokerOptions,
): string | null {
  const broker = connectedBrokerKey(details, service);
  return broker ? BROKER_NAMES[broker] : null;
}
