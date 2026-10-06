import assert from 'node:assert/strict';
import {test} from 'node:test';

import {atmLockTarget, crossedMidpoint} from '../atmLock.ts';

// NIFTY-like 100-point strikes: the midpoint up from 23000 is 23050 and the
// default 10% hysteresis puts the trigger 10 points past it, at 23060.
const STRIKES = [22800, 22900, 23000, 23100, 23200];

test('atmLockTarget stays put inside the hysteresis band above the midpoint', () => {
  assert.equal(atmLockTarget(23050, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(23059.99, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(23060, STRIKES, 23000), 23100);
});

test('atmLockTarget stays put inside the hysteresis band below the midpoint', () => {
  assert.equal(atmLockTarget(22950, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(22940.01, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(22940, STRIKES, 23000), 22900);
});

test('atmLockTarget does not flip back on the midpoint it just crossed', () => {
  // Moved up to 23100; spot sinks back just under 23050: still 23100.
  assert.equal(atmLockTarget(23045, STRIKES, 23100), 23100);
  assert.equal(atmLockTarget(23040, STRIKES, 23100), 23000);
});

test('atmLockTarget takes the hysteresis as a share of the gap', () => {
  assert.equal(atmLockTarget(23051, STRIKES, 23000, 0), 23100);
  // Exactly on the midpoint both strikes are as near; the current one holds.
  assert.equal(atmLockTarget(23050, STRIKES, 23000, 0), 23000);
  assert.equal(atmLockTarget(23070, STRIKES, 23000, 0.25), 23000);
  assert.equal(atmLockTarget(23075, STRIKES, 23000, 0.25), 23100);
});

test('atmLockTarget jumps straight to the nearest strike on a big move', () => {
  assert.equal(atmLockTarget(23190, STRIKES, 23000), 23200);
  assert.equal(atmLockTarget(22810, STRIKES, 23000), 22800);
});

test('atmLockTarget snaps a strike missing from the list to the money', () => {
  // Another expiry's strike: no hysteresis, the nearest listed strike at once.
  assert.equal(atmLockTarget(23055, STRIKES, 23050), 23100);
  assert.equal(atmLockTarget(23045, STRIKES, 23050), 23000);
  assert.equal(atmLockTarget(23001, STRIKES, 24500), 23000);
});

test('atmLockTarget holds at the ends of the list', () => {
  assert.equal(atmLockTarget(23900, STRIKES, 23200), 23200);
  assert.equal(atmLockTarget(21000, STRIKES, 22800), 22800);
  assert.equal(atmLockTarget(21000, STRIKES, 23000), 22800);
  assert.equal(atmLockTarget(23900, [23000], 23000), 23000);
});

test('atmLockTarget reads an unsorted list as a sorted one', () => {
  const unsorted = [23100, 22800, 23200, 23000, 22900];
  assert.equal(atmLockTarget(23059, unsorted, 23000), 23000);
  assert.equal(atmLockTarget(23060, unsorted, 23000), 23100);
  assert.equal(atmLockTarget(22940, unsorted, 23000), 22900);
  assert.equal(atmLockTarget(23055, unsorted, 23050), 23100);
  // The caller's list is not reordered.
  assert.deepEqual(unsorted, [23100, 22800, 23200, 23000, 22900]);
});

test('atmLockTarget leaves the strike alone with no spot or no list', () => {
  assert.equal(atmLockTarget(0, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(-5, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(Number.NaN, STRIKES, 23000), 23000);
  assert.equal(atmLockTarget(23500, [], 23000), 23000);
});

test('crossedMidpoint names the midpoint to the neighbour in the move', () => {
  assert.equal(crossedMidpoint(23000, 23100, STRIKES), 23050);
  assert.equal(crossedMidpoint(23000, 22900, STRIKES), 22950);
  // A jump of two strikes crossed the first midpoint first.
  assert.equal(crossedMidpoint(23000, 23200, STRIKES), 23050);
  assert.equal(crossedMidpoint(23000, 22800, STRIKES), 22950);
});

test('crossedMidpoint reads an unsorted list and falls back at the ends', () => {
  assert.equal(
    crossedMidpoint(23000, 23100, [23200, 23000, 22900, 23100]),
    23050,
  );
  // No neighbour on that side: halfway between from and to.
  assert.equal(crossedMidpoint(23200, 23400, STRIKES), 23300);
  assert.equal(crossedMidpoint(22800, 22600, STRIKES), 22700);
});
