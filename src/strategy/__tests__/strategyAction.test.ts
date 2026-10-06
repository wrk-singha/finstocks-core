import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {RunSettings} from '../../api/trading.ts';
import type {ScriptRun} from '../../types/strategyRun.ts';
import {
  replaceAction,
  scriptAction,
  strategyActionRefusal,
} from '../strategyAction.ts';

const settings: RunSettings = {
  symbol: 'HDFCBANK',
  timeframe: '1d',
  allocated_amount: 50_000,
  sizing_mode: 'AMOUNT',
  original_query: 'Buy the dip',
  strategy_hname: 'HDFCBANK dip',
  is_intraday: false,
  message_id: 'm-9',
};

const script: ScriptRun = {
  script: 'def evaluate_v2(ctx): ...',
  scriptHash: 'abc123',
  strategyId: '6f1c2a7e-0d4b-4c3e-9a1f-2b3c4d5e6f70',
};

/** Mobile's ApiError shape: the status on the error, the body as `data`. */
const mobileError = (status: number, data: unknown, message = 'failed') =>
  Object.assign(new Error(message), {status, data});

/** An axios error: the status and body under `response`. */
const axiosError = (status: number, data: unknown) =>
  Object.assign(
    new Error('Request failed with status code ' + String(status)),
    {
      isAxiosError: true,
      response: {status, data},
    },
  );

test('each run option is its action, carrying the code, its hash and the saved rows', () => {
  assert.deepEqual(scriptAction('backtest', settings, script), {
    ...settings,
    action: 'backtest',
    strategy_id: script.strategyId,
    script: script.script,
    script_hash: 'abc123',
  });
  assert.equal(scriptAction('forward', settings, script).action, 'deploy');
  assert.equal(scriptAction('live', settings, script).action, 'deploy_live');
  // A card never saved sends no ids at all, not empty ones the backend would refuse as non-UUIDs.
  const unsaved = scriptAction('forward', settings, {
    script: 'x',
    scriptHash: 'h',
  });
  assert.equal('strategy_id' in unsaved, false);
  assert.equal('backtest_id' in unsaved, false);
});

test('a replace is the same request, as a replace of the version the 409 named', () => {
  const deploy = scriptAction('live', settings, script);
  assert.deepEqual(replaceAction(deploy, 'live-v3'), {
    ...deploy,
    action: 'replace',
    expected_compile_hash: 'live-v3',
  });
  // The code it carries is still the card's: a replace cannot name another script.
  assert.equal(replaceAction(deploy, 'live-v3').script_hash, 'abc123');
});

test('a 409 that needs a replace is the confirm to show and the version to replace', () => {
  const body = {
    error: 'This changes your live strategy HDFCBANK dip. Replace it?',
    needs: 'replace',
    live_name: 'HDFCBANK dip',
    compile_hash: 'live-v3',
  };
  assert.deepEqual(strategyActionRefusal(mobileError(409, body), 'x'), {
    kind: 'replace',
    message: body.error,
    compileHash: 'live-v3',
    liveName: 'HDFCBANK dip',
  });
  assert.deepEqual(strategyActionRefusal(axiosError(409, body), 'x'), {
    kind: 'replace',
    message: body.error,
    compileHash: 'live-v3',
    liveName: 'HDFCBANK dip',
  });
});

test('a 409 with no replace to confirm, or no version to name, is a refusal in its words', () => {
  const moved = mobileError(409, {error: 'The live version moved'}, 'moved');
  assert.deepEqual(strategyActionRefusal(moved, 'x'), {
    kind: 'refused',
    message: 'moved',
  });
  const hashless = mobileError(
    409,
    {error: 'Replace?', needs: 'replace'},
    'Replace?',
  );
  assert.deepEqual(strategyActionRefusal(hashless, 'x'), {
    kind: 'refused',
    message: 'Replace?',
  });
});

test('the statuses the backend answers before anything runs are refusals, in its words', () => {
  for (const [status, words] of [
    [400, 'sizing by qty is not available for this strategy yet'],
    [403, 'Not yours'],
    [404, 'This strategy was not found. Please build it again.'],
    [412, 'Connect a broker before deploying live'],
    [422, 'This strategy could not be prepared to run.'],
    [503, 'Running C strategies is not enabled yet'],
  ] as const) {
    assert.deepEqual(
      strategyActionRefusal(mobileError(status, {error: words}, words), 'x'),
      {kind: 'refused', message: words},
      String(status),
    );
  }
  // Web's shape reads the body, since axios's own message never looks at it.
  assert.deepEqual(
    strategyActionRefusal(axiosError(412, {error: 'Connect a broker'}), 'x'),
    {kind: 'refused', message: 'Connect a broker'},
  );
});

test('a 500 or 502 is the backend saying it could not, with its words', () => {
  assert.deepEqual(
    strategyActionRefusal(
      mobileError(500, {error: 'broker check'}, 'broker check'),
      'x',
    ),
    {kind: 'unavailable', message: 'broker check'},
  );
  assert.deepEqual(
    strategyActionRefusal(axiosError(502, {error: 'Could not start'}), 'x'),
    {kind: 'unavailable', message: 'Could not start'},
  );
  // Words it did not send fall to the host's fallback.
  assert.deepEqual(strategyActionRefusal(mobileError(502, null, ''), 'fb'), {
    kind: 'unavailable',
    message: 'fb',
  });
});

test('a timeout, the network, a gateway giving up or anything without a status is no answer at all', () => {
  assert.equal(
    strategyActionRefusal(mobileError(0, null, 'timed out'), 'x'),
    null,
  );
  assert.equal(strategyActionRefusal(axiosError(504, null), 'x'), null);
  assert.equal(strategyActionRefusal(new Error('Network Error'), 'x'), null);
  assert.equal(strategyActionRefusal(undefined, 'x'), null);
  assert.equal(strategyActionRefusal('nope', 'x'), null);
});
