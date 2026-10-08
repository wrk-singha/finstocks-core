/**
 * The one thing core asks of a host app: a way to make a typed request. Mobile implements it over
 * its `services/http` client, the web over its axios instance. Core defines paths, query strings,
 * payloads and response types — it never calls `fetch` itself.
 */
export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestInit = {
  readonly method?: HttpMethod;
  /** JSON-serialisable body; the host encodes it. */
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  /** Milliseconds; the host applies its default when absent. */
  readonly timeoutMs?: number;
  /** Sent as `Idempotency-Key`: every order request carries one so a retry cannot place twice. */
  readonly idempotencyKey?: string;
  /** Never attach the bearer (pre-login endpoints such as login and waitlist). */
  readonly anonymous?: boolean;
  /**
   * The words of a 401 the route answers itself, as its error body's `error` reads them: a refusal
   * of what was sent (a wrong old password), not a dead session, so the host keeps the session for
   * it. Any other 401 from the route, such as the auth middleware's, still ends the session.
   */
  readonly ownUnauthorized?: string;
  /**
   * The route can answer with another service's status, a 401 included: backend-go forwards the
   * trade manager's answer for /trading/buy and /trading/sell (`handlers/trading/manual.go`
   * `forwardTrade`) and the voice service's status for /voice/session (`voice_session.go`). Only a
   * 401 in the auth middleware's own words (`SESSION_UNAUTHORIZED`) ends the session; any other is
   * that request's error.
   */
  readonly forwardsUnauthorized?: boolean;
  readonly signal?: AbortSignal;
};

/**
 * The words backend-go's auth middleware refuses a token with (`internal/middleware/auth.go`
 * `TokenRequired`), each a 401: the only answers that say the session itself is dead.
 */
export const SESSION_UNAUTHORIZED: readonly string[] = [
  'Token is missing!',
  'Invalid token signature',
  'Invalid token',
  'User not found',
  'Session expired, please log in again',
];

/**
 * Whether a token-bearing 401 whose error body reads `message` ends the session, by the rule its
 * route declares. A route that declares none fails closed: every 401 ends the session.
 */
export function endsSession(
  message: string,
  init?: {
    readonly ownUnauthorized?: string | undefined;
    readonly forwardsUnauthorized?: boolean | undefined;
  },
): boolean {
  if (init?.ownUnauthorized !== undefined && message === init.ownUnauthorized)
    return false;
  if (init?.forwardsUnauthorized === true)
    return SESSION_UNAUTHORIZED.includes(message);
  return true;
}

export type HttpClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

/**
 * The HTTP status a host's rejected request carries: `status` on mobile's `ApiError`,
 * `response.status` on an axios error. Undefined for anything else thrown, so a caller that
 * turns one status into an answer never mistakes a transport failure for it.
 */
export function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const {status, response} = error as {status?: unknown; response?: unknown};
  if (typeof status === 'number') return status;
  if (typeof response !== 'object' || response === null) return undefined;
  const nested = (response as {status?: unknown}).status;
  return typeof nested === 'number' ? nested : undefined;
}

/** Builds `?a=1&b=2` from defined values only; an empty object yields ''. */
export function query(
  params: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.length === 0 ? '' : `?${parts.join('&')}`;
}
