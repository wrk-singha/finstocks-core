import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {BrokerDetails} from '../../types/user.ts';
import {
  ALL_BROKERS,
  BROKER_INFO,
  connectedBrokerKey,
  connectedBrokerName,
  isAnyBrokerConnected,
  isBrokerConnected,
  isBrokerSetUp,
  isValidBroker,
} from '../brokers.ts';

const zerodhaSetUp: BrokerDetails = {
  zerodha_api_key: 'k',
  zerodha_api_secret: true,
};
const zerodhaLive: BrokerDetails = {
  ...zerodhaSetUp,
  zerodha_request_token: true,
};

test('connected needs the session token; set up needs only the persistent credentials', () => {
  assert.equal(isBrokerConnected('zerodha', zerodhaSetUp), false);
  assert.equal(isBrokerConnected('zerodha', zerodhaLive), true);
  assert.equal(isBrokerSetUp('zerodha', zerodhaSetUp), true);
  assert.equal(isBrokerSetUp('zerodha', undefined), false);
  assert.equal(isAnyBrokerConnected(zerodhaLive), true);
  assert.equal(isAnyBrokerConnected(zerodhaSetUp), false);
});

test('dhan is set up on the user id alone: its token resets nightly', () => {
  assert.equal(isBrokerSetUp('dhann', {dhann_user_id: 'u'}), true);
  assert.equal(isBrokerConnected('dhann', {dhann_user_id: 'u'}), false);
  assert.equal(
    isBrokerConnected('dhann', {dhann_user_id: 'u', dhann_request_token: true}),
    true,
  );
});

test('the active service wins when it is set up, else the first set-up broker in canonical order', () => {
  const both: BrokerDetails = {
    ...zerodhaSetUp,
    upstox_api_key: 'k',
    upstox_api_secret: true,
  };
  assert.equal(connectedBrokerKey(both, 'upstox'), 'upstox');
  assert.equal(connectedBrokerKey(both, 'groww'), 'zerodha');
  assert.equal(connectedBrokerKey(undefined, 'groww'), null);
  assert.equal(connectedBrokerName(both), 'Zerodha');
});

test('broker ids are validated against the canonical list', () => {
  assert.equal(isValidBroker('groww'), true);
  assert.equal(isValidBroker('robinhood'), false);
  assert.equal(isValidBroker(undefined), false);
  assert.deepEqual(
    BROKER_INFO.map(b => b.id),
    ALL_BROKERS,
  );
});
