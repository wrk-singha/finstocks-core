import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {InstitutionalFlowRow} from '../../types/market.ts';
import {
  buildFlowPair,
  FLOW_WINDOW_DAYS,
  flowDirection,
  flowVerb,
  isBuying,
  signedCrore,
} from '../institutionalFlows.ts';

const row = (
  date: string,
  source: string,
  eq_net: number | null,
): InstitutionalFlowRow => ({
  date,
  source,
  eq_gross_purchase: null,
  eq_gross_sale: null,
  eq_net,
  eq_cumulative: null,
  debt_gross_purchase: null,
  debt_gross_sale: null,
  debt_net: null,
  debt_cumulative: null,
  usd_rate: null,
  updated_at: date,
});

test('direction words and the signed crore figure', () => {
  assert.equal(FLOW_WINDOW_DAYS, 30);
  assert.equal(isBuying(0), true);
  assert.equal(flowVerb(-1), 'sold');
  assert.equal(flowVerb(2), 'bought');
  assert.equal(flowDirection(-1), 'selling');
  assert.equal(signedCrore(1234), '+₹1.23K Cr');
  assert.equal(signedCrore(-250), '−₹250 Cr');
});

test('the pair is built newest-first with the streak of the latest direction', () => {
  const rows = [
    row('2026-09-09', 'nse_fii', -100),
    row('2026-09-11', 'nse_fii', -300),
    row('2026-09-10', 'nse_fii', 50),
    row('2026-09-08', 'nse_fii', null),
    row('2026-09-11', 'nse_dii', 200),
    row('2026-09-10', 'nse_dii', 150),
  ];
  const [fii, dii] = buildFlowPair(rows);
  assert.ok(fii && dii);
  assert.equal(fii.label, 'FII');
  assert.equal(fii.net, -300);
  assert.equal(fii.date, '2026-09-11');
  assert.equal(fii.streak, 1);
  assert.equal(fii.streakAtWindowEdge, false);
  assert.deepEqual(fii.series, [-100, 50, -300]);
  assert.equal(fii.cumulative, -350);
  assert.equal(dii.streak, 2);
  assert.equal(dii.streakAtWindowEdge, true);
});

test('one side alone is nothing — the pair is the unit of meaning', () => {
  assert.deepEqual(buildFlowPair([row('2026-09-11', 'nse_fii', 1)]), []);
  assert.deepEqual(buildFlowPair([]), []);
});
