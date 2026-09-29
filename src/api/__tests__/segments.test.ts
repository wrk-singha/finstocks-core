import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {SegmentsResponse} from '../../types/segments.ts';
import type {HttpClient} from '../http.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

const NOTE: SegmentsResponse = {
  symbol: 'RELIANCE',
  fincode: 100_325,
  basis: 'C',
  basis_available: ['C'],
  period: 'annual',
  period_available: ['annual', 'quarterly'],
  periods: [202503, 202603],
  segments: [
    {
      name: 'Retail',
      key: 'retail',
      is_unallocated: false,
      is_intersegment: false,
      revenue: [306_800, 330_000],
      result: [25_800, 28_000],
      capital_employed: [210_000, 230_000],
    },
  ],
  filings: [
    {
      period: 202603,
      url: 'https://www.example.com/filings/reliance/results-202603.xml',
      source: 'xbrl',
      derived: false,
      reconciles: true,
    },
  ],
};

/** A host whose every request rejects the way its transport would. */
const rejecting = (error: Error): HttpClient => ({
  request: () => Promise.reject(error),
});

test('the segment note is asked by symbol, basis and frequency, and passes through as served', async () => {
  const {http, calls} = fakeHttp([NOTE, NOTE]);
  const api = marketApi(http);
  assert.deepEqual(await api.getSegments('RELIANCE', 'C', 'annual'), NOTE);
  await api.getSegments('M&M', 'S', 'quarterly');
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/segments?symbol=RELIANCE&basis=C&period=annual',
      '/news/segments?symbol=M%26M&basis=S&period=quarterly',
    ],
  );
});

test('a company with no segment note is null, not a failure', async () => {
  // Mobile's ApiError carries the status itself; an axios error nests it in the response.
  const notFound = Object.assign(new Error('Not Found'), {status: 404});
  const axiosNotFound = Object.assign(new Error('Request failed'), {
    response: {status: 404},
  });
  for (const error of [notFound, axiosNotFound]) {
    assert.equal(
      await marketApi(rejecting(error)).getSegments('ZZZ', 'C', 'annual'),
      null,
    );
  }
});

test('every other failure throws, so a blip is never cached as no segments', async () => {
  const upstream = Object.assign(new Error('Bad Gateway'), {status: 502});
  const offline = Object.assign(new Error('Network request failed'), {
    status: 0,
  });
  for (const error of [upstream, offline, new Error('boom')]) {
    await assert.rejects(
      marketApi(rejecting(error)).getSegments('RELIANCE', 'C', 'quarterly'),
      error,
    );
  }
});

test('the lists Go leaves null arrive empty, down to a segment series', async () => {
  const {http} = fakeHttp([
    {
      ...NOTE,
      basis_available: null,
      period_available: null,
      periods: null,
      segments: null,
      filings: null,
    },
    {
      ...NOTE,
      segments: [
        {
          name: 'Retail',
          key: 'retail',
          is_unallocated: false,
          is_intersegment: false,
          revenue: null,
          result: [25_800, 28_000],
          capital_employed: null,
        },
      ],
    },
  ]);
  const api = marketApi(http);
  assert.deepEqual(await api.getSegments('RELIANCE', 'C', 'annual'), {
    ...NOTE,
    basis_available: [],
    period_available: [],
    periods: [],
    segments: [],
    filings: [],
  });
  assert.deepEqual(
    (await api.getSegments('RELIANCE', 'C', 'annual'))?.segments,
    [
      {
        name: 'Retail',
        key: 'retail',
        is_unallocated: false,
        is_intersegment: false,
        revenue: [],
        result: [25_800, 28_000],
        capital_employed: [],
      },
    ],
  );
});

test('the segment key is the question asked, one entry per basis and frequency', () => {
  assert.deepEqual(queryKeys.segments('RELIANCE', 'S', 'quarterly'), [
    'segments',
    'RELIANCE',
    'S',
    'quarterly',
  ]);
  assert.notDeepEqual(
    queryKeys.segments('RELIANCE', 'C', 'annual'),
    queryKeys.segments('RELIANCE', 'C', 'quarterly'),
  );
});
