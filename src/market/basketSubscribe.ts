import {statusOf} from '../api/http.ts';
import {getApiErrorMessage} from '../trading/brokerErrors.ts';

/**
 * Why the backend refused to create a subscription, where it did. `alreadySubscribed` is its 409
 * ("You already subscribe to this basket"); `noBroker` its 412 for a live subscription with no
 * broker connected; `invalid` its 400 or 422 — the mode, the capital under the basket's floor or
 * over ₹10 crore, or a live subscription without `confirm_live`, each in the backend's own words.
 * `refused` covers the other statuses that answer before anything is written (401, 403, 404, 429).
 */
export type EsfSubscribeRefusalKind =
  'alreadySubscribed' | 'noBroker' | 'invalid' | 'refused';

export interface EsfSubscribeRefusal {
  kind: EsfSubscribeRefusalKind;
  /** The backend's text, read as `getApiErrorMessage` reads it; the fallback when it sent none. */
  message: string;
}

// Each of these is answered before the backend writes the subscription (`SubscribeHandler`): the
// payload and mode checks, the capital floor, the live consent, the broker check and the uniqueness
// insert all come before any order is placed. 500 is not here: "Failed to subscribe" answers a
// write that was attempted, and the first orders run inside the same request.
const SUBSCRIBE_REFUSED: Readonly<Record<number, EsfSubscribeRefusalKind>> = {
  400: 'invalid',
  401: 'refused',
  403: 'refused',
  404: 'refused',
  409: 'alreadySubscribed',
  412: 'noBroker',
  422: 'invalid',
  429: 'refused',
};

/**
 * Reads a failed `esfApi.subscribe` call. A refusal says the subscription was not created and
 * nothing was traded. Null is the other answer: a timeout, the network, a 5xx or anything without
 * a status — the subscription may exist and its first orders may have gone in, so a caller shows
 * "no answer", re-reads the basket, and never sends the request again by itself.
 */
export function esfSubscribeRefusal(
  error: unknown,
  fallback: string,
): EsfSubscribeRefusal | null {
  const status = statusOf(error);
  if (status === undefined) return null;
  const kind = SUBSCRIBE_REFUSED[status];
  if (kind === undefined) return null;
  return {kind, message: getApiErrorMessage(error, fallback)};
}
