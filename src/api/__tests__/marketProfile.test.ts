import assert from 'node:assert/strict';
import {test} from 'node:test';

import {profileInstrumentKey} from '../../market/profileView.ts';
import {queryKeys} from '../../queryKeys.ts';
import type {ProfileInstrument} from '../../types/marketProfile.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

const stock: ProfileInstrument = {symbol: 'M&M'};
const future: ProfileInstrument = {underlying: 'NIFTY', month: '2026-10'};

test('a stock is asked for by symbol and a future by underlying and month, the session only when named', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getMarketProfile(stock);
  await api.getMarketProfile(stock, '2026-09-30');
  await api.getMarketProfile(future);
  await api.getMarketProfile(future, '2026-09-30');
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      ['/market/profile?symbol=M%26M', undefined],
      ['/market/profile?symbol=M%26M&session=2026-09-30', undefined],
      ['/market/profile?underlying=NIFTY&month=2026-10', undefined],
      [
        '/market/profile?underlying=NIFTY&month=2026-10&session=2026-09-30',
        undefined,
      ],
    ],
  );
});

test('the answer is handed back as served', async () => {
  const body = {symbol: 'TCS', session: '2026-10-01', screens: []};
  const {http} = fakeHttp([body]);
  assert.equal(await marketApi(http).getMarketProfile({symbol: 'TCS'}), body);
});

test('an instrument with no profile fails rather than reading as empty', async () => {
  const noBars = new Error('no bars for this session');
  const api = marketApi({request: () => Promise.reject(noBars)});
  await assert.rejects(api.getMarketProfile({symbol: 'GOLD'}), noBars);
});

test('a profile keys by instrument and session, the newest session as null', () => {
  assert.deepEqual(
    queryKeys.market.profile(profileInstrumentKey(stock), null),
    ['market-profile', 'M&M', null],
  );
  assert.deepEqual(
    queryKeys.market.profile(profileInstrumentKey(future), '2026-09-30'),
    ['market-profile', 'NIFTY:2026-10', '2026-09-30'],
  );
  // Nothing to ask about yet: the key a disabled query sits under.
  assert.deepEqual(queryKeys.market.profile(null, null), [
    'market-profile',
    null,
    null,
  ]);
});
