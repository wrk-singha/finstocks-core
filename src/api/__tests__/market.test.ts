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
  await api.getOwnership('M&M');
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/feed?section=markets&limit=20&offset=40',
      '/news/dividends?market=IN',
      '/news/fundamentals?symbols=ACE&symbols=ESCORTS&market=IN&fields=summary',
      '/news/technicals?symbols=TCS&market=IN&interval=1d',
      '/news/ownership?symbol=M%26M',
    ],
  );
});

test('dividends take a stock and an upcoming filter, each sent only when set', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getDividends('IN', {symbol: 'M&M'});
  await api.getDividends('IN', {upcoming: true});
  await api.getDividends('IN', {symbol: '', upcoming: false});
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/news/dividends?market=IN&symbol=M%26M',
      '/news/dividends?market=IN&upcoming=true',
      '/news/dividends?market=IN',
    ],
  );
});

test('one stock’s filings and dividends arrive as empty lists when Go sends null', async () => {
  const {http, calls} = fakeHttp([null, null, null]);
  const api = marketApi(http);
  assert.deepEqual(await api.getAnnouncements({symbol: 'RELIANCE'}), []);
  assert.deepEqual(await api.getCorporateFilings('RELIANCE'), []);
  assert.deepEqual(await api.getDividends('IN', {symbol: 'RELIANCE'}), []);
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/market/announcements?symbol=RELIANCE',
      '/market/corporate-filings?symbol=RELIANCE',
      '/news/dividends?market=IN&symbol=RELIANCE',
    ],
  );
  const filings = [
    {
      news_id: 'n1',
      datetime: '2025-11-14',
      caption: 'Allotment under ESOS',
      details: '',
      attachment_url: '',
      category: 'esop' as const,
    },
  ];
  assert.deepEqual(
    await marketApi(fakeHttp([filings]).http).getCorporateFilings('RELIANCE'),
    filings,
  );
});

test('the dividends key holds the stock and the filter, and one stock’s filings key apart', () => {
  assert.deepEqual(queryKeys.dividends('IN'), ['dividends', 'IN', '', false]);
  assert.deepEqual(queryKeys.dividends('IN', 'RELIANCE'), [
    'dividends',
    'IN',
    'RELIANCE',
    false,
  ]);
  assert.deepEqual(queryKeys.dividends('IN', undefined, true), [
    'dividends',
    'IN',
    '',
    true,
  ]);
  assert.deepEqual(queryKeys.market.corporateFilings('RELIANCE'), [
    'corporate-filings',
    'RELIANCE',
  ]);
  assert.deepEqual(queryKeys.market.symbolAnnouncements('RELIANCE'), [
    'announcements',
    'symbol',
    'RELIANCE',
  ]);
  assert.deepEqual(queryKeys.market.symbolAnnouncements(null), [
    'announcements',
    'symbol',
    '',
  ]);
});

test('stock events are posted, so a long symbol filter never meets a URL limit', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  const symbols = Array.from({length: 1200}, (_, i) => `SYM${String(i)}`);
  const filtered = {
    from: '2026-09-21',
    to: '2026-10-06',
    category: ['reverse_split' as const, 'dividend' as const],
    cap: ['large' as const],
    symbol: symbols,
  };
  await api.getStockEvents(filtered);
  await api.getStockEvents({});
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/news/stock-events', 'POST', filtered],
      ['/news/stock-events', 'POST', {}],
    ],
  );
});

