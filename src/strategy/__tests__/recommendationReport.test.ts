import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  istDayOfMonth,
  istYMD,
  MIN_EDGE_SAMPLE,
  monthlyGrid,
  MONTHS_SHOWN,
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

test('monthlyGrid fills the gaps between traded months and labels each cell', () => {
  const cells = monthlyGrid([
    {month: '2026-06', pnl: 1200, trades: 3},
    {month: '2026-09', pnl: -400, trades: 1},
  ]);
  assert.deepEqual(
    cells.map(c => [c.month, c.pnl, c.trades, c.label]),
    [
      ['2026-06', 1200, 3, 'Jun 26'],
      ['2026-07', 0, 0, 'Jul 26'],
      ['2026-08', 0, 0, 'Aug 26'],
      ['2026-09', -400, 1, 'Sep 26'],
    ],
  );
});

test('monthlyGrid keeps only the last twelve months and crosses a year boundary', () => {
  const cells = monthlyGrid([
    {month: '2024-11', pnl: 10, trades: 1},
    {month: '2026-02', pnl: 20, trades: 2},
  ]);
  assert.equal(cells.length, MONTHS_SHOWN);
  assert.equal(cells[0]?.month, '2025-03');
  assert.equal(cells[cells.length - 1]?.month, '2026-02');
  assert.equal(cells[9]?.label, 'Dec 25');
  assert.equal(cells[10]?.label, 'Jan 26');
  assert.deepEqual(monthlyGrid([]), []);
  assert.equal(MIN_EDGE_SAMPLE, 30);
});
