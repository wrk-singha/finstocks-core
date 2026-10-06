import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  futureExpiries,
  graphDataPaths,
  normalizeOrderType,
  ohlcvStreamPath,
  parseGraphData,
  premiumStreamPath,
  tradingApi,
} from '../trading.ts';
import {queryKeys} from '../../queryKeys.ts';
import {fakeHttp} from './fakeHttp.ts';

test('orders carry the idempotency key and a normalised order_type', async () => {
  const {http, calls} = fakeHttp();
  const api = tradingApi(http);
  await api.buyStock(
    {
      stock_symbol: 'TCS',
      isMock: true,
      market: 'IN',
      quantity: 1,
      order_type: 'limit',
      trigger_price: 10,
    },
    'k1',
  );
  await api.sellStock(
    {stock_symbol: 'TCS', isMock: false, market: 'IN', order_type: 'Market'},
    'k2',
  );
  assert.equal(calls[0]?.path, '/trading/buy');
  assert.equal(calls[0]?.init?.method, 'POST');
  assert.equal(calls[0]?.init?.idempotencyKey, 'k1');
  assert.deepEqual(calls[0]?.init?.body, {
    stock_symbol: 'TCS',
    isMock: true,
    market: 'IN',
    quantity: 1,
    order_type: 'LIMIT',
    trigger_price: 10,
  });
  assert.equal(calls[1]?.path, '/trading/sell');
  assert.equal(calls[1]?.init?.idempotencyKey, 'k2');
  assert.equal(
    (calls[1]?.init?.body as {order_type: string}).order_type,
    'MARKET',
  );
  assert.equal(normalizeOrderType(' limit '), 'LIMIT');
  assert.equal(normalizeOrderType('anything'), 'MARKET');
});

test('strategy lifecycle endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = tradingApi(http);
  const backtest = {symbol: 'TCS', timeframe: '1d', original_query: 'q'};
  await api.createBacktest(backtest, 'k1');
  await api.createBacktestBatch({variants: [backtest], message_id: 'm'}, 'k2');
  await api.strategyAction(
    {...backtest, action: 'deploy', script: 'code', script_hash: 'h'},
    'k6',
  );
  await api.stopStrategy('s1');
  await api.updateStrategyStatus('s1', 'PAUSED');
  await api.redeployStrategy('s1', {original_query: 'q2'}, 'k3');
  await api.updateStrategyFsm('s1', {} as never, {timeframe: '5m'}, 'k4');
  await api.activateAutopilot({investment_amount: 1000, is_mock: true}, 'k5');
  await api.deactivateAutopilot();
  await api.stopTrade();
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.idempotencyKey]),
    [
      ['/trading/create-backtest', 'POST', 'k1'],
      ['/trading/create-backtest-batch', 'POST', 'k2'],
      ['/trading/strategy-action', 'POST', 'k6'],
      ['/trading/stop-strategy', 'PUT', undefined],
      ['/trading/update-strategy', 'PUT', undefined],
      ['/trading/switch-strategy', 'PUT', 'k3'],
      ['/trading/update-fsm', 'PUT', 'k4'],
      ['/trading/activate-autopilot', 'POST', 'k5'],
      ['/trading/deactivate-autopilot', 'POST', undefined],
      ['/trading/stop-trade', 'POST', undefined],
    ],
  );
  assert.deepEqual(calls[4]?.init?.body, {strategy_id: 's1', status: 'PAUSED'});
  assert.deepEqual(calls[5]?.init?.body, {
    strategy_id: 's1',
    original_query: 'q2',
  });
  assert.deepEqual(calls[6]?.init?.body, {
    strategy_id: 's1',
    fsm: {},
    timeframe: '5m',
  });
});

