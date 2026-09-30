import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  type ChartAckOutcome,
  type ChartAckResult,
  type ChatWsClientMessage,
  chartAckMessage,
} from '../chat.ts';

const plan = (...ops: string[]) => ({ops: ops.map(op => ({op}))});

const result = (
  outcomes: readonly ChartAckOutcome[],
  fields: Partial<ChartAckResult> = {},
): ChartAckResult => ({
  undoGroup: 'ug-1',
  outcomes,
  mutated: outcomes.some(outcome => outcome.ok),
  reply: 'Drew the line.',
  ...fields,
});

test('a plan that applied as written acks ok, with no detail, under its undo group', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('draw.horizontal_line', 'panel.open'),
    result([
      {op: 'draw.horizontal_line', ok: true, did: 'Drew a line at 1,300'},
      {op: 'panel.open', ok: true, did: 'Opened Positions'},
    ]),
  );
  assert.deepEqual(frame, {
    type: 'chart_ack',
    data: {chat_id: 'chat-1', plan_id: 'ug-1', ok: true},
  });
  assert.equal('detail' in frame.data, false);
  // It is one of the frames the socket takes.
  const sent: ChatWsClientMessage = frame;
  assert.equal(JSON.stringify(sent).includes('detail'), false);
});

test('failed steps fail the ack and are told, the first two only', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('a', 'b', 'c', 'd'),
    result([
      {op: 'a', ok: true, did: 'Added RSI'},
      {op: 'b', ok: false, error: 'there is no alert a1 on TCS'},
      {op: 'c', ok: false},
      {op: 'd', ok: false, error: 'never told'},
    ]),
  );
  assert.equal(frame.data.ok, false);
  assert.equal(
    frame.data.detail,
    'Not done: there is no alert a1 on TCS; Not done: the page could not do this step',
  );
});

test('an empty error reads as the page not doing the step', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('a'),
    result([{op: 'a', ok: false, error: ''}]),
  );
  assert.equal(frame.data.detail, 'Not done: the page could not do this step');
});

test('a step done only in part fails the ack and says what it could not carry', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('order.open', 'panel.open'),
    result([
      {
        op: 'order.open',
        ok: true,
        did: 'Opened the buy ticket',
        partial: "the target and stop - this order type can't carry them",
      },
      {op: 'panel.open', ok: true, did: 'Opened Positions'},
    ]),
  );
  assert.equal(frame.data.ok, false);
  assert.equal(
    frame.data.detail,
    "Opened the buy ticket, without the target and stop - this order type can't carry them",
  );
});

test('failures come before partial steps, and a partial step without words is Done', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('a', 'b', 'c', 'd', 'e'),
    result([
      {op: 'a', ok: true, partial: 'the stop'},
      {op: 'b', ok: false, error: 'one'},
      {op: 'c', ok: false, error: 'two'},
      {op: 'd', ok: false, error: 'three'},
      {op: 'e', ok: true, did: 'Filled in the order pad', partial: 'the exits'},
    ]),
  );
  assert.equal(frame.data.ok, false);
  assert.equal(
    frame.data.detail,
    'Not done: one; Not done: two; Done, without the stop; Filled in the order pad, without the exits',
  );
});

test('an empty partial is a step done in full', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('a'),
    result([{op: 'a', ok: true, did: 'Opened Alerts', partial: ''}]),
  );
  assert.deepEqual(frame.data, {chat_id: 'chat-1', plan_id: 'ug-1', ok: true});
});

test('a words-only answer plan acks ok though it changed nothing', () => {
  for (const asked of [{ops: []}, {}]) {
    const frame = chartAckMessage(
      'chat-1',
      asked,
      result([], {mutated: false, reply: 'RSI is 61 on the daily.'}),
    );
    assert.deepEqual(frame.data, {
      chat_id: 'chat-1',
      plan_id: 'ug-1',
      ok: true,
    });
  }
});

test('a plan with steps that reported nothing and changed nothing acks its reply as the detail', () => {
  const frame = chartAckMessage(
    'chat-1',
    plan('draw.horizontal_line'),
    result([], {mutated: false, reply: "The chart couldn't apply that."}),
  );
  assert.deepEqual(frame.data, {
    chat_id: 'chat-1',
    plan_id: 'ug-1',
    ok: false,
    detail: "The chart couldn't apply that.",
  });
});

test('a plan with steps that reported nothing but changed the chart acks ok', () => {
  const frame = chartAckMessage(
    'chat-2',
    plan('chart.set_symbol'),
    result([], {undoGroup: 'ug-2', mutated: true}),
  );
  assert.deepEqual(frame.data, {chat_id: 'chat-2', plan_id: 'ug-2', ok: true});
});
