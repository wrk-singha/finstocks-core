import assert from 'node:assert/strict';
import {test} from 'node:test';

import {listStamp} from '../listStamp.ts';

/** An IST wall-clock instant: "2026-10-26 15:35" → epoch ms. */
const ist = (stamp: string): number =>
  Date.parse(`${stamp.replace(' ', 'T')}:00+05:30`);
const iso = (stamp: string): string => new Date(ist(stamp)).toISOString();

// 2026-10-23 is a Friday; 2026-10-26 a Monday, both trading days.
const fridayOpen = ist('2026-10-23 09:15');
const mondayOpen = ist('2026-10-26 09:15');

test('a list fetched in session and still on screen after the bell keeps its own time, never "close"', () => {
  assert.deepEqual(
    listStamp(iso('2026-10-26 15:20'), false, ist('2026-10-26 15:35')),
    {kind: 'asOf', at: ist('2026-10-26 15:20'), showsDay: true},
  );
});

test('off-hours, a frame from the middle of the session names its own day and time', () => {
  assert.deepEqual(
    listStamp(iso('2026-10-26 14:00'), false, ist('2026-10-26 20:00')),
    {kind: 'asOf', at: ist('2026-10-26 14:00'), showsDay: true},
  );
  // Polling stops at the bell: 15:27 is not the close, the last minute's frame (15:28) is.
  assert.equal(
    listStamp(iso('2026-10-26 15:27'), false, ist('2026-10-26 20:00')).kind,
    'asOf',
  );
  assert.deepEqual(
    listStamp(iso('2026-10-26 15:28'), false, ist('2026-10-26 20:00')),
    {kind: 'close', session: mondayOpen},
  );
  // A server read long after the bell is still the close it read, not a time anything traded at.
  assert.deepEqual(
    listStamp(iso('2026-10-27 03:19'), false, ist('2026-10-27 03:20')),
    {kind: 'close', session: mondayOpen},
  );
});

test('in the pre-open auction a frame from today says so; one from before it is the last close', () => {
  assert.deepEqual(
    listStamp(iso('2026-10-26 09:07'), false, ist('2026-10-26 09:10')),
    {kind: 'preOpen', at: ist('2026-10-26 09:07')},
  );
  assert.deepEqual(listStamp(undefined, false, ist('2026-10-26 09:10')), {
    kind: 'preOpen',
    at: null,
  });
  assert.deepEqual(
    listStamp(iso('2026-10-23 15:30'), false, ist('2026-10-26 09:10')),
    {kind: 'close', session: fridayOpen},
  );
  // Before 09:00 there is no auction yet: Friday's close.
  assert.deepEqual(
    listStamp(iso('2026-10-26 08:55'), false, ist('2026-10-26 08:58')),
    {kind: 'close', session: fridayOpen},
  );
});

test('on a day the market does not trade, the stamp names the last session’s close', () => {
  assert.deepEqual(
    listStamp(iso('2026-10-24 03:19'), false, ist('2026-10-25 12:00')),
    {kind: 'close', session: fridayOpen},
  );
  assert.deepEqual(listStamp(null, false, ist('2026-10-25 12:00')), {
    kind: 'close',
    session: fridayOpen,
  });
  // A read from before that session is older than its close: its own day and time.
  assert.deepEqual(
    listStamp(iso('2026-10-22 15:30'), false, ist('2026-10-25 12:00')),
    {kind: 'asOf', at: ist('2026-10-22 15:30'), showsDay: true},
  );
});

test('in session the read is live: its time, its day only when not today, and Live when it has none', () => {
  assert.deepEqual(
    listStamp(iso('2026-10-26 10:42'), true, ist('2026-10-26 10:43')),
    {kind: 'asOf', at: ist('2026-10-26 10:42'), showsDay: false},
  );
  assert.deepEqual(
    listStamp(ist('2026-10-23 15:29'), true, ist('2026-10-26 09:16')),
    {kind: 'asOf', at: ist('2026-10-23 15:29'), showsDay: true},
  );
  assert.deepEqual(listStamp('', true, ist('2026-10-26 10:43')), {
    kind: 'live',
  });
  assert.deepEqual(listStamp('not a time', true, ist('2026-10-26 10:43')), {
    kind: 'live',
  });
});
