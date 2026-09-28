import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {GetOwnershipResponse} from '../../types/ownership.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

const REGISTER: GetOwnershipResponse = {
  deals: [
    {
      date: '2026-09-04',
      source: 'block',
      name: 'Kaveri Capital',
      deal_type: 'BUY',
      volume: 1_250_000,
      price: 1282.4,
    },
  ],
  insider: [
    {
      date: '2026-08-21',
      trader: 'Anita Rao',
      trans_type: 'Market Purchase',
      quantity: 12_000,
      is_buy: true,
      holding_percent: 0.02,
    },
  ],
  top_holders: [
    {
      name: 'Aranya Commercials LLP',
      category: 'Promoter',
      percentage: 10.44,
      shares: 1_412_740_800,
      pledge_pct: 0,
    },
  ],
  holders_as_of: '2026-06-30',
};

test('the register is asked by symbol and passes through as served', async () => {
  const {http, last} = fakeHttp([REGISTER]);
  assert.deepEqual(await marketApi(http).getOwnership('M&M'), REGISTER);
  assert.equal(last().path, '/news/ownership?symbol=M%26M');
});

test('a list the server leaves null or out arrives empty, and so does a missing register date', async () => {
  const {http} = fakeHttp([
    {deals: null, insider: null, top_holders: null, holders_as_of: null},
    {top_holders: REGISTER.top_holders},
    null,
  ]);
  const api = marketApi(http);
  const empty: GetOwnershipResponse = {
    deals: [],
    insider: [],
    top_holders: [],
    holders_as_of: '',
  };
  assert.deepEqual(await api.getOwnership('RELIANCE'), empty);
  assert.deepEqual(await api.getOwnership('RELIANCE'), {
    ...empty,
    top_holders: REGISTER.top_holders,
  });
  assert.deepEqual(await api.getOwnership('RELIANCE'), empty);
});

test('the register key is one entry per symbol, as web keys it', () => {
  assert.deepEqual(queryKeys.ownership('RELIANCE'), ['ownership', 'RELIANCE']);
  assert.deepEqual(queryKeys.ownership(null), ['ownership', '']);
});
