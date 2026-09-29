import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  FundamentalsOwnership,
  OwnershipCategory,
} from '../../types/fundamentalsDetail.ts';
import {
  diiConstituents,
  latestPctIndex,
  type OwnershipBucket,
  ownershipBuckets,
} from '../ownershipSummary.ts';

type Pct = Record<string, (number | null)[]>;

/** A shareholding filing as the endpoint sends it: quarters and each category's percentages. */
const filing = (
  quarters: number[],
  pct: Pct,
  extra: OwnershipCategory[] = [],
): FundamentalsOwnership => ({
  quarters,
  categories: [
    ...Object.entries(pct).map(([code, values]) => ({code, pct: values})),
    ...extra,
  ],
});

const sum = (buckets: OwnershipBucket[]): number =>
  Math.round(buckets.reduce((total, b) => total + b.pct, 0) * 100) / 100;

// Two quarters of a manufacturer's pattern, newest first. Every subtotal is
// its leaves and every quarter totals 100: promoter 50.30, institutions 38.90
// (foreign 21.20, government 0.10, the domestic classes 17.60), and
// non-institutions 10.80.
const QUARTERS = [202606, 202603];
const PATTERN: Pct = {
  Ftotalpromoter: [50.3, 50.31],
  INDSubtotal: [50.3, 50.31],
  INDbodyCorp: [49.69, 49.7],
  INDindivd: [0.61, 0.61],
  Totalpublic: [49.7, 49.69],
  INSubtotal: [38.9, 38.9],
  INFII: [0.3, 0.3],
  INForeignPortInv: [20.9, 21.3],
  INMFUTI: [8.4, 8.2],
  INInsurance: [6.1, 6.0],
  INFIBanks: [0.3, 0.3],
  INProviPenFund: [2.0, 1.9],
  INAltInvFund: [0.8, 0.8],
  INcgovt: [0.1, 0.1],
  NINSubtotal: [10.8, 10.79],
  NINIndivd: [9.0, 9.29],
  NINbodyCorp: [1.1, 1.1],
  NINNRI: [0.4, 0.4],
  NINother: [0.3, 0.0],
  GrandTotal: [100, 100],
};

test('the buckets are cuts of the filed tree, so they add up to its grand total', () => {
  const ownership = filing(QUARTERS, PATTERN);
  assert.deepEqual(ownershipBuckets(ownership, 0), [
    {key: 'promoter', pct: 50.3},
    {key: 'fii', pct: 21.2},
    {key: 'dii', pct: 17.6},
    {key: 'government', pct: 0.1},
    {key: 'public', pct: 10.8},
  ]);
  assert.equal(sum(ownershipBuckets(ownership, 0)), 100);
  assert.deepEqual(ownershipBuckets(ownership, 1), [
    {key: 'promoter', pct: 50.31},
    {key: 'fii', pct: 21.6},
    {key: 'dii', pct: 17.2},
    {key: 'government', pct: 0.1},
    {key: 'public', pct: 10.79},
  ]);
  assert.equal(sum(ownershipBuckets(ownership, 1)), 100);
});

test('the order is the bucket order, whatever order the vendor files categories in', () => {
  const ownership = filing(QUARTERS, PATTERN);
  const reversed: FundamentalsOwnership = {
    ...ownership,
    categories: [...ownership.categories].reverse(),
  };
  assert.deepEqual(
    ownershipBuckets(reversed, 0),
    ownershipBuckets(ownership, 0),
  );
});

test('a vendor that files no DII figure still gets one, cut from its institutions', () => {
  // The domestic classes are not filed at all, only the institutions they sit in.
  const ownership = filing([202606], {
    Ftotalpromoter: [50.3],
    INSubtotal: [38.8],
    INFII: [0.3],
    INForeignPortInv: [20.9],
    NINSubtotal: [10.9],
  });
  const buckets = ownershipBuckets(ownership, 0);
  assert.deepEqual(buckets, [
    {key: 'promoter', pct: 50.3},
    {key: 'fii', pct: 21.2},
    {key: 'dii', pct: 17.6},
    {key: 'public', pct: 10.9},
  ]);
  assert.equal(sum(buckets), 100);
  assert.deepEqual(diiConstituents(ownership, 0), []);
});

