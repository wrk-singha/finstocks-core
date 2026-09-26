import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {HttpClient} from '../http.ts';
import {depthStreamPath, marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

test('market reads build their query strings', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getRecommendations();
  await api.getRecommendations({horizon: 'swing', status: 'open'});
  await api.getMarketDepth('TCS');
  await api.getScore('TCS');
  await api.getScreenerStocks();
  await api.getScreenerStocks({
    rsi_min: '40',
    interval: '1d',
    price_min: '100',
    ind: 'ema20:1:2',
  });
  await api.getScreenerIndicators('5m');
  await api.getFnoIdeas('NIFTY');
  await api.getFnoTrackRecord();
  await api.getInstitutionalFlows(7, 'FII');
  await api.getIPOList();
  await api.getNPSNAV(3, 90);
  await api.getFunds();
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/market/recommendations',
      '/market/recommendations?horizon=swing&status=open',
      '/market/depth?symbol=TCS',
      '/market/score?symbol=TCS',
      '/market/screener',
      '/market/screener?rsi_min=40&interval=1d&price_min=100&ind=ema20%3A1%3A2',
      '/market/screener/indicators?interval=5m',
      '/market/fno/ideas?underlying=NIFTY',
      '/market/fno/track-record?window=all',
      '/market/institutional-flows?days=7&source=FII',
      '/market/ipos?status=all&limit=50',
      '/market/nps/nav?fund_id=3&days=90',
      '/market/funds',
    ],
  );
});

test('news-prefixed reads repeat symbol params', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getNewsFeed({section: 'markets', limit: 20, offset: 40});
  await api.getDividends();
  await api.getFundamentals(['ACE', 'ESCORTS'], 'IN', 'summary');
  await api.getTechnicals({stocks: ['TCS'], market: 'IN', interval: '1d'});
  await api.getStockEvents({
    from: '2026-01-01',
    category: ['results', 'dividend'],
    symbol: ['TCS'],
  });
  await api.getStockEvents({});
  await api.getOwnership('M&M');
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/feed?section=markets&limit=20&offset=40',
      '/news/dividends?market=IN',
      '/news/fundamentals?symbols=ACE&symbols=ESCORTS&market=IN&fields=summary',
      '/news/technicals?symbols=TCS&market=IN&interval=1d',
      '/news/stock-events?from=2026-01-01&category=results&category=dividend&symbol=TCS',
      '/news/stock-events',
      '/news/ownership?symbol=M%26M',
    ],
  );
});

test('market mutations', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.followBasket('k1');
  await api.unfollowBasket();
  await api.scanPatterns({patterns: ['doji']} as never);
  await api.detectPatterns({symbol: 'TCS', interval: '1d'});
  assert.deepEqual(
    calls.map(c => [
      c.path,
      c.init?.method,
      c.init?.body,
      c.init?.idempotencyKey,
    ]),
    [
      ['/market/basket/follow', 'POST', undefined, 'k1'],
      ['/market/basket/follow', 'DELETE', undefined, undefined],
      ['/market/pattern-scan', 'POST', {patterns: ['doji']}, undefined],
      [
        '/news/pattern-detect',
        'POST',
        {symbol: 'TCS', interval: '1d'},
        undefined,
      ],
    ],
  );
});

test('the depth stream path is relative to the API root', () => {
  assert.equal(depthStreamPath('TCS'), '/market/depth/stream?symbol=TCS');
  assert.equal(
    depthStreamPath('NIFTY 50'),
    '/market/depth/stream?symbol=NIFTY%2050',
  );
  assert.equal(depthStreamPath('M&M'), '/market/depth/stream?symbol=M%26M');
});

test('the reports fill in monthly_returns when the server leaves it out', async () => {
  const months = [{month: '2026-09', pnl: 1900, trades: 2}];
  const {http} = fakeHttp([
    {hit_count: 1, closed_trades: []},
    {hit_count: 1, closed_trades: [], monthly_returns: null},
    {hit_count: 2, closed_trades: [], monthly_returns: months},
  ]);
  const api = marketApi(http);
  assert.deepEqual((await api.getRecommendationReport()).monthly_returns, []);
  assert.deepEqual((await api.getStrategyReport()).monthly_returns, []);
  assert.deepEqual(
    (await api.getRecommendationReport()).monthly_returns,
    months,
  );
});

