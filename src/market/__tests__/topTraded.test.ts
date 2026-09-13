import assert from 'node:assert/strict';
import {test} from 'node:test';

import {rankByTopTraded} from '../topTraded.ts';

const universe = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

test('ranked underlyings lead by volume and the rest keep their order', () => {
  assert.deepEqual(
    rankByTopTraded(universe, [
      {underlying: 'FINNIFTY', volume: 10},
      {underlying: 'BANKNIFTY', volume: 50},
      {underlying: 'BANKNIFTY', volume: 5},
      {underlying: 'DELISTED', volume: 99},
    ]),
    ['BANKNIFTY', 'FINNIFTY', 'NIFTY', 'MIDCPNIFTY'],
  );
});

test('no ranking returns the universe untouched', () => {
  assert.equal(rankByTopTraded(universe, undefined), universe);
  assert.equal(rankByTopTraded(universe, []), universe);
});
