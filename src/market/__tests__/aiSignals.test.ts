import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  AISignal,
  AISignalOutcome,
  AISignalsResponse,
} from '../../types/aiSignals.ts';
import {
  AI_PIVOT_LAYERS,
  AI_SIGNALS_MAX_BARS,
  aiSignalsBars,
  aiSignalsRequestBars,
  closedBarsKey,
  intervalSeconds,
  isActionable,
  isLiveTrade,
  isSignalInView,
  lastBarForming,
  listSignals,
  pivotLayerSource,
  signalStatusOf,
  trackRecord,
  tradeSideOf,
} from '../aiSignals.ts';

const outcome = (fields: Partial<AISignalOutcome> = {}): AISignalOutcome => ({
  hit_t1: false,
  hit_t2: false,
  hit_stop: false,
  mfe_atr: 0,
  mae_atr: 0,
  r_multiple: 0,
  closed: false,
  horizon_bars: 40,
  bars_tracked: 3,
  ...fields,
});

const signal = (fields: Partial<AISignal> = {}): AISignal => ({
  key: 'k',
  symbol: 'RELIANCE',
  interval: '1d',
  family: 'classical',
  pattern: 'double_bottom',
  label: 'Double Bottom',
  direction: 'long',
  state: 'armed',
  start_time: 100,
  end_time: 200,
  trigger: 110,
  invalidation: 90,
  entry: 110,
  stop: 95,
  t1: 125,
  t2: 140,
  height: 15,
  rr_t1: 1,
  fit_quality: 0.8,
  confidence: 0.7,
  atr: 2,
  volume_ratio: 1.4,
  gates_passed: [],
  gates_failed: [],
  points: [],
  lines: {},
  meta: {},
  ...fields,
});

test('a status reads the state, and a triggered one its outcome', () => {
  const statusOf = (fields: Partial<AISignal>) =>
    signalStatusOf(signal(fields));
  assert.deepEqual(statusOf({state: 'armed'}), {key: 'watching', tone: 'wait'});
  assert.deepEqual(statusOf({state: 'triggered'}), {key: 'live', tone: 'live'});
  assert.deepEqual(statusOf({state: 'triggered', outcome: outcome()}), {
    key: 'live',
    tone: 'live',
  });
  assert.deepEqual(
    statusOf({state: 'triggered', outcome: outcome({hit_t1: true})}),
    {key: 'target1', tone: 'win'},
  );
  assert.deepEqual(
    statusOf({
      state: 'triggered',
      outcome: outcome({hit_t1: true, hit_t2: true}),
    }),
    {key: 'target2', tone: 'win'},
  );
  assert.deepEqual(
    statusOf({state: 'triggered', outcome: outcome({hit_stop: true})}),
    {key: 'stopped', tone: 'loss'},
  );
  // A stop after target 1 is still a stop; it says so rather than passing for a clean loss.
  assert.deepEqual(
    statusOf({
      state: 'triggered',
      outcome: outcome({hit_stop: true, hit_t1: true}),
    }),
    {key: 'stoppedAfterT1', tone: 'loss'},
  );
  assert.deepEqual(
    statusOf({state: 'triggered', outcome: outcome({closed: true})}),
    {key: 'closed', tone: 'muted'},
  );
  assert.deepEqual(statusOf({state: 'expired'}), {
    key: 'lapsed',
    tone: 'muted',
  });
  assert.deepEqual(statusOf({state: 'invalidated'}), {
    key: 'invalidated',
    tone: 'muted',
  });
  assert.deepEqual(statusOf({state: 'detected'}), {
    key: 'belowThreshold',
    tone: 'muted',
  });
});

test('a live trade is triggered and not yet closed; the side follows the direction', () => {
  assert.equal(tradeSideOf(signal({direction: 'long'})), 'BUY');
  assert.equal(tradeSideOf(signal({direction: 'short'})), 'SELL');
  assert.equal(isLiveTrade(signal({state: 'triggered'})), true);
  assert.equal(
    isLiveTrade(signal({state: 'triggered', outcome: outcome({hit_t1: true})})),
    true,
  );
  assert.equal(
    isLiveTrade(signal({state: 'triggered', outcome: outcome({closed: true})})),
    false,
  );
  assert.equal(isLiveTrade(signal({state: 'armed'})), false);
});

