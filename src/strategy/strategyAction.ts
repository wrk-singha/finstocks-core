/**
 * Running a C strategy card through `tradingApi.strategyAction`: the request each of the plan's
 * three run options becomes, and how a failed call is read. Money code: a host sends one request
 * per press, reads the answer through `strategyActionRefusal`, and never resends on its own.
 */
import {statusOf} from '../api/http.ts';
import type {
  RunSettings,
  StrategyAction,
  StrategyActionFailure,
  StrategyActionRequest,
} from '../api/trading.ts';
import {getApiErrorMessage} from '../trading/brokerErrors.ts';
import type {RunOptionKind, ScriptRun} from '../types/strategyRun.ts';

/** The action each run option sends. A live deploy of a paper run turns that same row live. */
export const STRATEGY_ACTION_BY_KIND: Readonly<
  Record<RunOptionKind, StrategyAction>
> = {
  backtest: 'backtest',
  forward: 'deploy',
  live: 'deploy_live',
};

/** A run option on a C strategy card, as the strategy-action request. */
export const scriptAction = (
  kind: RunOptionKind,
  settings: RunSettings,
  script: ScriptRun,
): StrategyActionRequest => ({
  ...settings,
  action: STRATEGY_ACTION_BY_KIND[kind],
  ...(script.strategyId === undefined ? {} : {strategy_id: script.strategyId}),
  ...(script.backtestId === undefined ? {} : {backtest_id: script.backtestId}),
  script: script.script,
  script_hash: script.scriptHash,
});

/**
 * The same request as a replace of the live version the 409 named: sent once, after the user
 * confirmed the prompt, and bound to the card's own code by carrying the same `script_hash`.
 */
export const replaceAction = (
  request: StrategyActionRequest,
  compileHash: string,
): StrategyActionRequest => ({
  ...request,
  action: 'replace',
  expected_compile_hash: compileHash,
});

/**
 * How a failed strategy-action is read.
 *
 * - `replace`: the 409 with `needs: "replace"`. Nothing was changed; `message` is the backend's
 *   confirm to show, and `compileHash` the live version a `replace` must name.
 * - `refused`: the backend said no before anything ran, in its own words — 400 (the settings,
 *   QTY or RISK_PERCENT sizing, PERCENT with no capital), 403, 404 (build it again), a 409 that
 *   asks for no replace (the live version moved since the prompt), 412 (connect a broker),
 *   422 (could not be prepared), 503 (not enabled yet), and any other 4xx.
 * - `unavailable`: the backend could not do it — 500 (its broker check failed, before anything
 *   was written) or 502 (Athena could not start it), with its words.
 *
 * A 504 is a gateway giving up on a request the backend may still be carrying out: no answer.
 */
export type StrategyActionRefusal =
  | {
      kind: 'replace';
      message: string;
      compileHash: string;
      liveName?: string | undefined;
    }
  | {kind: 'refused'; message: string}
  | {kind: 'unavailable'; message: string};

const failureOf = (error: unknown): Partial<StrategyActionFailure> => {
  if (typeof error !== 'object' || error === null) return {};
  const {data, response} = error as {data?: unknown; response?: unknown};
  // Mobile's ApiError keeps the body as `data`; an axios error under `response.data`.
  const body =
    typeof data === 'object' && data !== null
      ? data
      : typeof response === 'object' && response !== null
        ? (response as {data?: unknown}).data
        : undefined;
  return typeof body === 'object' && body !== null ? body : {};
};

/**
 * Reads a failed `tradingApi.strategyAction` call. Null is the answer that is no answer: a
 * timeout, the network, or anything thrown without a status. The request may then have been
 * carried out — a deploy activated, a backtest queued — so a host says so, re-reads the books,
 * and never sends it again by itself.
 */
export function strategyActionRefusal(
  error: unknown,
  fallback: string,
): StrategyActionRefusal | null {
  const status = statusOf(error);
  if (status === undefined || status <= 0 || status === 504) return null;
  const message = getApiErrorMessage(error, fallback);
  const failure = failureOf(error);
  if (
    status === 409 &&
    failure.needs === 'replace' &&
    typeof failure.compile_hash === 'string' &&
    failure.compile_hash !== ''
  ) {
    return {
      kind: 'replace',
      message: typeof failure.error === 'string' ? failure.error : message,
      compileHash: failure.compile_hash,
      liveName: failure.live_name,
    };
  }
  if (status >= 500 && status !== 503) return {kind: 'unavailable', message};
  return {kind: 'refused', message};
}
