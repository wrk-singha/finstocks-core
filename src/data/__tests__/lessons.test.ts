import assert from 'node:assert/strict';
import {test} from 'node:test';

import {CORE_LESSONS, LESSONS, lessonsForRoute} from '../lessons.ts';

test('lesson ids are unique and the core path is the first-run prefix', () => {
  const ids = LESSONS.map(l => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    CORE_LESSONS.map(l => l.id),
    [
      'ask-a-stock',
      'read-a-pick',
      'build-a-strategy',
      'backtest-it',
      'read-a-backtest',
      'connect-broker',
      'autopilot',
    ],
  );
});

test('a route pulls its own lessons to the front and keeps both groups in first-run order', () => {
  const forPortfolio = lessonsForRoute('/portfolio/holdings');
  assert.equal(forPortfolio[0]?.id, 'explain-my-pnl');
  assert.equal(forPortfolio.length, LESSONS.length);
  assert.deepEqual(
    forPortfolio.slice(1).map(l => l.id),
    LESSONS.filter(l => l.id !== 'explain-my-pnl').map(l => l.id),
  );
});

test('the templates surface matches both the web and the mobile spelling', () => {
  assert.equal(
    lessonsForRoute('/strategy-templates')[0]?.id,
    'build-a-strategy',
  );
  assert.equal(lessonsForRoute('/templates')[0]?.id, 'build-a-strategy');
});

test('an unknown route returns the first-run order untouched', () => {
  assert.deepEqual(
    lessonsForRoute('/nowhere').map(l => l.id),
    LESSONS.map(l => l.id),
  );
});