test('the stock-events key holds every filter the request sends', () => {
  assert.deepEqual(queryKeys.market.stockEvents({}), [
    'stock-events',
    '',
    '',
    '',
    '',
    '',
  ]);
  assert.deepEqual(
    queryKeys.market.stockEvents({
      from: '2026-09-21',
      to: '2026-10-06',
      category: ['dividend', 'split'],
      cap: ['mid'],
      symbol: ['RELIANCE', 'TCS'],
    }),
    [
      'stock-events',
      '2026-09-21',
      '2026-10-06',
      'dividend,split',
      'mid',
      'RELIANCE,TCS',
    ],
  );
  assert.notDeepEqual(
    queryKeys.market.stockEvents({category: ['dividend']}),
    queryKeys.market.stockEvents({cap: ['large']}),
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

test('null delivery rows and documents lists arrive as empty ones', async () => {
  const {http} = fakeHttp([
    detail({deliverables: null}),
    detail({
      documents: {
        announcements: null,
        annual_reports: [],
        credit_ratings: null,
        concalls: null,
      },
    }),
    detail({documents: null}),
  ]);
  const api = marketApi(http);
  assert.deepEqual(
    (await api.getFundamentalsDetail('RELIANCE', ['deliverables']))
      ?.deliverables,
    [],
  );
  assert.deepEqual(
    (await api.getFundamentalsDetail('RELIANCE', ['documents']))?.documents,
    {announcements: [], annual_reports: [], credit_ratings: [], concalls: []},
  );
  const nothingOnFile = await api.getFundamentalsDetail('RELIANCE', [
    'documents',
  ]);
  assert.equal(nothingOnFile !== null && 'documents' in nothingOnFile, false);
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

test('a screen run is posted with three minutes to build a cold universe', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  const request = {
    universes: ['nifty50'],
    symbols: [],
    industries: ['financial-services'],
    filters: [{field: 'roe', min: 15}],
    columns: ['pe'],
  };
  await api.getScreenCatalog();
  await api.runScreen(request);
  await api.getIndustryTree();
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body, c.init?.timeoutMs]),
    [
      ['/news/screen/fields', undefined, undefined, undefined],
      ['/news/screen', 'POST', request, 180_000],
      ['/news/industries', undefined, undefined, undefined],
    ],
  );
  assert.deepEqual(queryKeys.screen.catalog(), ['screen', 'catalog']);
  assert.deepEqual(queryKeys.screen.run(request), ['screen', 'run', request]);
  assert.deepEqual(queryKeys.industries.tree(), ['industries', 'tree']);
});

const aiRequest = {
  symbol: 'RELIANCE',
  interval: '1d',
  bars: [{t: 1_758_672_000, o: 1270, h: 1284, l: 1266, c: 1280, v: 900_000}],
  last_bar_forming: true,
};

test('AI signals post the chart’s bars and are keyed on its closed ones', async () => {
  const {http, last} = fakeHttp([
    {symbol: 'RELIANCE', signals: [], pivots: [], standard_pivots: null},
  ]);
  await marketApi(http).postAISignals(aiRequest);
  assert.deepEqual(
    [last().path, last().init?.method, last().init?.body],
    ['/market/ai-signals', 'POST', aiRequest],
  );
  assert.deepEqual(queryKeys.market.aiSignals('RELIANCE', '1D', '30:1:30'), [
    'ai-signals',
    'RELIANCE',
    '1D',
    '30:1:30',
  ]);
});

test('an AI signals answer with null lists arrives with empty ones', async () => {
  const {http} = fakeHttp([
    {symbol: 'RELIANCE', signals: null, pivots: null, standard_pivots: null},
    {
      symbol: 'RELIANCE',
      signals: [
        {
          key: 'a',
          gates_passed: ['G1_MIN_PIVOTS'],
          gates_failed: null,
          points: null,
          lines: null,
        },
      ],
      pivots: [{time: 1, kind: 'H', price: 10, confirmed: true}],
      standard_pivots: null,
    },
  ]);
  const api = marketApi(http);
  const empty = await api.postAISignals(aiRequest);
  assert.deepEqual([empty.signals, empty.pivots], [[], []]);
  const filled = await api.postAISignals(aiRequest);
  assert.deepEqual(filled.signals[0], {
    key: 'a',
    gates_passed: ['G1_MIN_PIVOTS'],
    gates_failed: [],
    points: [],
    lines: {},
  });
  assert.equal(filled.pivots.length, 1);
});

const doji = {
  id: 'doji',
  label: 'Doji',
  sense: 'neutral',
  kind: 'reversal',
  family: 'candlestick' as const,
  bars: 1,
  meaning: 'Open and close almost equal: indecision.',
  aliases: ['doji star'],
};

test('the pattern vocabulary is read once from its own path, and keyed alone', async () => {
  const {http, last} = fakeHttp([{patterns: [doji]}]);
  const vocab = await marketApi(http).getPatternVocab();
  assert.deepEqual(
    [last().path, last().init?.method, last().init?.body],
    ['/market/patterns', undefined, undefined],
  );
  assert.deepEqual(vocab, {patterns: [doji]});
  assert.deepEqual(queryKeys.market.patternVocab(), ['pattern-vocab']);
});

test('a vocabulary with null lists arrives with empty ones', async () => {
  const {http} = fakeHttp([
    {patterns: null},
    null,
    {patterns: [{...doji, aliases: null}]},
  ]);
  const api = marketApi(http);
  assert.deepEqual(await api.getPatternVocab(), {patterns: []});
  assert.deepEqual(await api.getPatternVocab(), {patterns: []});
  assert.deepEqual(await api.getPatternVocab(), {
    patterns: [{...doji, aliases: []}],
  });
});

test('the RS sector matrix and one pair, the box only when given', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getRsSectorMatrix();
  await api.getRsSectorMatrix(0.5);
  await api.getRsSectorPair('NIFTYIT', 'NIFTY');
  await api.getRsSectorPair('NIFTYIT', 'NIFTY', 1);
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/market/rs-sector-matrix',
      '/market/rs-sector-matrix?box=0.5',
      '/market/rs-sector-matrix/pair?row=NIFTYIT&col=NIFTY',
      '/market/rs-sector-matrix/pair?box=1&row=NIFTYIT&col=NIFTY',
    ],
  );
});

