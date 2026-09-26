import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  BACKTEST_PERIODS,
  BACKTEST_STALLED_AFTER_MS,
  backtestDates,
  CARD_HIGHLIGHT_RUN,
  clampPeriod,
  DEFAULT_BACKTEST_PERIOD,
  isDeploymentOpen,
  isPeriodAllowed,
  maxPeriod,
  periodForWindow,
  runAgeMs,
  snapshotRuns,
} from '../strategyRunOptions.ts';
import {strategy} from './fixtures.ts';

const ALL = ['1m', '3m', '6m', '1y', '2y', '3y', '5y'];

const allowedOn = (timeframe: string) =>
  BACKTEST_PERIODS.filter(p => isPeriodAllowed(p.value, timeframe)).map(
    p => p.value,
  );

test('the period ladder runs from a month to five years and opens on six months', () => {
  assert.deepEqual(
    BACKTEST_PERIODS.map(p => p.value),
    ALL,
  );
  assert.deepEqual(
    BACKTEST_PERIODS.map(p => p.days),
    [30, 90, 180, 365, 730, 1095, 1825],
  );
  assert.equal(DEFAULT_BACKTEST_PERIOD, '6m');
});

test('intraday candles cap the period where the server does, and nothing else is capped', () => {
  assert.deepEqual(allowedOn('1m'), ['1m', '3m', '6m', '1y']);
  assert.deepEqual(allowedOn('5m'), ['1m', '3m', '6m', '1y', '2y', '3y']);
  assert.deepEqual(allowedOn('15m'), ALL);
  assert.deepEqual(allowedOn('1h'), ALL);
  assert.deepEqual(allowedOn('1d'), ALL);
  assert.equal(maxPeriod('1m'), '1y');
  assert.equal(maxPeriod('5m'), '3y');
  assert.equal(maxPeriod('15m'), '5y');
  assert.equal(maxPeriod('1d'), '5y');
});

test('a period the candle size cannot reach clamps to the longest one it can', () => {
  assert.equal(clampPeriod('5y', '1m'), '1y');
  assert.equal(clampPeriod('2y', '1m'), '1y');
  assert.equal(clampPeriod('5y', '5m'), '3y');
  assert.equal(clampPeriod('6m', '1m'), '6m');
  assert.equal(clampPeriod('5y', '1d'), '5y');
});

test('a window the plan named rounds up to the rung that covers it', () => {
  const end = '2026-09-11';
  // A week still tests a month: the ladder has nothing shorter, and less would ignore the ask.
  assert.equal(periodForWindow('2026-09-07', end), '1m');
  // A calendar month is 31 days, just over the nominal 30, and stays on its own rung.
  assert.equal(periodForWindow('2026-08-11', end), '1m');
  assert.equal(periodForWindow('2026-06-11', end), '3m');
  assert.equal(periodForWindow('2026-03-11', end), '6m');
  assert.equal(periodForWindow('2025-09-11', end), '1y');
  assert.equal(periodForWindow('2024-09-01', end), '2y');
  assert.equal(periodForWindow('2023-09-11', end), '3y');
  assert.equal(periodForWindow('2021-09-11', end), '5y');
  assert.equal(periodForWindow('2020-01-01', end), '5y');
  // An open end runs to now.
  assert.equal(
    periodForWindow('2026-06-11', undefined, new Date('2026-09-11T00:00:00Z')),
    '3m',
  );
  // Postgres' spelling, which a bare Date rejects on Hermes.
  assert.equal(
    periodForWindow('2026-06-11 09:15:00+05:30', '2026-09-11 15:30:00+05'),
    '3m',
  );
});

test('no window, or one that is not a window, names no period', () => {
  assert.equal(periodForWindow(undefined, '2026-09-11'), undefined);
  assert.equal(periodForWindow('last week', '2026-09-11'), undefined);
  assert.equal(periodForWindow('2026-09-11', 'soon'), undefined);
  assert.equal(periodForWindow('2026-09-11', '2026-09-07'), undefined);
  assert.equal(periodForWindow('2026-09-11', '2026-09-11'), undefined);
});

