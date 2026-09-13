import assert from 'node:assert/strict';
import {test} from 'node:test';

import {ALL_BROKERS} from '../../data/brokers.ts';
import {
  BROKER_WIZARDS,
  BROKER_WIZARD_BY_ID,
} from '../../data/brokerWizardSteps.ts';

test('every broker has a wizard with exactly one submitting step and one IP reveal', () => {
  assert.deepEqual(
    BROKER_WIZARDS.map(w => w.broker),
    ALL_BROKERS,
  );
  for (const wizard of BROKER_WIZARDS) {
    assert.equal(BROKER_WIZARD_BY_ID[wizard.broker], wizard);
    assert.equal(wizard.steps.filter(s => s.submits).length, 1);
    assert.equal(wizard.steps.filter(s => s.showFields).length, 1);
    assert.equal(wizard.steps.filter(s => s.showIP).length, 1);
    assert.ok(wizard.ipWhere.length > 0);
    assert.ok(wizard.fields.some(f => f.secret));
  }
  assert.equal(
    BROKER_WIZARD_BY_ID.dhann.fields.filter(f => f.optional).length,
    2,
  );
  assert.equal(
    BROKER_WIZARD_BY_ID.upstox.steps[1]?.code,
    'https://finstocks.ai/callback_upstox',
  );
});
