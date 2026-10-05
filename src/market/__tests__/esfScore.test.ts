import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  formatTopPct,
  MARKET_LABELS,
  STAGE_CYCLE,
  stageCycle,
  stageLabel,
  stageName,
  warningText,
} from '../esfScore.ts';

const STAGES = [
  ['1A', 1, 'Early base'],
  ['1B', 1, 'Ready to rise'],
  ['2A', 2, 'Early uptrend'],
  ['2B', 2, 'Uptrend'],
  ['2C', 2, 'Extended uptrend'],
  ['3', 3, 'Topping out'],
  ['4', 4, 'Falling'],
] as const;

test('the rank reads to one decimal under 10% and as a whole number from there', () => {
  assert.equal(formatTopPct(1.4), 'Top 1.4%');
  assert.equal(formatTopPct(5), 'Top 5.0%');
  assert.equal(formatTopPct(9.94), 'Top 9.9%');
  assert.equal(formatTopPct(10), 'Top 10%');
  assert.equal(formatTopPct(25.2), 'Top 25%');
  assert.equal(formatTopPct(61.5), 'Top 62%');
  assert.equal(formatTopPct(100), 'Top 100%');
});

test('the very best stock never reads as the top 0.0%', () => {
  assert.equal(formatTopPct(0.04), 'Top 0.1%');
  assert.equal(formatTopPct(0), 'Top 0.1%');
});

// As web prints it today: just under 10% the one decimal rounds up to "10.0", and 10 itself drops
// it. Held so that changing either is a decision, not a side effect.
test('a rank a hair under 10% reads "Top 10.0%", and 10% itself "Top 10%"', () => {
  assert.equal(formatTopPct(9.95), 'Top 9.9%');
  assert.equal(formatTopPct(9.96), 'Top 10.0%');
  assert.equal(formatTopPct(9.99), 'Top 10.0%');
  assert.equal(formatTopPct(10), 'Top 10%');
});

test('every stage code has its cycle, its name and its label', () => {
  for (const [stage, cycle, name] of STAGES) {
    assert.equal(stageCycle(stage), cycle);
    assert.equal(stageName(stage), name);
    assert.equal(stageLabel(stage), `Stage ${stage} · ${name}`);
  }
});

test('a stock with no stage is not staged and sits in no cycle', () => {
  for (const stage of [null, undefined, '']) {
    assert.equal(stageCycle(stage), null);
    assert.equal(stageName(stage), 'Not staged');
    assert.equal(stageLabel(stage), 'Not staged');
  }
});

test('a stage code this build does not know keeps its code and its cycle', () => {
  assert.equal(stageCycle('2D'), 2);
  assert.equal(stageName('2D'), 'Not staged');
  assert.equal(stageLabel('2D'), 'Stage 2D · Not staged');
  assert.equal(stageCycle('X'), null);
  assert.equal(stageCycle('0'), null);
});

// Codes are matched as served, capitals and all. Held as it is today, for the same reason.
test('a stage code in lower case keeps its cycle and is not named', () => {
  assert.equal(stageCycle('2a'), 2);
  assert.equal(stageName('2a'), 'Not staged');
  assert.equal(stageLabel('2a'), 'Stage 2a · Not staged');
  assert.equal(stageCycle('1b'), 1);
  assert.equal(stageName('1b'), 'Not staged');
});

test('the strip runs base, uptrend, topping, falling, and every stage lands on one step', () => {
  assert.deepEqual(STAGE_CYCLE, [
    {cycle: 1, label: 'Base'},
    {cycle: 2, label: 'Uptrend'},
    {cycle: 3, label: 'Topping'},
    {cycle: 4, label: 'Falling'},
  ]);
  for (const [stage] of STAGES) {
    assert.equal(
      STAGE_CYCLE.filter(step => step.cycle === stageCycle(stage)).length,
      1,
    );
  }
});

test('each warning code reads as its sentence, and an unknown code prints raw', () => {
  assert.equal(
    warningText('market_not_confirmed'),
    "The overall market isn't in a confirmed uptrend.",
  );
  assert.equal(
    warningText('volume_distribution'),
    'Heavy selling in recent weeks.',
  );
  assert.equal(warningText('piotroski_weak'), 'Weak accounts.');
  assert.equal(warningText('earnings_restated'), 'earnings_restated');
});

test('the market states have their labels', () => {
  assert.deepEqual(MARKET_LABELS, {
    confirmed_uptrend: 'Confirmed uptrend',
    under_pressure: 'Uptrend under pressure',
    correction: 'Correction',
  });
});
