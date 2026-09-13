import assert from 'node:assert/strict';
import {test} from 'node:test';

import {entryStatus, ladderPoints, tradeGeometry} from '../tradeSetup.ts';

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
  });
  assert.deepEqual(entryStatus({...reco, cmp: 121}), {
    state: 'above_zone',
    label: '10.0% above entry',
  });
  assert.deepEqual(entryStatus({...reco, cmp: 95}), {
    state: 'below_zone',
    label: '5.0% below entry',
  });
  // Without an upper edge the band collapses to entry_min.
  assert.equal(
    entryStatus({...reco, entry_max: null, cmp: 100}).state,
    'in_zone',
  );
  assert.equal(
    entryStatus({...reco, cmp: null as unknown as number}).label,
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