const detail = (fields: Record<string, unknown> = {}) => ({
  symbol: 'RELIANCE',
  company_name: 'Reliance Industries',
  format: {financials: 'MFG'},
  sections: ['ownership'],
  ...fields,
});

/** A host whose every request rejects the way its transport would. */
const rejecting = (error: Error): HttpClient => ({
  request: () => Promise.reject(error),
});

test('the fundamentals detail asks for its sections, basis and depth, and a limit only when given', async () => {
  const {http, calls} = fakeHttp([detail(), detail(), detail()]);
  const api = marketApi(http);
  await api.getFundamentalsDetail('RELIANCE', ['statements', 'quarterly']);
  await api.getFundamentalsDetail('M&M', ['ownership'], 'S', 8);
  await api.getFundamentalsDetail('RELIANCE', ['documents'], 'C', 0, 50);
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/fundamentals/detail?symbol=RELIANCE&sections=statements%2Cquarterly&basis=C&periods=5',
      '/news/fundamentals/detail?symbol=M%26M&sections=ownership&basis=S&periods=8',
      '/news/fundamentals/detail?symbol=RELIANCE&sections=documents&basis=C&periods=0&limit=50',
    ],
  );
});

test('a company with nothing on file is null, not a failure', async () => {
  // Mobile's ApiError carries the status itself; an axios error nests it in the response.
  const notFound = Object.assign(new Error('Not Found'), {status: 404});
  const axiosNotFound = Object.assign(new Error('Request failed'), {
    response: {status: 404},
  });
  for (const error of [notFound, axiosNotFound]) {
    assert.equal(
      await marketApi(rejecting(error)).getFundamentalsDetail('ZZZ', [
        'statements',
      ]),
      null,
    );
  }
});

test('every other failure of the fundamentals detail throws, so it is never cached as empty', async () => {
  const upstream = Object.assign(new Error('Bad Gateway'), {status: 502});
  const offline = Object.assign(new Error('Network request failed'), {
    status: 0,
  });
  for (const error of [upstream, offline, new Error('boom')]) {
    await assert.rejects(
      marketApi(rejecting(error)).getFundamentalsDetail('RELIANCE', [
        'ownership',
      ]),
      error,
    );
  }
});

test('a null shareholding category list arrives as an empty one', async () => {
  const quarters = [202606];
  const {http} = fakeHttp([
    detail({ownership: {quarters, categories: null}}),
    detail({ownership: {quarters, categories: [{code: 'GrandTotal'}]}}),
    detail({deliverables: []}),
  ]);
  const api = marketApi(http);
  assert.deepEqual(
    (await api.getFundamentalsDetail('RELIANCE', ['ownership']))?.ownership,
    {quarters, categories: []},
  );
  assert.deepEqual(
    (await api.getFundamentalsDetail('RELIANCE', ['ownership']))?.ownership,
    {quarters, categories: [{code: 'GrandTotal'}]},
  );
  const deliveries = await api.getFundamentalsDetail('RELIANCE', [
    'deliverables',
  ]);
  assert.equal(deliveries !== null && 'ownership' in deliveries, false);
  assert.deepEqual(deliveries?.deliverables, []);
});

test('the fundamentals detail key is one entry per section set, whatever the order', () => {
  assert.deepEqual(
    queryKeys.fundamentalsDetail(
      'RELIANCE',
      ['statements', 'ownership'],
      'C',
      5,
    ),
    [
      'fundamentals-detail',
      'RELIANCE',
      'ownership,statements',
      'C',
      5,
      undefined,
    ],
  );
  assert.deepEqual(
    queryKeys.fundamentalsDetail(
      'RELIANCE',
      ['ownership', 'statements'],
      'C',
      5,
    ),
    queryKeys.fundamentalsDetail(
      'RELIANCE',
      ['statements', 'ownership'],
      'C',
      5,
    ),
  );
  assert.deepEqual(
    queryKeys.fundamentalsDetail('RELIANCE', ['documents'], 'S', 0, 50),
    ['fundamentals-detail', 'RELIANCE', 'documents', 'S', 0, 50],
  );
});
