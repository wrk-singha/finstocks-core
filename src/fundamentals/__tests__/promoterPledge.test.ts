import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  FundamentalsOwnership,
  OwnershipCategory,
} from '../../types/fundamentalsDetail.ts';
import {promoterPledge} from '../promoterPledge.ts';

const QUARTERS = [202606, 202603, 202512, 202509];

const withPromoter = (
  promoter: Omit<OwnershipCategory, 'code'>,
  quarters: number[] = QUARTERS,
): FundamentalsOwnership => ({
  quarters,
  categories: [
    {code: 'NINSubtotal', pct: [49.7, 49.7, 49.7, 49.7]},
    {code: 'Ftotalpromoter', ...promoter},
  ],
});

test('the newest filed quarter leads, moved against the filed quarter before it', () => {
  const pledge = promoterPledge(
    withPromoter({
      pct: [50.3, 50.3, 50.3, 50.3],
      pledge_pct: [1.41, null, 1.12, 0.6],
      pledge_shares: [48_000_000, null, 38_100_000, 20_400_000],
    }),
  );
  assert.deepEqual(pledge, {
    pct: 1.41,
    quarter: 202606,
    // Against December: September was not filed, so it is skipped.
    change: 0.29,
    shares: 48_000_000,
    history: [
      {quarter: 202509, pct: 0.6},
      {quarter: 202512, pct: 1.12},
      {quarter: 202603, pct: null},
      {quarter: 202606, pct: 1.41},
    ],
    peak: 1.41,
  });
});

test('a quarter whose pledge has not landed yet gives way to the one before it', () => {
  const pledge = promoterPledge(
    withPromoter({
      pledge_pct: [null, 2.5, 3],
      pledge_shares: [null, 81_000_000],
    }),
  );
  assert.equal(pledge?.pct, 2.5);
  assert.equal(pledge?.quarter, 202603);
  assert.equal(pledge?.change, -0.5);
  assert.equal(pledge?.shares, 81_000_000);
  assert.equal(pledge?.peak, 3);
  assert.deepEqual(
    pledge?.history.map(q => q.pct),
    [null, 3, 2.5, null],
  );
});

test('a pledge released to nothing still reads, as a fall to zero', () => {
  const pledge = promoterPledge(withPromoter({pledge_pct: [0, 1.2, 1.2, 1.2]}));
  assert.equal(pledge?.pct, 0);
  assert.equal(pledge?.change, -1.2);
  assert.equal(pledge?.shares, null);
});

test('with a single filed quarter there is a level and no change', () => {
  const pledge = promoterPledge(withPromoter({pledge_pct: [0.8]}, [202606]));
  assert.equal(pledge?.pct, 0.8);
  assert.equal(pledge?.change, null);
  assert.deepEqual(pledge?.history, [{quarter: 202606, pct: 0.8}]);
});

test('nothing pledged in any quarter is no pledge at all, not a row of zeros', () => {
  assert.equal(promoterPledge(withPromoter({pledge_pct: [0, 0, 0, 0]})), null);
  assert.equal(
    promoterPledge(withPromoter({pledge_pct: [null, null, null, null]})),
    null,
  );
  assert.equal(promoterPledge(withPromoter({pct: [50.3]})), null);
  assert.equal(promoterPledge({quarters: QUARTERS, categories: []}), null);
});
