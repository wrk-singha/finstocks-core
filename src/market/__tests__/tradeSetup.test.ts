import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  entryStatus,
  isPickExpired,
  ladderPoints,
  tradeGeometry,
} from '../tradeSetup.ts';

const reco = {
  cmp: 105,
  entry_min: 100,
  entry_max: 110,
  stop_loss: 90,
  target_price: 130,
};

test('entry status is judged against the published band', () => {
  assert.deepEqual(entryStatus(reco), {
    state: 'in_zone',
    label: 'In entry zone',
    driftPct: null,
  });
  assert.deepEqual(entryStatus({...reco, cmp: 121}), {
    state: 'above_zone',
    label: '10.0% above entry',
    driftPct: ((121 - 110) / 110) * 100,
  });
  assert.deepEqual(entryStatus({...reco, cmp: 95}), {
    state: 'below_zone',
    label: '5.0% below entry',
    driftPct: 5,
  });
  // Without an upper edge the band collapses to entry_min.
  assert.equal(
    entryStatus({...reco, entry_max: null, cmp: 100}).state,
    'in_zone',
  );
  assert.equal(
    entryStatus({...reco, cmp: null}).label,
    'Entry zone unavailable',
  );
});

test('geometry keeps unknown legs null rather than zero', () => {
  assert.deepEqual(tradeGeometry(reco), {risk: 10, reward: 30, ratio: 3});
  assert.deepEqual(
    tradeGeometry({...reco, stop_loss: null as unknown as number}),
    {
      risk: null,
      reward: 30,
      ratio: null,
    },
  );
  assert.deepEqual(
    tradeGeometry({...reco, entry_min: null as unknown as number}),
    {
      risk: null,
      reward: null,
      ratio: null,
    },
  );
});

test('ladder points sit proportionally between stop and target, cmp clamped', () => {
  assert.deepEqual(ladderPoints(reco), [
    {key: 'stop', pos: 0, price: 90},
    {key: 'entry', pos: 0.25, price: 100},
    {key: 'target', pos: 1, price: 130},
    {key: 'cmp', pos: 0.375, price: 105},
  ]);
  assert.equal(ladderPoints({...reco, cmp: 150})?.[3]?.pos, 1);
  assert.equal(ladderPoints({...reco, target_price: 90}), null);
  assert.equal(
    ladderPoints({...reco, stop_loss: null as unknown as number}),
    null,
  );
});

test('entry drift is measured to the nearer edge, and null when there is none to measure', () => {
  assert.equal(entryStatus({...reco, cmp: null}).driftPct, null);
  assert.equal(
    entryStatus({...reco, entry_min: null as unknown as number}).driftPct,
    null,
  );
  assert.equal(entryStatus({...reco, cmp: 110}).driftPct, null);
  // A reversed band is normalised, so 99 sits 1% under the 100 edge.
  assert.equal(
    entryStatus({...reco, entry_min: 110, entry_max: 100, cmp: 99}).driftPct,
    1,
  );
  // Unrounded: the label says 0.3% but the number keeps its precision.
  const drift = entryStatus({...reco, cmp: 110.37}).driftPct;
  assert.ok(drift != null && Math.abs(drift - 0.33636) < 1e-4);
  // A zero edge has no percentage to divide by.
  assert.equal(
    entryStatus({...reco, entry_min: 0, entry_max: 0, cmp: 5}).driftPct,
    0,
  );
});

// Recorded from the v0.2.4 implementation before driftPct was added.
test('entry status state and label read exactly as v0.2.4 did', () => {
  const read = (fields: typeof reco) => {
    const {state, label} = entryStatus(fields);
    return {state, label};
  };
  assert.deepEqual(
    [
      read(reco),
      read({...reco, cmp: 121}),
      read({...reco, cmp: 95}),
      read({...reco, entry_min: 110, entry_max: 100, cmp: 99}),
      read({...reco, entry_min: 0, entry_max: 0, cmp: 5}),
      read({...reco, cmp: 110.37}),
      read({...reco, cmp: null as unknown as number}),
    ],
    [
      {state: 'in_zone', label: 'In entry zone'},
      {state: 'above_zone', label: '10.0% above entry'},
      {state: 'below_zone', label: '5.0% below entry'},
      {state: 'below_zone', label: '1.0% below entry'},
      {state: 'above_zone', label: '0.0% above entry'},
      {state: 'above_zone', label: '0.3% above entry'},
      {state: 'unknown', label: 'Entry zone unavailable'},
    ],
  );
});

test('an open pick is expired from its valid-until on, and a closed one is judged by its status', () => {
  const until = '2026-10-20T09:45:00.123456Z';
  const at = Date.parse('2026-10-20T09:45:00.123Z');
  const open = {status: 'active', valid_until: until};
  assert.equal(isPickExpired(open, at - 60_000), false);
  assert.equal(isPickExpired(open, at), true);
  assert.equal(isPickExpired(open, at + 60_000), true);
  // A stamp that cannot be read is not a pick to take.
  assert.equal(isPickExpired({status: 'active', valid_until: ''}, 0), true);
  assert.equal(
    isPickExpired({status: 'hit_target', valid_until: until}, at),
    false,
  );
  assert.equal(
    isPickExpired({status: 'expired', valid_until: until}, at),
    false,
  );
});
