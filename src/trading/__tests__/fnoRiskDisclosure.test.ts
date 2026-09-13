import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  acceptFnoRisk,
  hasAcceptedFnoRisk,
  setFnoRiskStore,
} from '../fnoRiskDisclosure.ts';

test('the in-memory gate flips once and a custom store takes over when installed', () => {
  assert.equal(hasAcceptedFnoRisk(), false);
  acceptFnoRisk();
  assert.equal(hasAcceptedFnoRisk(), true);

  let flag = false;
  setFnoRiskStore({get: () => flag, set: () => (flag = true)});
  assert.equal(hasAcceptedFnoRisk(), false);
  acceptFnoRisk();
  assert.equal(flag, true);

  setFnoRiskStore({
    get: () => {
      throw new Error('storage disabled');
    },
    set: () => {
      throw new Error('storage disabled');
    },
  });
  assert.equal(hasAcceptedFnoRisk(), false);
  assert.doesNotThrow(acceptFnoRisk);

  setFnoRiskStore(null);
  assert.equal(hasAcceptedFnoRisk(), true);
});
