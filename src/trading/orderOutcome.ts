import {statusOf} from '../api/http.ts';

export type OrderOutcome = 'accepted' | 'rejected' | 'unknown';

export interface OrderResult {
  outcome: OrderOutcome;
  message?: string;
}

// Only these say the order was refused before it reached the broker; a timeout or a late 401 may not have.
const REFUSED = new Set([400, 403, 404, 409, 422, 429]);

/**
 * What a failed order request says about the order. The status is read through `statusOf`, so the
 * one rule answers for both hosts: `response.status` on the web's axios error, `status` on mobile's
 * `ApiError`. Anything without one of the six statuses, a transport failure included, is unknown:
 * the order may have gone through.
 */
export function outcomeOfError(error: unknown): OrderOutcome {
  const status = statusOf(error);
  return status !== undefined && REFUSED.has(status) ? 'rejected' : 'unknown';
}
