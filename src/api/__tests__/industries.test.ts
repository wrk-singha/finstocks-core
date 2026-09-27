import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

test('the peer column catalogue and the company search read their paths', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getPeerColumnCatalog();
  await api.searchIndustryCompanies('bharat pet');
  assert.deepEqual(
    calls.map(c => [c.path, c.init]),
    [
      ['/news/industries/columns', undefined],
      ['/news/industries/search?q=bharat%20pet', undefined],
    ],
  );
});

test('a peer table sends its columns and symbols comma-joined, and only the params it was given', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getPeerTable({
    symbol: 'RELIANCE',
    columns: ['price', 'pe', 'market_cap'],
    perPage: 10,
  });
  await api.getPeerTable({
    symbols: ['RELIANCE', 'INFY'],
    columns: ['pe', 'roce'],
  });
  await api.getPeerTable({
    node: 'energy/oil-gas-and-consumable-fuels',
    columns: ['pe'],
    sort: 'name',
    order: 'asc',
    page: 2,
    perPage: 25,
  });
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/industries/companies?symbol=RELIANCE&columns=price%2Cpe%2Cmarket_cap&per_page=10',
      '/news/industries/companies?symbols=RELIANCE%2CINFY&columns=pe%2Croce',
      '/news/industries/companies?node=energy%2Foil-gas-and-consumable-fuels&columns=pe&sort=name&order=asc&page=2&per_page=25',
    ],
  );
});

test('the industry keys: the table keys on its whole query, the search on its trimmed lower-case term', () => {
  const request = {symbol: 'RELIANCE', columns: ['pe'], perPage: 10};
  assert.deepEqual(queryKeys.industries.columns(), ['industries', 'columns']);
  assert.deepEqual(queryKeys.industries.table(request), [
    'industries',
    'table',
    request,
  ]);
  assert.deepEqual(queryKeys.industries.search('  Infosys '), [
    'industries',
    'search',
    'infosys',
  ]);
});
