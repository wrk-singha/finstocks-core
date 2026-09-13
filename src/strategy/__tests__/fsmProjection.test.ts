import assert from 'node:assert/strict';
import {test} from 'node:test';

import {projectRawFsm} from '../fsmProjection.ts';

const fsm = {
  initial_state: 'IDLE',
  states: {
    IDLE: {
      transitions: [
        {
          condition: {
            conditions: [
              {var: 'rsi14', op: '<', val: 30},
              {var: 'close_price', op: '>', val: 'ema50'},
            ],
            logic: 'OR',
          },
          next_state: 'LONG',
        },
        {
          condition: {var: 'trades_today', op: '==', val: 0},
          next_state: 'IDLE',
        },
      ],
    },
    LONG: {
      transitions: [
        {
          condition: {var: 'close_price', op: '>=', val: '$target_profit'},
          next_state: 'IDLE',
          comment: 'Take profit at 5% above entry',
        },
        {
          condition: {var: 'close_price', op: '<=', val: '$stop_loss'},
          next_state: 'IDLE',
          comment: 'Stop loss at 2%',
        },
        {
          condition: {var: 'macd_8_21_9', op: 'crosses_below', val: 0},
          next_state: 'IDLE',
          comment: 'signal exit',
        },
        {
          condition: {var: 'atr14 / volume_ma50', op: '??', val: 1},
          next_state: 'IDLE',
        },
      ],
    },
  },
};

test('projectRawFsm splits transitions into entry and exit rules with humanised clauses', () => {
  const rules = projectRawFsm(fsm);
  assert.ok(rules);
  assert.deepEqual(rules.entry, [
    {
      condition: '',
      clauses: [
        {indicator: 'RSI14', operator: 'below', value: '30'},
        {indicator: 'Close Price', operator: 'above', value: 'EMA50'},
      ],
      logic: 'OR',
    },
  ]);
  assert.deepEqual(
    rules.exit.map(r => [
      r.clauses?.[0]?.indicator,
      r.clauses?.[0]?.operator,
      r.clauses?.[0]?.value,
      r.exit_type,
      r.pct,
      r.logic,
    ]),
    [
      [
        'Close Price',
        'at or above',
        '$target_profit',
        'take_profit',
        5,
        undefined,
      ],
      ['Close Price', 'at or below', '$stop_loss', 'stop_loss', 2, undefined],
      ['MACD_8_21_9', 'crosses below', '0', 'signal', undefined, undefined],
      ['atr14 / volume_ma50', '??', '1', undefined, undefined, undefined],
    ],
  );
  assert.equal('nlp_triggers' in rules, false);
});

test('projectRawFsm returns null when there is nothing to render', () => {
  assert.equal(projectRawFsm(null), null);
  assert.equal(projectRawFsm({states: {}}), null);
  assert.equal(
    projectRawFsm({
      initial_state: 'IDLE',
      states: {IDLE: {transitions: [{next_state: 'X'}]}},
    }),
    null,
  );
  const triggers = [{id: '1', summary: 'Exit on bad news'}];
  assert.deepEqual(
    projectRawFsm({
      initial_state: 'IDLE',
      states: {IDLE: {}},
      nlp_triggers: triggers,
    }),
    {
      entry: [],
      exit: [],
      nlp_triggers: triggers,
    },
  );
});