test('reads build the same query strings both apps sent', async () => {
  const {http, calls} = fakeHttp();
  const api = tradingApi(http);
  await api.isAlive(true);
  await api.isAlive(false, true);
  await api.getLogs('IN');
  await api.getLogs('IN', ['a', 'b']);
  await api.markStrategyResultsViewed('IN', ['a']);
  await api.getPortfolioAnalysis(true);
  await api.getPortfolioAnalysis(false, true, 'fno');
  await api.getBacktestAnalysis('s1', ['p1', 'p2']);
  await api.getFnoChainFallback('NIFTY', '2030-01-01');
  await api.getFnoExpiries('BANKNIFTY');
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/trading/is-alive?model=2&mock=true',
      '/trading/is-alive?model=2&mock=false&rules=1',
      '/trading/get-logs?market=IN',
      '/trading/get-logs?market=IN&strategy_id=a&strategy_id=b',
      '/trading/get-logs?market=IN&viewed=1&strategy_id=a',
      '/trading/portfolio-analysis?is_mock=true&force_refresh=false',
      '/trading/portfolio-analysis?is_mock=false&force_refresh=true&segment=fno',
      '/trading/backtest-analysis?strategy_id=s1&peer_ids=p1%2Cp2',
      '/trading/fno/chain-fallback?underlying=NIFTY&expiry=2030-01-01',
      '/trading/fno/expiries?underlying=BANKNIFTY',
    ],
  );
  for (const call of calls) assert.equal(call.init?.method, undefined);
});

test('markStrategyResultsViewed is a no-op without ids and swallows failures', async () => {
  const {calls} = fakeHttp();
  const failing = tradingApi({
    request: () => Promise.reject(new Error('down')),
  });
  assert.equal(await failing.markStrategyResultsViewed('IN', ['a']), null);
  const {http} = fakeHttp();
  assert.equal(
    await tradingApi(http).markStrategyResultsViewed('IN', []),
    null,
  );
  assert.equal(calls.length, 0);
});

test('sync, delete and share endpoints', async () => {
  const {http, calls} = fakeHttp();
  const api = tradingApi(http);
  await api.deleteTrade('t1');
  await api.resolveSyncConflict('u1');
  await api.createSharePortfolio();
  await api.getSharedPortfolio('uuid');
  await api.refreshWallet();
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body, c.init?.anonymous]),
    [
      ['/trading/transaction/t1', 'DELETE', undefined, undefined],
      ['/trading/sync-tx', 'PUT', {uuid: 'u1'}, undefined],
      ['/share/portfolio', 'POST', undefined, undefined],
      ['/share/portfolio/uuid', undefined, undefined, true],
      ['/trading/wallet/refresh', 'POST', undefined, undefined],
    ],
  );
});

test('expiries already past are dropped', () => {
  assert.deepEqual(futureExpiries(['2020-01-01', '2030-01-01'], '2026-09-13'), [
    '2030-01-01',
  ]);
  assert.deepEqual(futureExpiries(undefined), []);
});

test('graph-data paths batch, filter placeholders and switch to the share route', () => {
  assert.deepEqual(
    graphDataPaths({symbols: ['CUSTOM_LIST', ''], market: 'IN'}),
    [],
  );
  assert.deepEqual(
    graphDataPaths({
      symbols: ['TCS', 'NIFTY 50'],
      market: 'IN',
      includeVolume: true,
      isCompare: true,
    }),
    [
      '/trading/graph-data?symbols=TCS&symbols=NIFTY%2050&market=IN&period=1d&interval=1m&isCompare=true&include_volume=1',
    ],
  );
  assert.deepEqual(
    graphDataPaths({
      symbols: ['TCS', 'NIFTY26SEP24000CE'],
      market: 'IN',
      period: '1w',
      interval: '1d',
      hmacToken: 'h/1',
      maxPoints: 72,
      closeOnly: true,
      fnoSymbols: ['NIFTY26SEP24000CE'],
    }),
    [
      '/share/graph-data?hmacToken=h%2F1&symbols=TCS&symbols=NIFTY26SEP24000CE&market=IN&period=1w&interval=1d&max_points=72&close_only=1&fno_symbols=NIFTY26SEP24000CE',
    ],
  );
  const many = Array.from({length: 30}, (_, i) => `S${i}`);
  assert.equal(graphDataPaths({symbols: many, market: 'IN'}).length, 2);
});