test('actionable means confident enough and either waiting for its entry or live', () => {
  assert.equal(
    isActionable(signal({state: 'armed', confidence: 0.6}), 0.6),
    true,
  );
  assert.equal(
    isActionable(signal({state: 'armed', confidence: 0.59}), 0.6),
    false,
  );
  assert.equal(isActionable(signal({state: 'triggered'}), 0.6), true);
  assert.equal(
    isActionable(
      signal({state: 'triggered', outcome: outcome({closed: true})}),
      0.6,
    ),
    false,
  );
  assert.equal(isActionable(signal({state: 'expired'}), 0.6), false);
  assert.equal(isActionable(signal({state: 'detected'}), 0), false);
});

test('the track record counts breakouts, T1s and stops taken before T1, and averages closed R', () => {
  const record = trackRecord([
    signal({state: 'armed'}),
    // Triggered with nothing to judge yet: not a breakout the record can score.
    signal({state: 'triggered'}),
    signal({
      state: 'triggered',
      outcome: outcome({hit_t1: true, closed: true, r_multiple: 1.5}),
    }),
    signal({
      state: 'triggered',
      outcome: outcome({hit_stop: true, closed: true, r_multiple: -1}),
    }),
    signal({
      state: 'triggered',
      outcome: outcome({
        hit_t1: true,
        hit_stop: true,
        closed: true,
        r_multiple: 0.5,
      }),
    }),
    signal({state: 'triggered', outcome: outcome({hit_t1: true})}),
  ]);
  assert.deepEqual(record, {
    triggered: 4,
    reachedT1: 3,
    stopped: 1,
    avgR: (1.5 - 1 + 0.5) / 3,
  });
  assert.equal(
    trackRecord([signal({state: 'triggered', outcome: outcome()})]).avgR,
    null,
  );
  assert.deepEqual(trackRecord([]), {
    triggered: 0,
    reachedT1: 0,
    stopped: 0,
    avgR: null,
  });
});

test('the lists split actionable from finished, newest first, and leave below-threshold shapes out', () => {
  const liveOld = signal({key: 'live-old', state: 'triggered', end_time: 100});
  const armedNew = signal({key: 'armed-new', state: 'armed', end_time: 300});
  const weakArmed = signal({
    key: 'weak',
    state: 'armed',
    confidence: 0.4,
    end_time: 250,
  });
  const lapsed = signal({key: 'lapsed', state: 'expired', end_time: 50});
  const detected = signal({key: 'detected', state: 'detected', end_time: 400});
  const lists = listSignals({
    signals: [liveOld, lapsed, detected, armedNew, weakArmed],
    min_confidence: 0.6,
  });
  assert.deepEqual(
    lists.active.map(s => s.key),
    ['armed-new', 'live-old'],
  );
  // Too weak to act on, so it reads as history rather than vanishing.
  assert.deepEqual(
    lists.history.map(s => s.key),
    ['weak', 'lapsed'],
  );
  assert.deepEqual(
    listSignals({signals: [weakArmed], min_confidence: Number.NaN}).active,
    [],
  );
});

test('a signal is in view when any of its span overlaps the visible range', () => {
  const s = signal({start_time: 100, end_time: 200});
  assert.equal(isSignalInView(s, {from: 150, to: 300}), true);
  assert.equal(isSignalInView(s, {from: 0, to: 100}), true);
  assert.equal(isSignalInView(s, {from: 200, to: 250}), true);
  assert.equal(isSignalInView(s, {from: 201, to: 300}), false);
  assert.equal(isSignalInView(s, {from: 0, to: 99}), false);
});

test('pivot layers draw confirmed swings or a named level set, in chip order', () => {
  assert.deepEqual(AI_PIVOT_LAYERS, [
    'structural',
    'classical',
    'fibonacci',
    'camarilla',
  ]);
  const response: Pick<AISignalsResponse, 'pivots' | 'standard_pivots'> = {
    pivots: [
      {time: 1, kind: 'H', price: 110, confirmed: true},
      {time: 2, kind: 'L', price: 95, confirmed: false},
      {time: 3, kind: 'L', price: 90, confirmed: true},
    ],
    standard_pivots: {
      classical: {P: 100, R1: 105},
      fibonacci: {P: 100},
      camarilla: {H3: 104},
    },
  };
  assert.deepEqual(pivotLayerSource(response, 'structural'), {
    swings: [
      {time: 1, price: 110},
      {time: 3, price: 90},
    ],
  });
  assert.deepEqual(pivotLayerSource(response, 'classical'), {
    levels: {P: 100, R1: 105},
  });
  assert.deepEqual(
    pivotLayerSource({pivots: [], standard_pivots: null}, 'camarilla'),
    {levels: {}},
  );
});

