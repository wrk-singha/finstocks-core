import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  filterTrips,
  hourLabel,
  istDay,
  istHour,
  journalStats,
} from '../journalStats.ts';
import type {RoundTrip} from '../roundTrips.ts';

/** A closed trip entered at `ist` (IST wall clock), made `pnl`. */
const trip = (
  id: string,
  ist: string,
  pnl: number | null,
  over: Partial<RoundTrip> = {},
): RoundTrip => {
  const entryMs = Date.parse(`${ist}+05:30`);
  return {
    id,
    symbol: 'INFY',
    side: 'long',
    qty: 1,
    entryMs,
    entryPrice: 100,
    exitMs: pnl === null ? null : entryMs + 600_000,
    exitPrice: pnl === null ? null : 100 + pnl,
    pnl,
    source: 'mock',
    ...over,
  };
};

test("an instant's IST day and hour, and an hour's label", () => {
  const ms = Date.parse('2026-09-01T23:30:00+05:30');
  assert.equal(istDay(ms), '2026-09-01');
  assert.equal(istHour(ms), 23);
  assert.equal(hourLabel(9), '09:00–10:00');
  assert.equal(hourLabel(23), '23:00–00:00');
});

test('filters by symbol, side, source and inclusive IST days', () => {
  const trips = [
    trip('a', '2026-09-01T09:20:00', 10),
    trip('b', '2026-09-02T09:20:00', 10, {side: 'short'}),
    trip('c', '2026-09-03T09:20:00', 10, {source: 'live'}),
    trip('d', '2026-09-03T09:20:00', 10, {symbol: 'TCS'}),
  ];
  const all = {
    symbol: null,
    from: null,
    to: null,
    side: 'all',
    source: 'all',
  } as const;
  const ids = (f: Parameters<typeof filterTrips>[1]) =>
    filterTrips(trips, f).map(t => t.id);
  assert.deepEqual(ids({...all, symbol: 'INFY'}), ['a', 'b', 'c']);
  assert.deepEqual(ids({...all, side: 'short'}), ['b']);
  assert.deepEqual(ids({...all, source: 'live'}), ['c']);
  assert.deepEqual(ids({...all, from: '2026-09-02', to: '2026-09-02'}), ['b']);
});

test('win rate, expectancy, avg R and profit factor count closed trades only', () => {
  const stats = journalStats([
    trip('a', '2026-09-01T09:20:00', 300),
    trip('b', '2026-09-01T09:40:00', -100),
    trip('c', '2026-09-01T10:20:00', 100),
    trip('d', '2026-09-01T10:40:00', -200),
    trip('e', '2026-09-01T11:00:00', null),
  ]);
  assert.equal(stats.trades, 4);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 2);
  assert.equal(stats.winRate, 50);
  assert.equal(stats.net, 100);
  assert.equal(stats.expectancy, 25);
  assert.equal(stats.avgWin, 200);
  assert.equal(stats.avgLoss, 150);
  assert.equal(stats.avgR, 25 / 150);
  assert.equal(stats.profitFactor, 400 / 300);
  assert.equal(stats.expiry, null);
});

test('with no loser there is no R and no profit factor', () => {
  const stats = journalStats([trip('a', '2026-09-01T09:20:00', 50)]);
  assert.equal(stats.avgR, null);
  assert.equal(stats.profitFactor, null);
  assert.equal(stats.avgLoss, 0);
});

test('the best and worst hours need two trades each, and one hour is never both', () => {
  const stats = journalStats([
    trip('a', '2026-09-01T09:20:00', 100),
    trip('b', '2026-09-02T09:50:00', 50),
    trip('c', '2026-09-01T10:20:00', -100),
    trip('d', '2026-09-02T10:50:00', -20),
    trip('e', '2026-09-01T11:20:00', 999),
  ]);
  assert.deepEqual(
    stats.hours.map(h => [h.hour, h.trades]),
    [
      [9, 2],
      [10, 2],
      [11, 1],
    ],
  );
  assert.equal(stats.bestHour?.hour, 9);
  assert.equal(stats.bestHour?.avg, 75);
  assert.equal(stats.worstHour?.hour, 10);

  const one = journalStats([
    trip('a', '2026-09-01T09:20:00', 100),
    trip('b', '2026-09-02T09:50:00', 50),
  ]);
  assert.equal(one.bestHour?.hour, 9);
  assert.equal(one.worstHour, null);
  assert.equal(journalStats([]).bestHour, null);
});

test('expiry days are split from the rest; a day the calendar cannot place is counted apart', () => {
  const stats = journalStats(
    [
      trip('a', '2026-09-01T09:20:00', 100),
      trip('b', '2026-09-02T09:20:00', -40),
      trip('c', '2025-01-02T09:20:00', 10),
    ],
    day => (day < '2026-01-01' ? null : day === '2026-09-01'),
  );
  assert.equal(stats.expiry?.on.trades, 1);
  assert.equal(stats.expiry?.on.net, 100);
  assert.equal(stats.expiry?.off.trades, 1);
  assert.equal(stats.expiry?.off.winRate, 0);
  assert.equal(stats.expiry?.unknown, 1);
});
