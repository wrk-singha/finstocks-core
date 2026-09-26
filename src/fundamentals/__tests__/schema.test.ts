import assert from 'node:assert/strict';
import {test} from 'node:test';

import {PROFIT_LOSS_SCHEMA} from '../profitLoss.ts';
import {QUARTERLY_SCHEMA} from '../quarterly.ts';
import {
  atTier,
  formatFamily,
  hiddenCount,
  prettifyKey,
  resolveGroups,
  type GroupSpec,
  type ResolvedGroup,
  type Tier,
} from '../schema.ts';

const keysOf = (groups: ResolvedGroup[]): string[] =>
  groups.flatMap(g => g.lines.map(l => l.key));

test('formatFamily collapses the vendor formats to three layouts', () => {
  assert.equal(formatFamily('BNK'), 'bank');
  assert.equal(formatFamily('bnk'), 'bank');
  assert.equal(formatFamily('FIN'), 'lender');
  assert.equal(formatFamily('INS'), 'lender');
  assert.equal(formatFamily('MFG'), 'general');
  assert.equal(formatFamily(''), 'general');
  assert.equal(formatFamily(undefined), 'general');
  assert.equal(formatFamily(), 'general');
});

test('prettifyKey spaces a vendor key without expanding its abbreviations', () => {
  assert.equal(prettifyKey('Sellg_Admn_Exps'), 'Sellg Admn Exps');
  assert.equal(prettifyKey('priting_stationery'), 'Priting stationery');
  assert.equal(
    prettifyKey('NetProfit_OwnOfParent'),
    'Net Profit Own Of Parent',
  );
  assert.equal(prettifyKey('eps2Diluted'), 'Eps2 Diluted');
  assert.equal(prettifyKey('__'), '__');
  assert.equal(prettifyKey(''), '');
});

const SCHEMA: GroupSpec[] = [
  {
    id: 'revenue',
    title: 'Revenue',
    tier: 1,
    lines: [
      {key: 'Net_sales', label: 'Net sales', tier: 1, total: true},
      {key: 'Excise', label: 'Excise', tier: 3, expense: true},
      {key: 'Other_income', label: 'Other income', tier: 2},
    ],
  },
  {
    id: 'detail',
    title: 'Detail',
    tier: 2,
    lines: [
      {key: 'Headline', label: 'Headline', tier: 1},
      {key: 'Working', label: 'Working', tier: 2},
    ],
  },
  {
    id: 'empty',
    title: 'Nothing filed',
    tier: 1,
    lines: [{key: 'Never_filed', label: 'Never filed', tier: 1}],
  },
];

test('resolveGroups keeps the specced lines and files the rest under "As reported"', () => {
  const groups = resolveGroups(SCHEMA, {
    Net_sales: [100, 90],
    // Zero-filled in every period: the quarterly feed's "not reported".
    Excise: [0, 0],
    // A zero in some periods is a fact worth a row.
    Other_income: [0, 4],
    Headline: [null, 7],
    Never_filed: [null, null],
    Zeta_line: [1, 2],
    alpha_Extra: [3, null],
    Blank_line: [0, null],
  });

  assert.deepEqual(
    groups.map(g => g.id),
    ['revenue', 'detail', 'as-reported'],
  );
  const revenue = groups[0];
  assert.deepEqual(revenue?.lines, [
    {
      key: 'Net_sales',
      label: 'Net sales',
      tier: 1,
      total: true,
      values: [100, 90],
      known: true,
    },
    {
      key: 'Other_income',
      label: 'Other income',
      tier: 2,
      values: [0, 4],
      known: true,
    },
  ]);
  assert.deepEqual(groups[2], {
    id: 'as-reported',
    title: 'As reported',
    tier: 3,
    lines: [
      {
        key: 'alpha_Extra',
        label: 'Alpha Extra',
        tier: 3,
        kind: 'currency',
        values: [3, null],
        known: false,
      },
      {
        key: 'Zeta_line',
        label: 'Zeta line',
        tier: 3,
        kind: 'currency',
        values: [1, 2],
        known: false,
      },
    ],
  });
});