test('backtest dates end today and reach back the whole period, on the UTC calendar', () => {
  const now = new Date('2026-09-26T06:30:00Z');
  assert.deepEqual(backtestDates('1m', now), {
    start_date: '2026-08-27',
    end_date: '2026-09-26',
  });
  assert.deepEqual(backtestDates('6m', now), {
    start_date: '2026-03-30',
    end_date: '2026-09-26',
  });
  assert.deepEqual(backtestDates('5y', now), {
    start_date: '2021-09-27',
    end_date: '2026-09-26',
  });
  // 01:30 IST on the 26th is still the 25th in UTC, which is the day the request carries.
  assert.deepEqual(backtestDates('1y', new Date('2026-09-25T20:00:00Z')), {
    start_date: '2025-09-25',
    end_date: '2026-09-25',
  });
});

test('a plan snapshots the newest run of each kind, each picked on its own', () => {
  const runs = [
    strategy({
      strategy_id: 'bt-old',
      is_backtest: true,
      is_mock: true,
      status: 'COMPLETED',
      created_at: '2026-09-01T00:00:00Z',
    }),
    strategy({
      strategy_id: 'bt-new',
      is_backtest: true,
      is_mock: true,
      status: 'COMPLETED',
      created_at: '2026-09-03T00:00:00Z',
    }),
    strategy({
      strategy_id: 'fw-old',
      is_mock: true,
      created_at: '2026-09-02T00:00:00Z',
    }),
    strategy({
      strategy_id: 'fw-new',
      is_mock: true,
      status: 'STOPPED',
      created_at: '2026-09-04T00:00:00Z',
    }),
    strategy({
      strategy_id: 'live',
      is_mock: false,
      status: 'PAUSED',
      created_at: '2026-09-02T00:00:00Z',
    }),
  ];
  const ids = (list: typeof runs) => {
    const snapshot = snapshotRuns(list);
    return [
      snapshot.backtest?.strategy_id,
      snapshot.forward?.strategy_id,
      snapshot.live?.strategy_id,
    ];
  };
  assert.deepEqual(ids(runs), ['bt-new', 'fw-new', 'live']);
  assert.deepEqual(ids([...runs].reverse()), ['bt-new', 'fw-new', 'live']);
  assert.deepEqual(ids([]), [undefined, undefined, undefined]);
});

test('a row that does not say it is mock is never read as a live run', () => {
  const snapshot = snapshotRuns([
    {created_at: '2026-09-05T00:00:00Z', is_backtest: false},
  ]);
  assert.equal(snapshot.live, undefined);
  assert.equal(snapshot.forward, undefined);
});

test('a deployment is open while it can still place, or resume placing, orders', () => {
  for (const status of ['RUNNING', 'active', 'PENDING', 'WAITING', 'PAUSED']) {
    assert.equal(isDeploymentOpen({status}), true, status);
  }
  for (const status of ['STOPPED', 'COMPLETED', 'ARCHIVED', '', null]) {
    assert.equal(isDeploymentOpen({status}), false, String(status));
  }
  assert.equal(isDeploymentOpen(undefined), false);
});

test("a run's age is read off its own created_at, and ten minutes is the stall bound", () => {
  const now = Date.parse('2026-09-11T10:00:00Z');
  assert.equal(
    runAgeMs({created_at: '2026-09-11T09:50:00Z'}, now),
    BACKTEST_STALLED_AFTER_MS,
  );
  assert.equal(
    runAgeMs({created_at: '2026-09-11 09:55:00.827232+00'}, now),
    5 * 60_000 - 827,
  );
  assert.equal(runAgeMs({created_at: 'not a date'}, now), 0);
  assert.equal(BACKTEST_STALLED_AFTER_MS, 10 * 60_000);
});

test('a backtest answer highlights the backtest, a strategy answer the forward test', () => {
  assert.deepEqual(CARD_HIGHLIGHT_RUN, {
    backtest: 'backtest',
    strategies: 'forward',
  });
});
