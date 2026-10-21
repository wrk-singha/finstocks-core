import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  ALERT_CHANNELS,
  ALERT_SCOPES,
  alertScopeForChannel,
  defaultAlertPreferences,
  withAlertsEnabled,
} from '../alertChannels.ts';

test('every channel resolves back to the scope that lists it', () => {
  for (const scope of ALERT_SCOPES) {
    for (const channel of ALERT_CHANNELS[scope]) {
      assert.equal(alertScopeForChannel(channel.id), scope);
    }
  }
  assert.equal(alertScopeForChannel('not_a_channel'), null);
});

test('channel ids are unique across scopes', () => {
  const ids = ALERT_SCOPES.flatMap(scope =>
    ALERT_CHANNELS[scope].map(c => c.id),
  );
  assert.equal(new Set(ids).size, ids.length);
});

test('defaults are opt-in with only the intraday channels pre-selected', () => {
  const stocks = defaultAlertPreferences('stocks');
  assert.equal(stocks.enabled, false);
  assert.deepEqual(stocks.channels, {
    stocks_intraday: true,
    stocks_swing: false,
    strategies_intraday: true,
    strategies_swing: false,
  });

  const fno = defaultAlertPreferences('fno');
  assert.equal(fno.enabled, false);
  assert.deepEqual(fno.channels, {
    fno_intraday: true,
    fno_positional: false,
    fno_expiry: false,
    fno_exits: true,
  });

  const baskets = defaultAlertPreferences('baskets');
  assert.equal(baskets.enabled, false);
  assert.deepEqual(baskets.channels, {basket_rebalances: true});
  assert.equal(alertScopeForChannel('basket_rebalances'), 'baskets');
});

test('turning the master on with nothing chosen subscribes to the defaults; otherwise it keeps the set', () => {
  const silent = {enabled: false, channels: {basket_rebalances: false}};
  assert.deepEqual(withAlertsEnabled('baskets', silent, true), {
    enabled: true,
    channels: {basket_rebalances: true},
  });
  const chosen = {
    enabled: false,
    channels: {stocks_intraday: false, stocks_swing: true},
  };
  assert.deepEqual(withAlertsEnabled('stocks', chosen, true), {
    ...chosen,
    enabled: true,
  });
  assert.deepEqual(
    withAlertsEnabled('stocks', {...chosen, enabled: true}, false),
    chosen,
  );
});