test('an interval token is its seconds per bar, and a month has none', () => {
  assert.equal(intervalSeconds('1m'), 60);
  assert.equal(intervalSeconds('5m'), 300);
  assert.equal(intervalSeconds('4h'), 14_400);
  assert.equal(intervalSeconds('1d'), 86_400);
  assert.equal(intervalSeconds('1w'), 604_800);
  assert.equal(intervalSeconds('1M'), 0);
  assert.equal(intervalSeconds('0m'), 0);
  assert.equal(intervalSeconds('1D'), 0);
  assert.equal(intervalSeconds(''), 0);
});

// Thursday 24 Sep 2026: 10:00 IST is mid-session, 16:30 IST after the close.
const MID_SESSION = Date.parse('2026-09-24T04:30:00Z') / 1000;
const AFTER_CLOSE = Date.parse('2026-09-24T11:00:00Z') / 1000;
const DAY_START = Date.parse('2026-09-24T00:00:00Z') / 1000;

test('an intraday bar forms until its interval has elapsed', () => {
  const bars = [{time: MID_SESSION - 120}, {time: MID_SESSION - 30}];
  assert.equal(lastBarForming(bars, 60, MID_SESSION), true);
  assert.equal(lastBarForming(bars, 60, MID_SESSION + 30), false);
  assert.equal(lastBarForming([], 60, MID_SESSION), false);
});

test('a daily or longer bar forms while the session that feeds it is open', () => {
  const daily = [{time: DAY_START}];
  assert.equal(lastBarForming(daily, 86_400, MID_SESSION), true);
  assert.equal(lastBarForming(daily, 86_400, AFTER_CLOSE), false);
  // Yesterday's bar is closed even mid-session: today's has simply not arrived.
  assert.equal(
    lastBarForming([{time: DAY_START - 86_400}], 86_400, MID_SESSION),
    false,
  );
  // A month has no fixed step, so it forms for up to 31 days while the market is open.
  const monthStart = Date.parse('2026-09-01T00:00:00Z') / 1000;
  assert.equal(lastBarForming([{time: monthStart}], 0, MID_SESSION), true);
  assert.equal(lastBarForming([{time: monthStart}], 0, AFTER_CLOSE), false);
});

const bar = (time: number, volume = 100) => ({
  time,
  open: 10,
  high: 12,
  low: 9,
  close: 11,
  volume,
});

test('the closed-bar key names a series by its count and ends', () => {
  const bars = [bar(1), bar(2), bar(3)];
  assert.equal(closedBarsKey(bars), '3:1:3');
  assert.equal(closedBarsKey(bars, 2), '2:1:2');
  assert.equal(closedBarsKey(bars, 0), '');
  assert.equal(closedBarsKey([]), '');
});

test('a request carries the newest bars up to the cap, with volume only where it traded', () => {
  assert.deepEqual(aiSignalsRequestBars([bar(1), bar(2, 0)]), [
    {t: 1, o: 10, h: 12, l: 9, c: 11, v: 100},
    {t: 2, o: 10, h: 12, l: 9, c: 11},
  ]);
  const many = Array.from({length: AI_SIGNALS_MAX_BARS + 5}, (_, i) => bar(i));
  const sent = aiSignalsRequestBars(many);
  assert.equal(sent.length, AI_SIGNALS_MAX_BARS);
  assert.equal(sent[0]?.t, 5);
  assert.equal(sent.at(-1)?.t, AI_SIGNALS_MAX_BARS + 4);
});

test('a forming bar is sent but keyed out, so it asks again only when it closes', () => {
  const bars = [
    bar(MID_SESSION - 120),
    bar(MID_SESSION - 60),
    bar(MID_SESSION - 30),
  ];
  const forming = aiSignalsBars(bars, 60, MID_SESSION);
  assert.equal(forming.lastBarForming, true);
  assert.equal(forming.bars.length, 3);
  assert.equal(forming.closedKey, `2:${MID_SESSION - 120}:${MID_SESSION - 60}`);
  const closed = aiSignalsBars(bars, 60, MID_SESSION + 60);
  assert.equal(closed.lastBarForming, false);
  assert.equal(closed.closedKey, `3:${MID_SESSION - 120}:${MID_SESSION - 30}`);
});
