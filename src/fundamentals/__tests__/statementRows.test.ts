import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  annualTable,
  daysOf,
  filed,
  has,
  oldestFirst,
  or,
  orZero,
  pctOf,
  reader,
  rest,
  row,
  withChildren,
  yoy,
  zip,
} from '../statementRows.ts';
import {round, series} from './filings.ts';

test('has reads a column as filed only when some value is non-zero', () => {
  assert.equal(has([null, 0, 3]), true);
  assert.equal(has([-1]), true);
  assert.equal(has([0, 0]), false);
  assert.equal(has([null, null]), false);
  assert.equal(has([]), false);
});

test('zip leaves a column empty when any input is missing or the result is not finite', () => {
  assert.deepEqual(
    zip(
      [
        [1, 2, null, 4],
        [10, null, 30, 40],
        [100, 200, 300, 0],
      ],
      (a, b, c) => (c === 0 ? a / c : a + b + c),
    ),
    [111, null, null, null],
  );
  assert.deepEqual(
    zip([[1, 2]], () => null),
    [null, null],
  );
  // A shorter input reads as unfiled past its end.
  assert.deepEqual(
    zip([[1, 2, 3], [1]], (a, b) => a + b),
    [2, null, null],
  );
  assert.deepEqual(
    zip([], () => 1),
    [],
  );
});

test('pctOf keeps a negative base and blanks only a zero one', () => {
  assert.deepEqual(pctOf([25, -2, 5, null], [100, -10, 0, 50]), [
    25,
    20,
    null,
    null,
  ]);
});

test('daysOf reads over a 365-day year against a positive base only', () => {
  assert.deepEqual(round(daysOf([50, 50, 50], [365, 0, -365])), [
    50,
    null,
    null,
  ]);
});

test('or fills the gaps of one column from another; orZero reads a gap as zero', () => {
  assert.deepEqual(or([1, null, null], [9, 8, null]), [1, 8, null]);
  assert.deepEqual(or([null, null], [7]), [7, null]);
  assert.deepEqual(orZero([null, 2, 0]), [0, 2, 0]);
});

test('rest is the total less every named part, with float residue snapped to zero', () => {
  assert.deepEqual(
    rest(
      [100, 50, null],
      [
        [60, null, 1],
        [30, 20, 1],
      ],
    ),
    [10, 30, null],
  );
  assert.deepEqual(rest([0.3, 12], [[0.1, 1]]), [0, 11]);
  assert.deepEqual(rest([10.4], [[10]]), [0]);
});

test('yoy grows each value on the one before it, only from a positive base', () => {
  assert.deepEqual(round(yoy([100, 110, null, 50, -10, 5, 10])), [
    null,
    10,
    null,
    null,
    -120,
    null,
    100,
  ]);
});

test('row defaults to currency and takes what it is given', () => {
  assert.deepEqual(row('sales', 'Sales', [1, 2]), {
    id: 'sales',
    label: 'Sales',
    kind: 'currency',
    values: [1, 2],
  });
  assert.deepEqual(
    row('opm', 'OPM %', [10], {kind: 'pct', strong: true, hint: 'Why.'}),
    {
      id: 'opm',
      label: 'OPM %',
      kind: 'pct',
      values: [10],
      strong: true,
      hint: 'Why.',
    },
  );
});

test('withChildren offers a "+" only where the breakdown was filed', () => {
  const parent = row('p', 'Parent', [10, 20]);
  const filedChild = row('a', 'A', [0, 5]);
  const emptyChild = row('b', 'B', [null, 0]);
  assert.deepEqual(withChildren(parent, [filedChild, emptyChild]), {
    ...parent,
    children: [filedChild],
  });
  const bare = withChildren(parent, [emptyChild]);
  assert.equal(bare, parent);
  assert.ok(!('children' in bare));
});

test('filed drops the lines a company filed nothing against', () => {
  const kept = row('kept', 'Kept', [0, 1]);
  assert.deepEqual(filed([kept, row('zero', 'Zero', [0, 0])]), [kept]);
});

test('annualTable drops unfiled lines and the years no line has a figure for', () => {
  const table = annualTable(
    [2022, 2023, 2024, 2025],
    [
      withChildren(row('sales', 'Sales', [null, 10, null, 30]), [
        row('growth', 'Growth', [null, null, null, 200]),
      ]),
      row('stray', 'Stray', [0, 0, null, 0]),
      row('profit', 'Profit', [null, 1, null, 3], {strong: true}),
    ],
  );
  assert.deepEqual(table, {
    periods: [2023, 2025],
    rows: [
      {
        id: 'sales',
        label: 'Sales',
        kind: 'currency',
        values: [10, 30],
        children: [
          {
            id: 'growth',
            label: 'Growth',
            kind: 'currency',
            values: [null, 200],
          },
        ],
      },
      {
        id: 'profit',
        label: 'Profit',
        kind: 'currency',
        values: [1, 3],
        strong: true,
      },
    ],
  });
});

test('oldestFirst reverses the periods without touching the series', () => {
  const filing = series([2026, 2025, 2024], {X: [3, 2, 1]});
  assert.deepEqual(oldestFirst(filing), [2024, 2025, 2026]);
  assert.deepEqual(filing.periods, [2026, 2025, 2024]);
});

test('reader lines a series up by period, null where a year was not filed', () => {
  const filing = series([2026, 2025, 2023], {
    Sales: [30, 20, null],
    Short: [9],
  });
  const col = reader(filing, [2023, 2024, 2025, 2026]);
  assert.deepEqual(col('Sales'), [null, null, 20, 30]);
  assert.deepEqual(col('Short'), [null, null, null, 9]);
  assert.deepEqual(col('Missing'), [null, null, null, null]);
  assert.deepEqual(reader(undefined, [2025, 2026])('Sales'), [null, null]);
});
