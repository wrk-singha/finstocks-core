import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {FSMRule} from '../../types/trade.ts';
import {exitHint, valueHint} from '../ruleHint.ts';

const rule = (over: Partial<FSMRule> = {}): FSMRule => ({
  condition: 'close >= $entry_price * 1.05',
  ...over,
});

test('a value that already reads plainly gets no hint', () => {
  assert.equal(valueHint('42'), null);
  assert.equal(valueHint('1.5'), null);
  assert.equal(valueHint(''), null);
  assert.equal(valueHint('   '), null);
  // A name no catalogue column matches is left alone rather than guessed at.
  assert.equal(valueHint('not_a_column'), null);
  assert.equal(valueHint('not_a_column * 2'), null);
});

test('a column name reads as its catalogue label, through the engine affixes', () => {
  assert.equal(valueHint('rsi14'), 'rsi 14');
  // `:1d` names the bar it is read from and does not change what the column is.
  assert.equal(valueHint('rsi14:1d'), 'rsi 14');
  // `_price` is the OHLC columns' engine spelling.
  assert.equal(valueHint('close_price'), 'close');
  assert.equal(valueHint('prev_close_price'), 'previous close');
});

test('only entry price reads as a percentage; anything else reads as a multiple', () => {
  assert.match(valueHint('$entry_price * 1.05') ?? '', /^5% above /);
  assert.match(valueHint('$entry_price * 0.95') ?? '', /^5% below /);
  // A multiple of any other column is a multiple: "50% above" would name a different measure.
  assert.equal(valueHint('rsi14 * 1.5'), '1.5 × rsi 14');
  // A factor of exactly 1 is not a percentage move.
  assert.match(valueHint('$entry_price * 1') ?? '', /^1 × /);
});

test('an exit prefers the compiler’s own words when they quantify it', () => {
  assert.equal(
    exitHint(rule({comment: 'Take profit at 5.0%'}), 'x'),
    'Take profit at 5%',
  );
  // A comment that names the transition rather than quantifying it belongs to the rule, not here.
  assert.equal(
    exitHint(
      rule({comment: 'Phase 2: Momentum', exit_type: 'stop_loss', pct: 3}),
      'x',
    ),
    'Stop loss at 3%',
  );
});

test('without a usable comment an exit falls back to its type, then to the value', () => {
  assert.equal(
    exitHint(rule({exit_type: 'take_profit', pct: 10}), 'x'),
    'Take profit at 10%',
  );
  // `signal` has no label: there is no percentage to state, so the value speaks for itself.
  assert.equal(exitHint(rule({exit_type: 'signal'}), 'rsi14'), 'rsi 14');
  assert.equal(exitHint(rule(), '42'), null);
});
