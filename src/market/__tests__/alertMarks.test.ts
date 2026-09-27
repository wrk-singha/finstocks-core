import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {SavedAlert} from '../../types/savedAlert.ts';
import {
  alertFiredOn,
  alertMarksFor,
  alertsOnUnderlying,
  CHART_SERIES,
  liveMarksFor,
  NO_ALERT_MARKS,
} from '../alertMarks.ts';

const PATTERNS = new Set(['hammer', 'bullish_engulfing', 'double_bottom']);
const isPattern = (id: string) => PATTERNS.has(id);

const alert = (patch: Partial<SavedAlert> & {id: string}): SavedAlert => ({
  prompt: patch.id,
  name: patch.id,
  status: 'active',
  notify: true,
  created_at: '2026-09-01T05:00:00Z',
  ...patch,
});

const FIRED = '2026-09-12T04:15:00Z';
const FIRED_S = Date.parse(FIRED) / 1000;

test('the chart computes the price, its averages and RSI', () => {
  assert.deepEqual(CHART_SERIES.close_price, {kind: 'Price'});
  assert.deepEqual(CHART_SERIES.ema50, {kind: 'EMA', length: 50});
  assert.deepEqual(CHART_SERIES.sma200, {kind: 'SMA', length: 200});
  assert.deepEqual(CHART_SERIES.wma20, {kind: 'WMA', length: 20});
  assert.deepEqual(CHART_SERIES.rsi14, {kind: 'RSI', length: 14});
  assert.equal(Object.keys(CHART_SERIES).length, 14);
  assert.equal(CHART_SERIES.rvol, undefined);
});

test('a leaf against a line or a level becomes a rule in the study’s words', () => {
  assert.deepEqual(
    liveMarksFor({var: 'close_price', op: 'crosses_above', val: 'ema50'}),
    {
      rules: [
        {
          a: {kind: 'Price'},
          condition: 'crosses above',
          b: {kind: 'EMA', length: 50},
        },
      ],
      join: 'AND',
    },
  );
  assert.deepEqual(liveMarksFor({var: 'rsi14', op: '<=', val: 30}), {
    rules: [{a: {kind: 'RSI', length: 14}, condition: 'below', b: {value: 30}}],
    join: 'AND',
  });
  assert.deepEqual(liveMarksFor({var: 'close_price', op: '>', val: 2500}), {
    rules: [{a: {kind: 'Price'}, condition: 'above', b: {value: 2500}}],
    join: 'AND',
  });
});

test('a group keeps its join; only one level deep is read', () => {
  const marks = liveMarksFor({
    logic: 'OR',
    conditions: [
      {var: 'close_price', op: 'crosses_below', val: 'sma200'},
      {var: 'rsi9', op: '>=', val: 70},
    ],
  });
  assert.ok(marks && 'rules' in marks);
  assert.equal(marks.join, 'OR');
  assert.deepEqual(
    marks.rules.map(rule => rule.condition),
    ['crosses below', 'above'],
  );
  assert.equal(
    liveMarksFor({
      logic: 'AND',
      conditions: [
        {var: 'rsi14', op: '<', val: 30},
        {logic: 'OR', conditions: [{var: 'rsi7', op: '<', val: 20}]},
      ],
    }),
    null,
  );
});

test('anything the chart does not compute is marked only where it fired', () => {
  assert.equal(liveMarksFor({var: 'rvol', op: '>', val: 2}), null);
  assert.equal(
    liveMarksFor({var: 'close_price', op: '==', val: 2500}),
    null,
    'an operator the study has no words for',
  );
  assert.equal(
    liveMarksFor({var: 'close_price', op: '>', val: 'vwap'}),
    null,
    'a line the chart does not draw',
  );
  assert.equal(
    liveMarksFor({
      conditions: [
        {var: 'rsi14', op: '<', val: 30},
        {var: 'pe_ttm', op: '<', val: 20},
      ],
    }),
    null,
    'one leaf it cannot read spoils the group',
  );
  assert.equal(liveMarksFor(null), null);
  assert.equal(liveMarksFor('rsi14 < 30'), null);
  assert.equal(liveMarksFor({conditions: [null]}), null);
});

test('a column named after an object property is not a series', () => {
  assert.equal(
    liveMarksFor({var: 'constructor', op: '>', val: 'toString'}),
    null,
  );
  assert.equal(liveMarksFor({var: 'rsi14', op: 'toString', val: 30}), null);
});

test('patterns are found by the scan: one, or any of several', () => {
  assert.deepEqual(liveMarksFor({var: 'hammer', op: '==', val: 1}, isPattern), {
    patterns: ['hammer'],
  });
  assert.deepEqual(
    liveMarksFor(
      {
        logic: 'OR',
        conditions: [
          {var: 'hammer', op: '==', val: 1},
          {var: 'double_bottom', op: '==', val: 1},
        ],
      },
      isPattern,
    ),
    {patterns: ['hammer', 'double_bottom']},
  );
  // Several on one candle, or a pattern beside a rule, is not something the scan answers.
  assert.equal(
    liveMarksFor(
      {
        conditions: [
          {var: 'hammer', op: '==', val: 1},
          {var: 'bullish_engulfing', op: '==', val: 1},
        ],
      },
      isPattern,
    ),
    null,
  );
  assert.equal(
    liveMarksFor(
      {
        logic: 'OR',
        conditions: [
          {var: 'hammer', op: '==', val: 1},
          {var: 'rsi14', op: '<', val: 30},
        ],
      },
      isPattern,
    ),
    null,
  );
  // With no field list to say which ids are patterns, a pattern keeps only its flag.
  assert.equal(liveMarksFor({var: 'hammer', op: '==', val: 1}), null);
});