test('an institutional class nobody has named still lands in DII, so the total stays whole', () => {
  const ownership = filing([202606], {
    Ftotalpromoter: [50.3],
    INSubtotal: [40.4],
    INFII: [0.3],
    INForeignPortInv: [20.9],
    INMFUTI: [8.4],
    INInsurance: [6.1],
    INFIBanks: [0.3],
    INProviPenFund: [2.0],
    INAltInvFund: [0.8],
    INcgovt: [0.1],
    // A class the vendor started filing that no list here names, inside the
    // institutions subtotal.
    INSovereignWealth: [1.5],
    NINSubtotal: [9.3],
  });
  const dii = ownershipBuckets(ownership, 0).find(b => b.key === 'dii');
  assert.equal(dii?.pct, 19.1);
  assert.equal(sum(ownershipBuckets(ownership, 0)), 100);
  // Named under DII only when it is one of the classes a reader expects.
  assert.ok(
    diiConstituents(ownership, 0).every(c => c.code !== 'INSovereignWealth'),
  );
});

test('with no institutions subtotal on file, DII is left out rather than guessed', () => {
  const ownership = filing([202606], {
    Ftotalpromoter: [50.3],
    INFII: [0.3],
    INForeignPortInv: [20.9],
    INMFUTI: [8.4],
    NINSubtotal: [10.9],
  });
  assert.deepEqual(ownershipBuckets(ownership, 0), [
    {key: 'promoter', pct: 50.3},
    {key: 'fii', pct: 21.2},
    {key: 'public', pct: 10.9},
  ]);
});

test('each bucket rounds to two decimals and none goes below zero', () => {
  // 38.8 - 21.2 is 17.599999999999998 in floating point.
  const ownership = filing([202606, 202603], {
    Ftotalpromoter: [50.3, 61.004],
    INSubtotal: [38.8, 20],
    INFII: [0.3, 0],
    INForeignPortInv: [20.9, 20.5],
    NINSubtotal: [10.9, 18.496],
  });
  assert.deepEqual(
    ownershipBuckets(ownership, 0).find(b => b.key === 'dii'),
    {key: 'dii', pct: 17.6},
  );
  // Foreign money filed above the institutions it sits in: DII would be
  // negative, so it is dropped instead of drawn.
  assert.deepEqual(ownershipBuckets(ownership, 1), [
    {key: 'promoter', pct: 61},
    {key: 'fii', pct: 20.5},
    {key: 'public', pct: 18.5},
  ]);
});

test('the newest quarter with a percentage is the one read, past one whose percentages have not landed', () => {
  const ownership = filing([202609, 202606], {}, [
    {code: 'Ftotalpromoter', pct: [null, 50.3], shares: [6.8e9, 6.8e9]},
    {code: 'NINSubtotal', pct: [null, 49.7], shares: [6.7e9, 6.7e9]},
  ]);
  assert.equal(latestPctIndex(ownership), 1);
  assert.deepEqual(ownershipBuckets(ownership, 1), [
    {key: 'promoter', pct: 50.3},
    {key: 'public', pct: 49.7},
  ]);
  assert.equal(latestPctIndex(filing(QUARTERS, PATTERN)), 0);

  const sharesOnly = filing([202609], {}, [
    {code: 'Ftotalpromoter', shares: [6.8e9]},
  ]);
  assert.equal(latestPctIndex(sharesOnly), -1);
  assert.deepEqual(ownershipBuckets(sharesOnly, -1), []);
  assert.deepEqual(diiConstituents(sharesOnly, -1), []);
  assert.equal(latestPctIndex({quarters: [], categories: []}), -1);
});

test('DII is broken into the classes a reader expects, in filing order, for the quarter asked', () => {
  const ownership = filing(QUARTERS, {
    ...PATTERN,
    INAltInvFund: [0, null],
  });
  assert.deepEqual(diiConstituents(ownership, 0), [
    {key: 'mutualFunds', code: 'INMFUTI', pct: 8.4},
    {key: 'insurance', code: 'INInsurance', pct: 6.1},
    {key: 'banks', code: 'INFIBanks', pct: 0.3},
    {key: 'pensionFunds', code: 'INProviPenFund', pct: 2.0},
  ]);
  assert.deepEqual(
    diiConstituents(ownership, 1).map(c => c.pct),
    [8.2, 6.0, 0.3, 1.9],
  );
});
