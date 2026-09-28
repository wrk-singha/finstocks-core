import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  ALERT_FIELDS,
  ALERT_TABS,
  alertField,
  EXPIRY_CHOICES,
  findAlertField,
  POPULAR_FIELD_IDS,
  searchAlertFields,
  sectionsOf,
} from '../alertFields.ts';

const ids = (fields: readonly {id: string}[]) => fields.map(f => f.id);

test('every field is an engine column named once, on a tab the picker shows', () => {
  const all = ids(ALERT_FIELDS);
  assert.equal(all.length, 130);
  assert.equal(new Set(all).size, all.length);
  const tabs = new Set(ALERT_TABS.map(t => t.id));
  for (const f of ALERT_FIELDS) {
    assert.ok(tabs.has(f.tab), f.id);
    assert.notEqual(f.tab, 'popular');
  }
  assert.deepEqual(
    ALERT_TABS.map(t => t.id),
    ['popular', 'price', 'technical', 'fundamental', 'fno'],
  );
});

test('the kinds carry what their sentence needs', () => {
  for (const f of ALERT_FIELDS) {
    if (f.kind === 'line' || f.kind === 'price') assert.equal(f.unit, '₹');
    if (f.kind === 'bounded') assert.ok((f.presets?.length ?? 0) > 0, f.id);
    if (f.contract === true) assert.equal(f.tab, 'fno');
  }
  // Fundamentals and the day's move are the only daily reads.
  const daily = ALERT_FIELDS.filter(f => f.daily === true);
  assert.ok(daily.every(f => f.tab === 'fundamental' || f.id === '__day_move'));
  assert.equal(
    daily.length,
    ALERT_FIELDS.filter(f => f.tab === 'fundamental').length + 1,
  );
});

test('an unknown id reads as the price for the form, and as nothing for a caller that asks', () => {
  assert.equal(alertField('rsi14').label, 'RSI (14)');
  assert.equal(alertField('no_such_column').id, 'close_price');
  assert.equal(findAlertField('no_such_column'), undefined);
  assert.equal(findAlertField('ema50')?.kind, 'line');
});

test('the popular screen names real fields, one from each world', () => {
  for (const id of POPULAR_FIELD_IDS) assert.ok(findAlertField(id), id);
  const worlds = new Set(POPULAR_FIELD_IDS.map(id => alertField(id).tab));
  assert.deepEqual([...worlds].sort(), [
    'fno',
    'fundamental',
    'price',
    'technical',
  ]);
});

test('a tab lists its sections once, in catalogue order', () => {
  assert.deepEqual(sectionsOf('price'), ['Price', '52-week range', 'Volume']);
  assert.deepEqual(sectionsOf('fno'), [
    'Option contract',
    'Option chain',
    'Futures',
  ]);
  assert.deepEqual(sectionsOf('popular'), []);
});

test('search matches every word by prefix, across label, section, id and keywords', () => {
  assert.deepEqual(searchAlertFields(''), []);
  assert.deepEqual(searchAlertFields('   '), []);
  assert.deepEqual(ids(searchAlertFields('rsi')), [
    'rsi14',
    'rsi9',
    'rsi7',
    'stoch_rsi_k',
  ]);
  // A keyword, not the label.
  assert.deepEqual(ids(searchAlertFields('greeks')), [
    'delta',
    'gamma',
    'theta',
    'vega',
  ]);
  // Two words must both match.
  assert.deepEqual(ids(searchAlertFields('52 high')), ['pct_from_52w_high']);
  // The id, with underscores read as spaces.
  assert.deepEqual(ids(searchAlertFields('supertrend')), ['supertrend_10_3']);
  assert.deepEqual(searchAlertFields('zzz'), []);
});

test('expiries are the compiler’s ExpirySelection names', () => {
  assert.deepEqual(
    EXPIRY_CHOICES.map(e => e.value),
    ['current', 'next_week', 'monthly', 'next_month'],
  );
});
