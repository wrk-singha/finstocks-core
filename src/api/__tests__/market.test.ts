import assert from 'node:assert/strict';
import {test} from 'node:test';

import {marketApi} from '../market.ts';
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
