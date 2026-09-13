import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  istDayOfMonth,
  istYMD,
  tradeReturnPct,
} from '../recommendationReport.ts';

test('tradeReturnPct is signed by direction and null when unresolved', () => {
  assert.equal(
    tradeReturnPct({resolved_price: 110, entry_min: 100, direction: 'long'}),
    10,
  );
  assert.ok(
    Math.abs(
      (tradeReturnPct({
        resolved_price: 110,
        entry_min: 100,
        direction: 'short',
      }) ?? 0) + 10,
    ) < 1e-12,
  );
  assert.equal(
    tradeReturnPct({resolved_price: null, entry_min: 100, direction: 'long'}),
    null,
  );
  assert.equal(
    tradeReturnPct({resolved_price: 110, entry_min: 0, direction: 'long'}),
    null,
  );
});

test('istYMD buckets a UTC timestamp on the IST calendar day, Postgres spelling included', () => {
  assert.deepEqual(istYMD('2026-08-31T20:00:24Z'), {y: 2026, m: 9, d: 1});
  assert.deepEqual(istYMD('2026-08-31 20:00:24+00'), {y: 2026, m: 9, d: 1});
  assert.equal(istDayOfMonth('2026-08-31T10:00:00Z'), 31);
  assert.equal(istYMD('junk'), null);
  assert.equal(istDayOfMonth(''), null);
});