test('the options regime reads: a missing date asks for the newest day', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getRegimeSnapshot();
  await api.getRegimeSnapshot('2026-10-06');
  await api.getRegimeSentiment();
  await api.getRegimeSentiment('2026-10-01');
  await api.getRegimeDates();
  await api.getRegimeDetail('NIFTY');
  await api.getRegimeDetail('M&M', '2026-10-06');
  await api.getRegimeMe();
  await api.getRegimeSymbols();
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/market/regimepulse/snapshot',
      '/market/regimepulse/snapshot?date=2026-10-06',
      '/market/regimepulse/sentiment',
      '/market/regimepulse/sentiment?date=2026-10-01',
      '/market/regimepulse/dates',
      '/market/regimepulse/detail?symbol=NIFTY',
      '/market/regimepulse/detail?symbol=M%26M&date=2026-10-06',
      '/market/regimepulse/me',
      '/market/regimepulse/symbols',
    ],
  );
});

test('the option levels reads: the screen joins its symbols and drops an empty list', async () => {
  const {http, calls} = fakeHttp();
  const api = marketApi(http);
  await api.getFlyoneSnapshot('near');
  await api.getFlyoneSnapshot('next', '2026-10-06');
  await api.getFlyoneScreen({
    where: 'score>0,gex_regime=POS|STRONG_POS',
    universe: 'stock',
    limit: 50,
  });
  await api.getFlyoneScreen({symbols: ['NIFTY', 'M&M'], expiry: 'near'});
  await api.getFlyoneScreen({symbols: []});
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/market/flyone/snapshot?expiry=near',
      '/market/flyone/snapshot?expiry=next&date=2026-10-06',
      '/market/flyone/screen?where=score%3E0%2Cgex_regime%3DPOS%7CSTRONG_POS&universe=stock&limit=50',
      '/market/flyone/screen?expiry=near&symbols=NIFTY%2CM%26M',
      '/market/flyone/screen',
    ],
  );
});
