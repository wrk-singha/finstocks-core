/**
 * The one thing core asks of a host app: a way to make a typed request. Mobile implements it over
 * its `services/http` client, the web over its axios instance. Core defines paths, query strings,
 * payloads and response types — it never calls `fetch` itself.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

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
  readonly signal?: AbortSignal;
};

export type HttpClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
};

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