test('an alert is on an underlying through its own symbol or a match, contracts included', () => {
  const alerts = [
    alert({id: 'own', symbol: 'NSE:RELIANCE'}),
    alert({id: 'match', matches: [{symbol: 'TCS'}, {symbol: 'RELIANCE-EQ'}]}),
    alert({id: 'option', symbol: 'RELIANCE26SEP3000CE'}),
    alert({id: 'other', symbol: 'INFY', matches: [{symbol: 'TCS'}]}),
    alert({id: 'none'}),
  ];
  assert.deepEqual(
    alertsOnUnderlying(alerts, 'RELIANCE').map(entry => entry.id),
    ['own', 'match', 'option'],
  );
  assert.deepEqual(
    alertsOnUnderlying(alerts, 'NIFTY BANK').map(entry => entry.id),
    [],
  );
});

test('a list alert fired where its match did; a stock’s alert when it did', () => {
  const list = alert({
    id: 'list',
    matches: [
      {symbol: 'TCS', triggered_at: '2026-09-10T04:00:00Z'},
      {symbol: 'RELIANCE', triggered_at: FIRED},
    ],
    last_triggered_at: '2026-09-10T04:00:00Z',
  });
  assert.equal(alertFiredOn(list, 'RELIANCE'), FIRED);
  assert.equal(alertFiredOn(list, 'TCS'), '2026-09-10T04:00:00Z');
  assert.equal(alertFiredOn(list, 'INFY'), null);

  const stock = alert({
    id: 'stock',
    symbol: 'RELIANCE',
    matches: [{symbol: 'RELIANCE', triggered_at: null}],
    last_triggered_at: FIRED,
  });
  assert.equal(alertFiredOn(stock, 'RELIANCE'), FIRED);
  assert.equal(
    alertFiredOn(alert({id: 'quiet', symbol: 'RELIANCE'}), 'RELIANCE'),
    null,
  );
});

test('marks: a flag where each plotted alert fired, and the watch its rule holds on since', () => {
  const alerts = [
    alert({
      id: 'ema',
      symbol: 'RELIANCE',
      last_triggered_at: FIRED,
      condition: {var: 'close_price', op: 'crosses_above', val: 'ema50'},
    }),
    alert({
      id: 'volume',
      matches: [{symbol: 'RELIANCE', triggered_at: '2026-09-15T05:00:00Z'}],
      condition: {var: 'rvol', op: '>', val: 2},
    }),
    alert({
      id: 'waiting',
      symbol: 'RELIANCE',
      condition: {var: 'rsi14', op: '<', val: 30},
    }),
    alert({id: 'elsewhere', symbol: 'TCS', last_triggered_at: FIRED}),
    alert({id: 'garbled', symbol: 'RELIANCE', last_triggered_at: 'not a time'}),
  ];
  const marks = alertMarksFor(alerts, 'RELIANCE');
  assert.deepEqual(marks.fires, [
    FIRED_S,
    Date.parse('2026-09-15T05:00:00Z') / 1000,
  ]);
  assert.deepEqual(marks.hits, []);
  assert.deepEqual(marks.watches, [
    {
      rules: [
        {
          a: {kind: 'Price'},
          condition: 'crosses above',
          b: {kind: 'EMA', length: 50},
        },
      ],
      join: 'AND',
      from: FIRED_S,
    },
  ]);

  const hidden = alertMarksFor(alerts, 'RELIANCE', {
    isPlotted: id => id !== 'ema',
  });
  assert.deepEqual(hidden.fires, [Date.parse('2026-09-15T05:00:00Z') / 1000]);
  assert.deepEqual(hidden.watches, []);

  assert.deepEqual(alertMarksFor([], 'RELIANCE'), NO_ALERT_MARKS);
});

test('a fired pattern alert is marked where the scan finds its pattern from then on', () => {
  const alerts = [
    alert({
      id: 'hammer',
      symbol: 'RELIANCE',
      last_triggered_at: FIRED,
      condition: {var: 'hammer', op: '==', val: 1},
    }),
  ];
  const patternHits = [
    {pattern: 'hammer', to_epoch: FIRED_S - 86_400},
    {pattern: 'hammer', to_epoch: FIRED_S + 86_400},
    {pattern: 'doji', to_epoch: FIRED_S + 86_400},
  ];
  const marks = alertMarksFor(alerts, 'RELIANCE', {isPattern, patternHits});
  assert.deepEqual(marks.fires, [FIRED_S]);
  assert.deepEqual(marks.hits, [FIRED_S + 86_400]);
  assert.deepEqual(marks.watches, []);

  // Without the field list the same alert is a flag and nothing more.
  assert.deepEqual(alertMarksFor(alerts, 'RELIANCE', {patternHits}).hits, []);
});
