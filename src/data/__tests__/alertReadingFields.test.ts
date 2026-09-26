import assert from 'node:assert/strict';
import {test} from 'node:test';

import {ALERT_READING_FIELDS} from '../alertReadingFields.ts';

test('the keys are the labels the assistant emits, volatility included', () => {
  assert.equal(ALERT_READING_FIELDS['Historical volatility'], 'hist_vol');
  assert.equal(
    ALERT_READING_FIELDS['Historical volatility ratio'],
    'hist_vol_ratio',
  );
  assert.equal(ALERT_READING_FIELDS['Hist volume'], undefined);
  assert.equal(ALERT_READING_FIELDS['Hist vol ratio'], undefined);
  assert.equal(ALERT_READING_FIELDS.Price, 'close_price');
});

test('every label names one engine column, and no column is named twice', () => {
  const columns = Object.values(ALERT_READING_FIELDS);
  assert.equal(columns.length, 128);
  assert.equal(new Set(columns).size, columns.length);
  for (const column of columns) assert.match(column, /^[a-z][a-z0-9_]*$/);
});