test('resolveGroups returns nothing without items and names the extra group on request', () => {
  assert.deepEqual(resolveGroups(SCHEMA, undefined), []);
  assert.deepEqual(resolveGroups(SCHEMA, {}), []);
  const [extra] = resolveGroups(SCHEMA, {Unknown: [5]}, 'Everything else');
  assert.equal(extra?.title, 'Everything else');
  assert.deepEqual(keysOf(extra ? [extra] : []), ['Unknown']);
});

test('a headline line nested in a detail group shows at tier 1, and the count agrees', () => {
  const groups = resolveGroups(SCHEMA, {
    Net_sales: [100],
    Excise: [3],
    Other_income: [4],
    Headline: [7],
    Working: [8],
  });

  const tier1 = atTier(groups, 1);
  assert.deepEqual(
    tier1.map(g => [g.id, g.lines.map(l => l.key)]),
    [
      ['revenue', ['Net_sales']],
      ['detail', ['Headline']],
    ],
  );
  assert.deepEqual(keysOf(atTier(groups, 2)), [
    'Net_sales',
    'Other_income',
    'Headline',
    'Working',
  ]);
  assert.deepEqual(keysOf(atTier(groups, 3)), [
    'Net_sales',
    'Excise',
    'Other_income',
    'Headline',
    'Working',
  ]);

  assert.equal(hiddenCount(groups, 1), 3);
  assert.equal(hiddenCount(groups, 2), 1);
  assert.equal(hiddenCount(groups, 3), 0);
  const total = keysOf(groups).length;
  for (const tier of [1, 2, 3] as Tier[]) {
    assert.equal(
      keysOf(atTier(groups, tier)).length + hiddenCount(groups, tier),
      total,
    );
  }
});

test("a bank's total income, filed under other income, is on screen at tier 1", () => {
  const groups = resolveGroups(PROFIT_LOSS_SCHEMA.bank, {
    Interest_earned: [900],
    Interest_Other_income: [120],
    Total_income: [1020],
  });
  const tier1 = atTier(groups, 1);
  assert.deepEqual(
    tier1.map(g => [g.id, g.lines.map(l => l.label)]),
    [
      ['interest-earned', ['Interest earned']],
      ['other-income', ['Total income']],
    ],
  );
  assert.equal(hiddenCount(groups, 1), 1);
});

test('every filed key comes back exactly once, whatever the family', () => {
  for (const schema of [PROFIT_LOSS_SCHEMA, QUARTERLY_SCHEMA]) {
    for (const groups of Object.values(schema)) {
      const items = Object.fromEntries(
        [
          ...groups.flatMap(g => g.lines.map(l => l.key)),
          'Vendor_new_line',
        ].map(key => [key, [1]]),
      );
      const keys = keysOf(resolveGroups(groups, items));
      assert.deepEqual([...keys].sort(), Object.keys(items).sort());
    }
  }
});

test('a line two specs name is read once, at the depth it first shows', () => {
  const lender = resolveGroups(PROFIT_LOSS_SCHEMA.lender, {
    Net_sales: [500],
    Interest: [120],
    Profit_before_tax: [200],
  });
  assert.deepEqual(
    atTier(lender, 1).map(g => [g.id, g.lines.map(l => l.label)]),
    [
      ['revenue', ['Revenue from operations']],
      ['costs', ['Finance cost']],
      ['profit', ['Profit before tax']],
    ],
  );

  const bankQuarter = resolveGroups(QUARTERLY_SCHEMA.bank, {
    Net_Sales: [900],
    Interest: [400],
    Depreciation: [20],
    Pbt: [150],
  });
  // Interest ties at tier 1 and stays with the bank's own costs; depreciation
  // keeps the tier-1 row the borrowed profit group gives it, not the tier-3
  // one under costs, so it is on screen exactly where it was.
  assert.deepEqual(
    bankQuarter.map(g => [g.id, g.lines.map(l => [l.key, l.label, l.tier])]),
    [
      ['income', [['Net_Sales', 'Interest earned', 1]]],
      ['costs', [['Interest', 'Interest expended', 1]]],
      [
        'profit',
        [
          ['Depreciation', 'Depreciation', 1],
          ['Pbt', 'Profit before tax', 1],
        ],
      ],
    ],
  );
  assert.equal(hiddenCount(bankQuarter, 1), 0);
});
