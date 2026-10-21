import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  closedTradeEntry,
  closedTradeReturnPct,
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

// Report rows since backend-go 5295af0e / aaafcc28 may carry the fill and the stored return; web
// f72ddef6 shows each row's return in % from them.
const trade = {
  direction: 'long',
  entry_min: 1000,
  resolved_price: 1030,
};

test('closedTradeReturnPct reads the stored return first, the stored 0 and a loss included', () => {
  assert.equal(closedTradeReturnPct({...trade, return_pct: 2.794}), 2.794);
  assert.equal(closedTradeReturnPct({...trade, return_pct: 0}), 0);
  assert.equal(
    closedTradeReturnPct({...trade, direction: 'short', return_pct: -1.25}),
    -1.25,
  );
  // Stored, it is not re-derived from the prices, whatever they say.
  assert.equal(
    closedTradeReturnPct({...trade, entry_price: 1002, return_pct: 2.5}),
    2.5,
  );
});

test('closedTradeReturnPct derives from the stored fill, else the entry zone, a short flipped', () => {
  assert.equal(
    closedTradeReturnPct({...trade, entry_price: 1025, resolved_price: 1066}),
    ((1066 - 1025) / 1025) * 100,
  );
  // An older row: no fill, so the entry zone's low edge, as web reads it.
  assert.equal(closedTradeReturnPct(trade), 3);
  assert.equal(
    closedTradeReturnPct({...trade, entry_price: null, return_pct: null}),
    3,
  );
  assert.equal(closedTradeReturnPct({...trade, direction: 'short'}), -3);
  // The Short tag reads the side whatever its case; the return does too.
  assert.equal(closedTradeReturnPct({...trade, direction: 'SHORT'}), -3);
  // A stored figure that is not a number is not one.
  assert.equal(
    closedTradeReturnPct({
      ...trade,
      return_pct: Number.NaN,
      entry_price: Number.POSITIVE_INFINITY,
    }),
    3,
  );
});

test('closedTradeReturnPct is null rather than a made-up figure when the prices cannot back one', () => {
  assert.equal(closedTradeReturnPct({...trade, resolved_price: null}), null);
  // The report sends 0 for an entry it has none of.
  assert.equal(closedTradeReturnPct({...trade, entry_min: 0}), null);
  assert.equal(
    closedTradeReturnPct({...trade, entry_min: 0, entry_price: 0}),
    null,
  );
  assert.equal(
    closedTradeReturnPct({...trade, entry_min: 0, entry_price: -5}),
    null,
  );
  // An exit that is no price is no figure, not -100% (or +100% for a short).
  assert.equal(closedTradeReturnPct({...trade, resolved_price: 0}), null);
  assert.equal(
    closedTradeReturnPct({...trade, direction: 'short', resolved_price: 0}),
    null,
  );
  assert.equal(closedTradeReturnPct({...trade, resolved_price: -5}), null);
  assert.equal(
    closedTradeReturnPct({...trade, resolved_price: Number.NaN}),
    null,
  );
  // A stored figure still stands whatever the exit says.
  assert.equal(
    closedTradeReturnPct({...trade, resolved_price: 0, return_pct: -2.1}),
    -2.1,
  );
});

test('closedTradeEntry is the stored fill when there is one, else the entry zone low, else none', () => {
  assert.equal(
    closedTradeEntry({entry_min: 1000, entry_price: 1004.5}),
    1004.5,
  );
  assert.equal(closedTradeEntry({entry_min: 1000}), 1000);
  assert.equal(closedTradeEntry({entry_min: 1000, entry_price: null}), 1000);
  assert.equal(closedTradeEntry({entry_min: 1000, entry_price: 0}), 1000);
  assert.equal(
    closedTradeEntry({entry_min: 1000, entry_price: Number.NaN}),
    1000,
  );
  // The report's 0 for an entry zone it has none of is no price.
  assert.equal(closedTradeEntry({entry_min: 0}), null);
  assert.equal(closedTradeEntry({entry_min: 0, entry_price: -2}), null);
  assert.equal(closedTradeEntry({entry_min: 0, entry_price: 998}), 998);
});
