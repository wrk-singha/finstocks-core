import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {EsfScore} from '../../types/esf.ts';
import {esfApi} from '../esf.ts';
import {fakeHttp} from './fakeHttp.ts';

const score: EsfScore = {
  symbol: 'TCS',
  as_of: '2026-10-02',
  universe_size: 850,
  score: 77,
  rank: 12,
  top_pct: 1.4,
  stage: '2A',
  warnings: ['market_not_confirmed'],
  pillars: {earnings: 82, momentum: 74, quality: 68, institutional: 79},
};

test('the score is read from /esf/score by symbol, and handed back as served', async () => {
  const {http, calls} = fakeHttp([score, score]);
  const api = esfApi(http);
  assert.deepEqual(await api.getScore('TCS'), score);
  await api.getScore('M&M');
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      ['/esf/score?symbol=TCS', undefined],
      ['/esf/score?symbol=M%26M', undefined],
    ],
  );
});

test('a symbol the endpoint has no score for fails rather than reading as empty', async () => {
  const notScored = new Error('Not found');
  const api = esfApi({request: () => Promise.reject(notScored)});
  await assert.rejects(api.getScore('NIFTY'), notScored);
});

test('the baskets are read as cards, one basket by its slug, and a backtest by its run id', async () => {
  const {http, calls} = fakeHttp([
    {baskets: []},
    {slug: 'momentum'},
    {run: {}},
  ]);
  const api = esfApi(http);
  assert.deepEqual(await api.getBaskets(), {baskets: []});
  await api.getBasket('momentum');
  await api.getBacktest('trending value/2026', 7);
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      ['/esf/baskets', undefined],
      ['/esf/baskets/momentum', undefined],
      ['/esf/baskets/trending%20value%2F2026/backtests/7', undefined],
    ],
  );
});

test('a subscription is one POST to the basket by its slug, with the mode, the capital and the live consent as given', async () => {
  const {http, calls} = fakeHttp([{id: 7, mode: 'live'}]);
  const api = esfApi(http);
  assert.deepEqual(
    await api.subscribe('trending value/2026', {
      mode: 'live',
      capital: 500000,
      confirm_live: true,
    }),
    {id: 7, mode: 'live'},
  );
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      [
        '/esf/baskets/trending%20value%2F2026/subscriptions',
        {
          method: 'POST',
          body: {mode: 'live', capital: 500000, confirm_live: true},
        },
      ],
    ],
  );
});

test('a paper subscription carries confirm_live false, as the caller set it, and nothing else', async () => {
  const {http, last} = fakeHttp([{}]);
  await esfApi(http).subscribe('momentum', {
    mode: 'mock',
    capital: 70000,
    confirm_live: false,
  });
  assert.deepEqual(last().init?.body, {
    mode: 'mock',
    capital: 70000,
    confirm_live: false,
  });
});

test('pause, resume and cancel are each one PATCH to the subscription by id with the status alone', async () => {
  const {http, calls} = fakeHttp([{}, {}, {}]);
  const api = esfApi(http);
  await api.setSubscriptionStatus(7, 'paused');
  await api.setSubscriptionStatus(7, 'active');
  await api.setSubscriptionStatus(7, 'cancelled');
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      ['/esf/subscriptions/7', {method: 'PATCH', body: {status: 'paused'}}],
      ['/esf/subscriptions/7', {method: 'PATCH', body: {status: 'active'}}],
      ['/esf/subscriptions/7', {method: 'PATCH', body: {status: 'cancelled'}}],
    ],
  );
});

test('a refused subscribe is rethrown as it came, so the caller can read its status and text', async () => {
  const refused = Object.assign(
    new Error('You already subscribe to this basket'),
    {
      status: 409,
    },
  );
  const api = esfApi({request: () => Promise.reject(refused)});
  await assert.rejects(
    api.subscribe('momentum', {
      mode: 'mock',
      capital: 70000,
      confirm_live: false,
    }),
    refused,
  );
});
