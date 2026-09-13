import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatLogDateTime, getTradeLogAction} from '../strategyLogs.ts';

test('formatLogDateTime renders IST parts, or a dash for nothing', () => {
  assert.deepEqual(formatLogDateTime('2026-06-30T04:00:00Z'), {
    full: 'Jun 30 9:30 AM',
    date: 'Jun 30',
    time: '9:30 AM',
  });
  assert.equal(formatLogDateTime('2026-06-30T04:00:00Z', 'date'), 'Jun 30');
  assert.equal(formatLogDateTime('2026-06-30T04:00:00Z', 'time'), '9:30 AM');
  assert.equal(
    formatLogDateTime('2026-06-30T04:00:00Z', 'full'),
    'Jun 30 9:30 AM',
  );
  assert.equal(formatLogDateTime('junk', 'full'), '—');
  assert.deepEqual(formatLogDateTime(null), {full: '—', date: '—', time: '—'});
});

test('getTradeLogAction reads the side off a dynamic log level', () => {
  assert.equal(getTradeLogAction('BUY 99 ADANIPOWER'), 'BUY');
  assert.equal(getTradeLogAction(' sell: TCS'), 'SELL');
  assert.equal(getTradeLogAction('EXECUTION_FILLED'), 'BUY');
  assert.equal(getTradeLogAction('BUYBACK'), null);
  assert.equal(getTradeLogAction('INFO'), null);
  assert.equal(getTradeLogAction(''), null);
  assert.equal(getTradeLogAction(undefined), null);
});
