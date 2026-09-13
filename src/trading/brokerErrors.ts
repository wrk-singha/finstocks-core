export interface ApiErrorShape {
  response?: {
    data?: {
      error?: string;
      message?: string;
      detail?: string;
    };
  };
}

/**
 * An HTTP client's own `message` is the generic "Request failed with status code N" — it never
 * looks at the response body. The backend's actual message lives at `response.data.error` (see
 * backend-go utils.RespondWithError). The optional chain on the error itself matters: catch
 * blocks hand us whatever was thrown, and a bare dereference turned a handled null into a
 * TypeError.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorShape | null | undefined;
  const data = apiError?.response?.data;
  const candidates = [
    data?.error,
    data?.message,
    data?.detail,
    (error as Error | null | undefined)?.message,
  ];
  // An empty string is no message at all, so it falls through like a missing one.
  return (
    candidates.find(m => typeof m === 'string' && m.length > 0) ?? fallback
  );
}
