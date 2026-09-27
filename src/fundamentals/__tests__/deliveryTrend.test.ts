import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {DeliverableRow} from '../../types/fundamentalsDetail.ts';
import {DELIVERY_SESSIONS, deliveryTrend} from '../deliveryTrend.ts';

const row = (date: string, pct: number | null): DeliverableRow => ({
  date,
  volume: 1_000_000,
  delv_volume: pct == null ? null : pct * 10_000,
  delv_pct: pct,
});

test('the sessions read oldest first, led by the newest as the latest', () => {
  const trend = deliveryTrend([
    row('2026-09-10', 40),
    row('2026-09-09', 20),
    row('2026-09-08', 30),
  ]);
  assert.deepEqual(trend, {
    sessions: [
      {date: '2026-09-08', pct: 30},
      {date: '2026-09-09', pct: 20},
      {date: '2026-09-10', pct: 40},
    ],
    latest: 40,
    average: 30,
    peak: 40,
  });
});

test('a session with no delivered share is skipped, not read as zero', () => {
  const trend = deliveryTrend([
    row('2026-09-10', null),
    row('2026-09-09', 20),
    row('2026-09-08', 30),
  ]);
  assert.equal(trend?.latest, 20);
  assert.equal(trend?.average, 25);
  assert.deepEqual(
    trend?.sessions.map(s => s.date),
    ['2026-09-08', '2026-09-09'],
  );
});

test('under two sessions there is no trend to draw', () => {
  assert.equal(deliveryTrend([]), null);
  assert.equal(deliveryTrend([row('2026-09-10', 40)]), null);
  assert.equal(
    deliveryTrend([row('2026-09-10', 40), row('2026-09-09', null)]),
    null,
  );
});

test('only the newest sixty sessions are read', () => {
  const rows = Array.from({length: 75}, (_, i) =>
    row(`day-${String(i).padStart(2, '0')}`, i === 0 ? 90 : 10),
  );
  const trend = deliveryTrend(rows);
  assert.equal(trend?.sessions.length, DELIVERY_SESSIONS);
  assert.equal(trend?.sessions[0]?.date, 'day-59');
  assert.equal(trend?.latest, 90);
  assert.equal(trend?.peak, 90);
});