test('getGraphData merges batches through parseGraphData', async () => {
  const series = {
    t: ['2026-01-01T09:15'],
    o: [1],
    h: [2],
    l: [0.5],
    c: [1.5],
    ac: [0.5],
    rc: [0.5],
    v: [10],
  };
  const {http, calls} = fakeHttp([
    {data: {data: {TCS: series}}},
    {INFY: [{time: 'x', open: 1, high: 1, low: 1, close: 1}]},
  ]);
  const many = Array.from({length: 27}, (_, i) => `S${i}`);
  const out = await tradingApi(http).getGraphData({
    symbols: many,
    market: 'IN',
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(out.TCS, [
    {
      time: '2026-01-01T09:15',
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      absolute_change: 0.5,
      relative_change: 0.5,
      volume: 10,
    },
  ]);
  assert.equal(out.INFY?.length, 1);
  assert.deepEqual(parseGraphData(null), {});
  assert.deepEqual(
    parseGraphData({data: {TCS: {t: ['a'], c: [1]}}}).TCS?.[0]?.close,
    1,
  );
});

test('web-only reads', async () => {
  const {http, calls} = fakeHttp([
    {},
    {TCS: {close: 1, open: 1}},
    {underlyings: [{symbol: 'NIFTY', lotSize: 25, nearestExpiry: 'x'}]},
  ]);
  const api = tradingApi(http);
  await api.getAutopilotLogs('IN');
  await api.getLastPrices(['TCS', 'A B']);
  const idx = await api.getFnoIndexUnderlyings();
  assert.equal(calls[0]?.path, '/trading/autopilot-logs?market=IN');
  assert.equal(
    calls[1]?.path,
    '/trading/last-prices?symbols=TCS&symbols=A%20B',
  );
  assert.equal(calls[2]?.path, '/trading/fno/index-underlyings');
  assert.equal(idx[0]?.symbol, 'NIFTY');
});

test('the index underlyings list is one cache entry for both apps', async () => {
  assert.deepEqual(queryKeys.fno.indexUnderlyings(), ['fno-index-underlyings']);
  const {http} = fakeHttp([{}]);
  assert.deepEqual(await tradingApi(http).getFnoIndexUnderlyings(), []);
});

test('stream paths are relative to the API root and encode their params', () => {
  assert.equal(
    ohlcvStreamPath(['NIFTY 50', 'TCS']),
    '/trading/ohlcv/stream?symbols=NIFTY%2050%2CTCS',
  );
  assert.equal(ohlcvStreamPath([]), '/trading/ohlcv/stream?symbols=');
  assert.equal(premiumStreamPath('NIFTY'), '/fno/stream?underlying=NIFTY');
  assert.equal(premiumStreamPath('M&M'), '/fno/stream?underlying=M%26M');
  // The picked expiry rides along; none leaves the server on its nearest.
  assert.equal(
    premiumStreamPath('NIFTY', '2026-10-13'),
    '/fno/stream?underlying=NIFTY&expiry=2026-10-13',
  );
  assert.equal(
    premiumStreamPath('NIFTY', undefined),
    '/fno/stream?underlying=NIFTY',
  );
});

test('isAlive hands back rows with the fields the backend dropped filled in', async () => {
  const api = tradingApi({
    request: <T>() =>
      Promise.resolve({
        message: false,
        key: 'IN',
        is_mock: true,
        strategies: [
          {
            strategy_id: 's1',
            is_mock: true,
            created_at: '2026-07-07T12:00:00Z',
            budget_config: null,
            indicators: [],
          },
        ],
      } as T),
  });
  const [row] = (await api.isAlive(true)).strategies;
  assert.equal(row?.symbol, '');
  assert.equal(row?.original_query, '');
  assert.equal(row?.is_backtest, false);
  assert.equal(row?.budget_config, null);
});
