import assert from 'node:assert/strict';
import {test} from 'node:test';

import {brokersApi} from '../brokers.ts';
import {fakeHttp} from './fakeHttp.ts';

test('broker link endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = brokersApi(http);
  await api.updateZerodha({api_key: 'k'});
  await api.updateGroww({} as never);
  await api.updateDhann({} as never);
  await api.updateUpstox({} as never);
  await api.exchangeUpstoxCode('code');
  await api.disconnect('zerodha');
  await api.reserveIp();
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/update-zerodha', 'POST', {api_key: 'k'}],
      ['/update-groww', 'POST', {}],
      ['/update-dhann', 'POST', {}],
      ['/broker/upstox/connect', 'POST', {}],
      ['/broker/upstox/callback', 'POST', {code: 'code'}],
      ['/disconnect-broker', 'POST', {broker: 'zerodha'}],
      ['/trading/get-ip', undefined, undefined],
    ],
  );
});
