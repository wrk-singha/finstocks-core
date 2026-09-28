import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {RelatedPartyResponse} from '../../types/relatedParty.ts';
import type {HttpClient} from '../http.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

const TABLE: RelatedPartyResponse = {
  symbol: 'RELIANCE',
  company_name: 'Reliance Industries',
  fincode: 100_325,
  basis: 'C',
  columns: [
    {
      key: 'FY26',
      label: 'FY26',
      period_end: 202603,
      months: 12,
      source: 'exchange_rpt',
      experimental: false,
      partial: false,
      sources: [
        {
          period_end: 202509,
          months: 6,
          source: 'exchange_rpt',
          url: 'https://www.example.com/filings/reliance/rpt-2025-09.pdf',
        },
      ],
    },
  ],
  parties: [
    {
      name: 'Aranya Commercials LLP',
      relationship: 'Promoter group',
      total: 1_470,
      values: [1_470],
      txns: [{type: 'Dividend paid', values: [1_470]}],
    },
  ],
  experimental: false,
};

/** A host whose every request rejects the way its transport would. */
const rejecting = (error: Error): HttpClient => ({
  request: () => Promise.reject(error),
});

test('the related-party table is asked by symbol and passes through as served', async () => {
  const {http, last} = fakeHttp([TABLE]);
  assert.deepEqual(await marketApi(http).getRelatedParty('M&M'), TABLE);
  assert.equal(last().path, '/news/related-party?symbol=M%26M');
});

test('no such company is null, and every other failure throws rather than reading as none filed', async () => {
  const notFound = Object.assign(new Error('Not Found'), {status: 404});
  const axiosNotFound = Object.assign(new Error('Request failed'), {
    response: {status: 404},
  });
  for (const error of [notFound, axiosNotFound]) {
    assert.equal(
      await marketApi(rejecting(error)).getRelatedParty('ZZZ'),
      null,
    );
  }
  const upstream = Object.assign(new Error('Bad Gateway'), {status: 502});
  for (const error of [upstream, new Error('boom')]) {
    await assert.rejects(
      marketApi(rejecting(error)).getRelatedParty('RELIANCE'),
      error,
    );
  }
});

test('the lists Go leaves null arrive empty: columns, sources, parties, figures and transactions', async () => {
  const [column] = TABLE.columns;
  const {http} = fakeHttp([
    {...TABLE, columns: null, parties: null},
    {
      ...TABLE,
      columns: [{...column, sources: null}],
      parties: [
        {
          name: 'Anita Rao',
          relationship: 'Key managerial personnel',
          total: 0,
          values: null,
          txns: null,
        },
        {
          name: 'Vistaar Holdings LLP',
          relationship: 'Promoter group',
          total: 12,
          values: [12],
          txns: [{type: 'Rent paid', values: null}],
        },
      ],
    },
  ]);
  const api = marketApi(http);
  assert.deepEqual(await api.getRelatedParty('RELIANCE'), {
    ...TABLE,
    columns: [],
    parties: [],
  });
  const filled = await api.getRelatedParty('RELIANCE');
  assert.deepEqual(filled?.columns[0]?.sources, []);
  assert.deepEqual(filled?.parties, [
    {
      name: 'Anita Rao',
      relationship: 'Key managerial personnel',
      total: 0,
      values: [],
      txns: [],
    },
    {
      name: 'Vistaar Holdings LLP',
      relationship: 'Promoter group',
      total: 12,
      values: [12],
      txns: [{type: 'Rent paid', values: []}],
    },
  ]);
});

test('the related-party key is one entry per company', () => {
  assert.deepEqual(queryKeys.relatedParty('RELIANCE'), [
    'related-party',
    'RELIANCE',
  ]);
});
