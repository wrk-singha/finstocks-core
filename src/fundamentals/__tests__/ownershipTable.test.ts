import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  FundamentalsOwnership,
  OwnershipCategory,
} from '../../types/fundamentalsDetail.ts';
import {ownershipRowsAtTier, ownershipTableRows} from '../ownershipTable.ts';

const QUARTERS = [202606, 202603];

// Two quarters of a pattern, filed deliberately out of the tree's order and
// with one class (a sovereign fund) that the tree does not name.
const CATEGORIES: OwnershipCategory[] = [
  {code: 'GrandTotal', pct: [100, 100], shares: [6766e6, 6766e6]},
  {code: 'NINIndivd', pct: [9.0, 9.29], holders: [3_588_000, 3_534_180]},
  {code: 'INSovereignWealth', pct: [1.5, 1.4]},
  {
    code: 'Ftotalpromoter',
    pct: [50.3, 50.31],
    shares: [3403e6, 3404e6],
    pledge_pct: [1.41, 1.12],
  },
  {code: 'INMFUTI', pct: [8.4, 8.2], holders: [46, 45]},
  {code: 'INInsurance', pct: [6.1, 6.0], holders: [31, 31]},
  {code: 'INcgovt', pct: [0.1, 0.1]},
  {code: 'INSubtotal', pct: [40.4, 40.0], holders: [2_161, 2_130]},
  {code: 'Totalpublic', pct: [49.7, 49.69]},
  {code: 'NINSubtotal', pct: [9.3, 9.69]},
  // Filed, but with nothing in it for any measure.
  {code: 'INVenCap', pct: [null, null], holders: [null, null]},
];

const filing: FundamentalsOwnership = {
  quarters: QUARTERS,
  categories: CATEGORIES,
};

test("the percentages follow the tree's order, with its labels, depths and totals", () => {
  const rows = ownershipTableRows(filing, 'pct');
  assert.deepEqual(
    rows.map(r => [r.code, r.label, r.tier, r.depth, r.total]),
    [
      ['Ftotalpromoter', 'Promoter & promoter group', 1, 0, true],
      ['Totalpublic', 'Public', 1, 0, true],
      ['INSubtotal', 'Institutions', 1, 1, false],
      ['INMFUTI', 'Mutual funds & UTI', 1, 2, false],
      ['INInsurance', 'Insurance companies', 2, 2, false],
      ['INcgovt', 'Government', 3, 2, false],
      ['NINSubtotal', 'Non-institutions', 1, 1, false],
      ['NINIndivd', 'Individuals', 1, 2, false],
      ['GrandTotal', 'Total', 2, 0, true],
      // Not in the tree: last, at the deepest tier, under its filed code.
      ['INSovereignWealth', 'INSovereign Wealth', 3, 2, false],
    ],
  );
  assert.deepEqual(rows[0]?.values, [50.3, 50.31]);
  assert.equal(
    rows[0]?.hint,
    'The founding or controlling shareholders, Indian and foreign combined.',
  );
  assert.equal('hint' in (rows[3] ?? {}), false);
});

test('each measure keeps only the categories filed for it', () => {
  assert.deepEqual(
    ownershipTableRows(filing, 'holders').map(r => r.code),
    ['INSubtotal', 'INMFUTI', 'INInsurance', 'NINIndivd'],
  );
  assert.deepEqual(
    ownershipTableRows(filing, 'shares').map(r => [r.code, r.values]),
    [
      ['Ftotalpromoter', [3403e6, 3404e6]],
      ['GrandTotal', [6766e6, 6766e6]],
    ],
  );
  // A category filed empty for every measure never becomes a row of dashes.
  for (const measure of ['pct', 'shares', 'holders'] as const) {
    assert.ok(
      ownershipTableRows(filing, measure).every(r => r.code !== 'INVenCap'),
    );
  }
});

test('every row has one value per quarter, however many the vendor sent', () => {
  const ragged: FundamentalsOwnership = {
    quarters: [202606, 202603, 202512],
    categories: [
      {code: 'Ftotalpromoter', pct: [50.3]},
      {code: 'Totalpublic', pct: [49.7, 49.69, 49.6, 49.5]},
      {code: 'INSubtotal', pct: [null, 40]},
    ],
  };
  assert.deepEqual(
    ownershipTableRows(ragged, 'pct').map(r => r.values),
    [
      [50.3, null, null],
      [49.7, 49.69, 49.6],
      [null, 40, null],
    ],
  );
  assert.deepEqual(
    ownershipTableRows({quarters: [], categories: []}, 'pct'),
    [],
  );
});

test('a tier shows its own rows and every shallower one, and counts the rest', () => {
  const rows = ownershipTableRows(filing, 'pct');
  const first = ownershipRowsAtTier(rows, 1);
  assert.deepEqual(
    first.shown.map(r => r.code),
    [
      'Ftotalpromoter',
      'Totalpublic',
      'INSubtotal',
      'INMFUTI',
      'NINSubtotal',
      'NINIndivd',
    ],
  );
  assert.equal(first.hidden, 4);
  assert.equal(ownershipRowsAtTier(rows, 2).hidden, 2);
  const every = ownershipRowsAtTier(rows, 3);
  assert.equal(every.shown.length, rows.length);
  assert.equal(every.hidden, 0);
});
