import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {StockScoreResponse} from '../../types/scores.ts';
import {mapStockScore} from '../stockScore.ts';

const api: StockScoreResponse = {
  symbol: 'RELIANCE',
  composite_score: 72,
  verdict: 'Strong Buy',
  conviction_pct: 64,
  rationale: 'Cheap on cash flow.',
  valuation_score: 60,
  financials_score: 80,
  technicals_score: 70,
  ownership_score: 78,
  pillar_details: {},
  industry: 'Refineries',
  sector_rank: 1,
  sector_total: 9,
  computed_at: '2026-09-11T10:00:00Z',
};

test('the free-text verdict becomes a typed action and the pillars a list', () => {
  const score = mapStockScore(api);
  assert.ok(score);
  assert.equal(score.stock_symbol, 'RELIANCE');
  assert.equal(score.action, 'buy');
  assert.equal(score.score, 72);
  assert.equal(score.summary, 'Cheap on cash flow.');
  assert.equal(score.updated_at, '2026-09-11T10:00:00Z');
  assert.deepEqual(
    score.pillars.map(p => [p.key, p.score, p.tab]),
    [
      ['valuation', 60, 'financials'],
      ['financials', 80, 'financials'],
      ['technicals', 70, 'technicals'],
      ['ownership', 78, 'ownership'],
    ],
  );
  assert.equal(mapStockScore({...api, verdict: 'Sell'})?.action, 'sell');
  assert.equal(mapStockScore({...api, verdict: 'Hold'})?.action, 'hold');
  assert.equal(
    mapStockScore({...api, verdict: null as unknown as string})?.action,
    'hold',
  );
  assert.equal(mapStockScore(null), null);
  assert.equal(mapStockScore(undefined), null);
});
