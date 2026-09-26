import assert from 'node:assert/strict';
import {test} from 'node:test';

import {readingFsm, readingLeaf} from '../alertReading.ts';
import {monitorFsm} from '../alertRule.ts';

const entryOf = (reading: string) => {
  const fsm = readingFsm(reading);
  assert.notEqual(fsm, null);
  return fsm?.states.IDLE.transitions[0]?.condition;
};

test('the curated volatility labels resolve; the old "volume" spellings do not', () => {
  assert.deepEqual(entryOf('Historical volatility is above 30'), {
    var: 'hist_vol',
    op: '>',
    val: 30,
  });
  assert.deepEqual(entryOf('Historical volatility ratio is at least 1.5'), {
    var: 'hist_vol_ratio',
    op: '>=',
    val: 1.5,
  });
  assert.equal(readingFsm('Hist volume is above 30'), null);
  assert.equal(readingFsm('Hist vol ratio is above 1.5'), null);
});

test('a leaf takes the longest label, one of the engine verbs, and a number or another field', () => {
  assert.deepEqual(readingLeaf('RSI (14) crosses below 30'), {
    var: 'rsi14',
    op: 'crosses_below',
    val: 30,
  });
  assert.deepEqual(
    readingLeaf('Price crosses above 50-day exponential moving average'),
    {var: 'close_price', op: 'crosses_above', val: 'ema50'},
  );
  assert.deepEqual(readingLeaf('Volume is at most 1,20,000'), {
    var: 'volume',
    op: '<=',
    val: 120000,
  });
  assert.equal(readingLeaf('RSI (14) is rising'), null);
  assert.equal(readingLeaf('RSI (14) is above'), null);
  assert.equal(readingLeaf('RSI (14) is above thirty'), null);
  assert.equal(readingLeaf('Crosses above 50 EMA'), null);
});

test('clauses joined with "and" become one AND condition, and any unreadable clause refuses the whole reading', () => {
  assert.deepEqual(entryOf('Price is above 2,500 and Volume ROC is above 20'), {
    logic: 'AND',
    conditions: [
      {var: 'close_price', op: '>', val: 2500},
      {var: 'volume_roc', op: '>', val: 20},
    ],
  });
  assert.equal(readingFsm('Price is above 2,500 and Volume is rising'), null);
  assert.equal(readingFsm(''), null);
  assert.equal(readingFsm(undefined), null);
});

test('the machine is the monitor shape the engine reads as matched once', () => {
  const fsm = readingFsm('ADX (14) is above 25');
  assert.deepEqual(fsm, monitorFsm({var: 'adx_14', op: '>', val: 25}));
  assert.equal(fsm?.initial_state, 'IDLE');
  assert.equal(fsm?.intent, 'monitor');
  assert.deepEqual(fsm?.states.IDLE.transitions[0]?.actions[0], {
    type: 'ORDER',
    payload: {side: 'BUY'},
  });
  assert.deepEqual(fsm?.states.BOUGHT.transitions, []);
  assert.equal(
    monitorFsm({var: 'iv', op: '>', val: 20}, 'ATM_CE_CURRENT').states.IDLE
      .transitions[0]?.actions[0]?.payload.target,
    'ATM_CE_CURRENT',
  );
});
