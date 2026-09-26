import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  OWNERSHIP_BY_CODE,
  OWNERSHIP_HEADLINE,
  OWNERSHIP_TREE,
} from '../ownership.ts';
import {PROFIT_LOSS_SCHEMA} from '../profitLoss.ts';
import {QUARTERLY_SCHEMA} from '../quarterly.ts';
import {
  ADJ_EPS_HINT,
  REPORTED_EPS_HINT,
  type FormatFamily,
  type GroupSpec,
  type LineSpec,
} from '../schema.ts';

const FAMILIES: FormatFamily[] = ['general', 'bank', 'lender'];

function lineIn(groups: readonly GroupSpec[], key: string): LineSpec {
  const line = groups.flatMap(g => g.lines).find(l => l.key === key);
  assert.ok(line, `no ${key} line`);
  return line;
}

test('the annual EPS reads the adjusted figure; the as-filed ones wait at tier 3', () => {
  for (const family of FAMILIES) {
    const schema = PROFIT_LOSS_SCHEMA[family];
    assert.deepEqual(lineIn(schema, 'Adj_Eps'), {
      key: 'Adj_Eps',
      label: 'EPS in ₹',
      tier: 1,
      kind: 'rupees',
      hint: ADJ_EPS_HINT,
    });
    assert.deepEqual(lineIn(schema, 'Reported_EPS'), {
      key: 'Reported_EPS',
      label: 'Reported EPS',
      tier: 3,
      kind: 'rupees',
      hint: REPORTED_EPS_HINT,
    });
  }
  for (const family of ['general', 'lender'] as const) {
    assert.deepEqual(lineIn(PROFIT_LOSS_SCHEMA[family], 'EPS'), {
      key: 'EPS',
      label: 'EPS as filed',
      tier: 3,
      kind: 'rupees',
      hint: REPORTED_EPS_HINT,
    });
  }
  const bankKeys = PROFIT_LOSS_SCHEMA.bank.flatMap(g =>
    g.lines.map(l => l.key),
  );
  assert.ok(!bankKeys.includes('EPS'));
});

test('each family leads with the line it earns on', () => {
  const lead = (groups: readonly GroupSpec[]): string | undefined =>
    groups[0]?.lines[0]?.label;
  assert.equal(lead(PROFIT_LOSS_SCHEMA.general), 'Net sales');
  assert.equal(lead(PROFIT_LOSS_SCHEMA.bank), 'Interest earned');
  assert.equal(lead(PROFIT_LOSS_SCHEMA.lender), 'Revenue from operations');
  assert.equal(lead(QUARTERLY_SCHEMA.general), 'Net sales');
  assert.equal(lead(QUARTERLY_SCHEMA.bank), 'Interest earned');
  assert.equal(
    lineIn(PROFIT_LOSS_SCHEMA.lender, 'Interest').label,
    'Finance cost',
  );
});

test('the lender and the bank borrow the general groups below their own', () => {
  const ids = (groups: readonly GroupSpec[]): string[] => groups.map(g => g.id);
  assert.deepEqual(ids(PROFIT_LOSS_SCHEMA.lender), [
    'revenue',
    'costs',
    'profit',
    'pershare',
    'appropriation',
  ]);
  assert.deepEqual(ids(QUARTERLY_SCHEMA.bank), [
    'income',
    'costs',
    'asset-quality',
    'network',
    'profit',
    'margins',
    'comprehensive',
    'capital',
  ]);
  assert.equal(QUARTERLY_SCHEMA.lender, QUARTERLY_SCHEMA.general);
  for (const schema of [PROFIT_LOSS_SCHEMA, QUARTERLY_SCHEMA]) {
    for (const family of FAMILIES) {
      const groupIds = ids(schema[family]);
      assert.equal(new Set(groupIds).size, groupIds.length);
    }
  }
});

test('the ownership tree reads promoter-family holdings apart from retail', () => {
  assert.equal(OWNERSHIP_BY_CODE.size, OWNERSHIP_TREE.length);
  for (const node of OWNERSHIP_TREE) {
    assert.equal(OWNERSHIP_BY_CODE.get(node.code), node);
  }
  for (const {code} of OWNERSHIP_HEADLINE) {
    assert.ok(OWNERSHIP_BY_CODE.has(code), `${code} is not in the tree`);
  }
  // INDindivd is the promoter family's own stake, under Indian promoters;
  // public individuals are NINIndivd, under non-institutions.
  const at = (code: string): number =>
    OWNERSHIP_TREE.findIndex(n => n.code === code);
  assert.ok(at('INDSubtotal') < at('INDindivd'));
  assert.ok(at('INDindivd') < at('Totalpublic'));
  assert.ok(at('NINSubtotal') < at('NINIndivd'));
  assert.equal(OWNERSHIP_BY_CODE.get('INDindivd')?.label, 'Individuals & HUF');
  assert.equal(
    OWNERSHIP_HEADLINE.find(h => h.label === 'Retail')?.code,
    'NINIndivd',
  );
  const totals = OWNERSHIP_TREE.filter(n => n.total).map(n => n.code);
  assert.deepEqual(totals, ['Ftotalpromoter', 'Totalpublic', 'GrandTotal']);
});
