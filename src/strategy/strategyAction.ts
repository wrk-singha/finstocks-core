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
 *   422 (could not be prepared), any other 4xx, and the handler's own 503 ("Running C
 *   strategies is not enabled yet"), which it answers before anything is asked of Athena.
 * - `unavailable`: the handler's own 500, "Could not verify your broker connection", which it
 *   answers before anything is asked of Athena (`requireBroker`). Nothing was written.
 *
 * Every other 5xx is NO answer (null). The handler's `failureFor` turns any Athena failure into a
 * 502 "Could not start this strategy right now. Please try again." — including a reply lost
 * AFTER Athena activated the strategy — and a 500, 503 or 504 with other words comes from a
 * gateway or a crash around a request that may have been carried out. A host that read those as
 * a clean no freed the tile, and the next swipe on a card with no `strategy_id` started a second
 * real-money strategy.
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

// The two 5xx bodies the handler itself writes before anything is asked of Athena
// (`errBrokerCheck`, `errScriptsOff` in backend-go `handlers/trading/strategyaction.go`). Any
// other 5xx body, or none, is read as no answer.
const BROKER_CHECK_FAILED = 'Could not verify your broker connection';
const SCRIPTS_NOT_ENABLED = 'Running C strategies is not enabled yet';

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
 * timeout, the network, anything thrown without a status or with one below 400 (a 2xx whose
 * body could not be read). The request may then have been
 * carried out — a deploy activated, a backtest queued — so a host says so, re-reads the books,
 * and never sends it again by itself.
 */
export function strategyActionRefusal(
  error: unknown,
  fallback: string,
): StrategyActionRefusal | null {
  const status = statusOf(error);
  // Below 400 is no refusal: a 2xx whose body could not be read, or a redirect, means the action
  // may well have run.
  if (status === undefined || status < 400) return null;
  const message = getApiErrorMessage(error, fallback);
  const failure = failureOf(error);
  if (status >= 500) {
    if (status === 500 && failure.error === BROKER_CHECK_FAILED)
      return {kind: 'unavailable', message};
    if (status === 503 && failure.error === SCRIPTS_NOT_ENABLED)
      return {kind: 'refused', message};
    return null;
  }
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
  return {kind: 'refused', message};
}

/**
 * The backend's own timeout on each call it makes to Athena: `ATHENA_TIMEOUT_SECONDS`, 15 by
 * default (backend-go `internal/config`, `athena.New`). Configurable there, so this is its
 * default, not a promise.
 */
export const ATHENA_CALL_TIMEOUT_MS = 15_000;

// The most Athena calls one action makes in turn (`strategyaction.go`): a deploy or a replace
// makes one (`Activate`, `Replace`); a backtest up to three (`Get`, then `Patch` and `Activate`,
// or `Backtest` and an `Activate` of a row it could not queue).
const ATHENA_CALLS: Readonly<Record<StrategyAction, number>> = {
  backtest: 3,
  deploy: 1,
  deploy_live: 1,
  replace: 1,
};

// For the request's way to the backend and the handler's own checks before its first Athena call.
const SETTLE_SLACK_MS = 15_000;

/**
 * How long after a strategy-action was sent its outcome is settled one way or the other: by then
 * every Athena call the backend made for it has answered or timed out. A request that got no
 * answer and whose row a book read BEGUN this long after the send still does not show did not go
 * through; one begun earlier proves nothing.
 */
export const strategyActionSettleMs = (action: StrategyAction): number =>
  ATHENA_CALLS[action] * ATHENA_CALL_TIMEOUT_MS + SETTLE_SLACK_MS;
