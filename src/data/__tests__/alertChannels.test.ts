import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  ALERT_CHANNELS,
  ALERT_SCOPES,
  alertScopeForChannel,
  defaultAlertPreferences,
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
});
