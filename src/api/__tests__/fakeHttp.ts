import type {HttpClient, RequestInit} from '../http.ts';

export interface RecordedCall {
  path: string;
  init: RequestInit | undefined;
}

/** Records every request and answers each with the next canned response (or `{}`). */
export const fakeHttp = (responses: unknown[] = []) => {
  const calls: RecordedCall[] = [];
  const queue = [...responses];
  const http: HttpClient = {
    request<T>(path: string, init?: RequestInit): Promise<T> {
      calls.push({path, init});
      return Promise.resolve((queue.length ? queue.shift() : {}) as T);
    },
  };
  const last = (): RecordedCall => {
    const call = calls.at(-1);
    if (!call) throw new Error('no request recorded');
    return call;
  };
  return {http, calls, last};
};
