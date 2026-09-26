import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {GraphDataPoint} from '../../types/graphData.ts';
import type {MarketNewsItem} from '../../types/market.ts';
import {buildStockSignals} from '../stockSignals.ts';

const day = (i: number, close: number, open = close): GraphDataPoint => ({
  time: new Date(Date.UTC(2026, 7, 1 + i, 10)).toISOString(),
  open,
  close,
  high: Math.max(open, close) + 1,
  low: Math.min(open, close) - 1,
});

// Twenty-one flat sessions at 100, then the session under test.
const history = Array.from({length: 21}, (_, i) => day(i, 100));
const withLast = (last: GraphDataPoint) => [...history, last];

const news = (over: Partial<MarketNewsItem>): MarketNewsItem => ({
  stock_symbol: 'X',
  stock_name: 'X',
  sector: '',
  cmp: null,
  change_pct: null,
  headline: 'Headline',
  confidence_level: 'high',
  direction: null,
  catalyst: null,
  catalyst_type: null,
  net_score: null,
  target_price: null,
  upside_pct: null,
  news_sources: null,
  analysis_date: null,
  ...over,
});

test('a big move, a gap and a breakout fire off the daily bars alone', () => {
  const signals = buildStockSignals({daily: withLast(day(21, 108, 103))});
  const keys = signals.map(s => s.key);
  assert.deepEqual(keys, ['day-move', 'gap', 'breakout']);
  assert.equal(signals[0]?.metric, '+8.00%');
  assert.equal(signals[0]?.tone, 'bullish');
  assert.equal(signals[0]?.metricIsReturn, true);
  assert.equal(signals[2]?.metric, '20-day high');
});

test('a breakout needs a full lookback window', () => {
  const signals = buildStockSignals({daily: [day(0, 100), day(1, 100.5)]});
  assert.equal(signals.length, 0);
});

test('indicator-backed signals: volume, pattern, rsi, trend and macd', () => {
  const signals = buildStockSignals({
    daily: withLast(day(21, 101)),
    indicators: {
      stock_symbol: 'X',
      volume: 3000,
      volume_ma10: 1000,
      rsi14: 74,
      ema200: 90,
      macd_8_21_9: 1,
      macd_signal: 0,
      atr14: 2,
      hammer: true,
      morning_star: true,
    },
  });
  const byKey = Object.fromEntries(signals.map(s => [s.key, s]));
  assert.equal(byKey.volume?.metric, '3.0× average');
  assert.equal(byKey.volume?.tone, 'bullish');
  assert.equal(byKey.pattern?.label, 'Morning star pattern');
  assert.equal(byKey.rsi?.label, 'Overbought on RSI');
  assert.equal(byKey.rsi?.tone, 'bearish');
  assert.equal(byKey.trend?.label, 'Trading above its 200-day average');
  assert.equal(byKey.macd?.label, 'MACD (8,21,9) above its signal line');
  assert.equal(signals.length, 5);
});

test('macd is derived from the legs, so a missing signal leg is no crossover', () => {
  const signals = buildStockSignals({
    daily: withLast(day(21, 101)),
    indicators: {
      stock_symbol: 'X',
      macd_8_21_9: 1,
      macd_histogram: 1,
      atr14: 2,
    },
  });
  assert.equal(
    signals.some(s => s.key === 'macd'),
    false,
  );
});

test('52-week bounds read as at, near, or nothing', () => {
  const near = buildStockSignals({
    daily: [],
    yearHigh: 101,
    yearLow: 90,
    lastPrice: 100,
  });
  assert.equal(near[0]?.label, 'Trading near 52-week high');
  assert.equal(near[0]?.metric, '1.0% away');
  const at = buildStockSignals({daily: [], yearHigh: 99, lastPrice: 100});
  assert.equal(at[0]?.label, 'At a 52-week high');
  const low = buildStockSignals({daily: [], yearLow: 100.5, lastPrice: 100});
  assert.equal(low[0]?.label, 'At a 52-week low');
});

test('news carries the move since its day’s close and outranks old stories', () => {
  const now = Date.UTC(2026, 7, 23, 12);
  const signals = buildStockSignals({
    daily: withLast(day(21, 110)),
    lastPrice: 110,
    now,
    news: [
      news({
        headline: 'Fresh',
        analysis_date: '2026-08-20 20:00:24+00',
        catalyst: 'Order win',
      }),
      news({
        headline: 'Old',
        analysis_date: '2026-08-10T09:00:00Z',
        direction: 'bearish',
      }),
      news({headline: 'Stale', analysis_date: '2026-06-01T09:00:00Z'}),
      news({headline: '', analysis_date: '2026-08-22T09:00:00Z'}),
    ],
  });
  const fresh = signals.find(s => s.label === 'Order win');
  assert.ok(fresh);
  assert.equal(fresh.kind, 'news');
  assert.equal(fresh.priority, 9);
  assert.equal(fresh.metric, '+10.00% since');
  assert.equal(fresh.tone, 'bullish');
  const old = signals.find(s => s.label === 'Old');
  assert.equal(old?.priority, 4);
  assert.equal(old?.tone, 'bearish');
  assert.equal(
    signals.some(s => s.label === 'Stale'),
    false,
  );
});

test('signals are capped at six, best first', () => {
  const now = Date.UTC(2026, 7, 23, 12);
  const signals = buildStockSignals({
    daily: withLast(day(21, 108, 103)),
    now,
    indicators: {
      stock_symbol: 'X',
      volume: 3000,
      volume_ma10: 1000,
      rsi14: 74,
      ema200: 90,
    },
    news: [1, 2, 3].map(i =>
      news({headline: `N${i}`, analysis_date: `2026-08-2${i}T09:00:00Z`}),
    ),
  });
  assert.equal(signals.length, 6);
  assert.equal(signals[0]?.key, 'day-move');
  assert.equal(
    signals.some(s => s.key === 'trend'),
    false,
  );
});

// Bars arrive as zone-less IST digits. A device east of IST reads "2026-08-19
// 00:00:00" as its own local midnight, which is still the 18th in IST, so a
// zone-shifted key would pin the story to the wrong session's close.
test('news keys bars by their own IST digits, so a device east of IST finds the right close', () => {
  const hostZone = process.env.TZ;
  process.env.TZ = 'Asia/Tokyo';
  try {
    const bar = (date: string, close: number): GraphDataPoint => ({
      time: `${date} 00:00:00`,
      open: close,
      close,
      high: close + 1,
      low: close - 1,
    });
    const signals = buildStockSignals({
      daily: [
        bar('2026-08-18', 100),
        bar('2026-08-19', 105),
        bar('2026-08-20', 110),
      ],
      lastPrice: 121,
      now: Date.UTC(2026, 7, 23, 12),
      news: [news({headline: 'Guidance', analysis_date: '2026-08-19'})],
    });
    const story = signals.find(s => s.kind === 'news');
    assert.equal(story?.metric, '+15.24% since');
  } finally {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  }
});
