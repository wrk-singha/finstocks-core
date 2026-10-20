import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {RecommendationRow} from '../../types/market.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

// Rows as backend-go 4c8bf631 serves them (`repository.Recommendation`, every field, Go's
// time.Time as RFC3339 and nil pointers as null).
const row = (fields: Partial<RecommendationRow> = {}): RecommendationRow => ({
  id: 101,
  market: 'IN',
  kind: 'equity',
  horizon: 'intraday',
  symbol: 'RELIANCE-NSE',
  direction: 'long',
  legs: null,
  remark: 'Breakout retest',
  rationale: 'Held the 20-day high on volume.',
  hold_label: 'Same day',
  entry_min: 1420,
  entry_max: 1432,
  stop_loss_min: 1385,
  stop_loss_max: 1392,
  target_min: 1490,
  target_max: 1500,
  modify_min: null,
  modify_max: null,
  modify_note: null,
  published_at: '2026-10-20T03:40:00Z',
  valid_until: '2026-10-20T09:55:00Z',
  updated_at: '2026-10-20T03:40:00Z',
  status: 'open',
  exit_at: null,
  exit_price: null,
  exit_reason: null,
  realized_pnl: null,
  return_pct: null,
  ...fields,
});

const shortRow = row({
  id: 102,
  symbol: 'INFY-NSE',
  direction: 'short',
  entry_min: 1480,
  entry_max: 1492,
  stop_loss_min: 1510,
  stop_loss_max: 1518,
  target_min: 1440,
  target_max: 1450,
});

const read = async (body: unknown) =>
  marketApi(fakeHttp([body]).http).getRecommendations({horizon: 'intraday'});

test('a long pick reads as a Buy, priced at its zone edges, with no live price', async () => {
  const {recommendations} = await read({recommendations: [row()]});
  assert.equal(recommendations.length, 1);
  const [pick] = recommendations;
  assert.ok(pick);
  assert.equal(pick.stock_symbol, 'RELIANCE');
  assert.equal(pick.direction, 'long');
  assert.equal(pick.verdict, 'Buy');
  assert.equal(pick.tone, 'pos');
  assert.equal(pick.entry_min, 1420);
  assert.equal(pick.entry_max, 1432);
  // A long's stop is the top of its stop zone, its target the bottom of its target zone.
  assert.equal(pick.stop_loss, 1392);
  assert.deepEqual(pick.stop_loss_zone, [1385, 1392]);
  assert.equal(pick.target_price, 1490);
  assert.deepEqual(pick.target_zone, [1490, 1500]);
  // No live price: cmp stays null, and the row's figures are read at the entry midpoint.
  assert.equal(pick.cmp, null);
  assert.equal(pick.ref_price, 1426);
  assert.equal(pick.ref_basis, 'entry_mid');
  assert.equal(pick.upside_pct, ((1490 - 1426) / 1426) * 100);
  assert.equal(pick.risk_reward, (1490 - 1426) / (1426 - 1392));
  assert.equal(pick.status, 'active');
  assert.equal(pick.hold_label, 'Same day');
  assert.equal(pick.remark, 'Breakout retest');
  assert.equal(pick.rationale, 'Held the 20-day high on volume.');
  assert.equal(pick.published_at, '2026-10-20T03:40:00Z');
  assert.equal(pick.modify_zone, null);
  assert.equal('realized_pnl' in pick, false);
  assert.equal('resolved_price' in pick, false);
  assert.equal('conviction_pct' in pick, false);
});

test('a short pick reads as a Sell, its stop the bottom of its zone and its target the top', async () => {
  const {recommendations} = await read({recommendations: [shortRow]});
  const [pick] = recommendations;
  assert.ok(pick);
  assert.equal(pick.stock_symbol, 'INFY');
  assert.equal(pick.direction, 'short');
  assert.equal(pick.verdict, 'Sell');
  assert.equal(pick.tone, 'cau');
  assert.equal(pick.stop_loss, 1510);
  assert.equal(pick.target_price, 1450);
  assert.equal(pick.ref_price, 1486);
  assert.equal(pick.upside_pct, ((1486 - 1450) / 1486) * 100);
  assert.equal(pick.risk_reward, (1486 - 1450) / (1510 - 1486));
});

test('only plain equity picks are kept: neutral, legs, the portfolio and commodities are dropped', async () => {
  const {recommendations} = await read({
    recommendations: [
      row({id: 1}),
      row({id: 2, direction: 'neutral'}),
      row({
        id: 3,
        symbol: 'NIFTY-NSE',
        legs: [
          {
            instrument: 'NIFTY26OCT24500CE-NSE',
            side: 'buy',
            lots: 1,
            entry: 120,
          },
        ],
      }),
      row({id: 4, horizon: 'portfolio'}),
      row({id: 5, kind: 'commodity', symbol: 'GOLD-MCX'}),
      row({id: 6, legs: []}),
    ],
  });
  assert.deepEqual(
    recommendations.map(pick => pick.id),
    [1],
  );
});

test('a row missing any zone edge, or with one that is not a positive number, is dropped', async () => {
  const edges = [
    'entry_min',
    'entry_max',
    'stop_loss_min',
    'stop_loss_max',
    'target_min',
    'target_max',
  ] as const;
  for (const edge of edges) {
    for (const bad of [null, 0, -5, Number.NaN]) {
      const {recommendations} = await read({
        recommendations: [row({[edge]: bad})],
      });
      assert.deepEqual(recommendations, [], `${edge} = ${String(bad)}`);
    }
  }
  const {recommendations} = await read({
    recommendations: [row({[edges[0]]: '1420' as unknown as number})],
  });
  assert.deepEqual(recommendations, []);
});

test('a zone written high to low, or a stop or target on the wrong side of the entry, is dropped', async () => {
  const {recommendations} = await read({
    recommendations: [
      row({id: 1, entry_min: 1432, entry_max: 1420}),
      // A long whose stop sits above its entry.
      row({id: 2, stop_loss_min: 1440, stop_loss_max: 1445}),
      // A long whose target sits below its entry.
      row({id: 3, target_min: 1400, target_max: 1410}),
      // A short read with a long's levels.
      row({id: 4, direction: 'short'}),
      row({id: 5}),
    ],
  });
  assert.deepEqual(
    recommendations.map(pick => pick.id),
    [5],
  );
});

test('a row that is not a row at all, or has no id, symbol, side or status, is dropped and never thrown on', async () => {
  const {recommendations} = await read({
    recommendations: [
      null,
      42,
      'RELIANCE',
      {},
      row({id: Number.NaN}),
      row({symbol: ''}),
      row({symbol: '-NSE'}),
      row({direction: 'LONG', id: 7}),
      row({direction: 'sideways'}),
      row({status: 'cancelled'}),
      row({status: 'pending'}),
    ],
  });
  // Direction is read whatever its case.
  assert.deepEqual(
    recommendations.map(pick => [pick.id, pick.direction]),
    [[7, 'long']],
  );
});

test('a closed pick reads at its exit price, with its outcome and P&L', async () => {
  const {recommendations, showing_closed: showingClosed} = await read({
    recommendations: [
      row({
        id: 1,
        status: 'closed',
        exit_at: '2026-10-19T08:10:00Z',
        exit_price: 1490,
        exit_reason: 'target',
        realized_pnl: 448,
        return_pct: 4.49,
      }),
      row({
        id: 2,
        status: 'closed',
        exit_price: 1392,
        exit_reason: 'stop',
        realized_pnl: -238,
      }),
      row({id: 3, status: 'closed', exit_price: 1450, exit_reason: 'manual'}),
      // Never filled: closed with no exit price and no P&L.
      row({id: 4, status: 'closed', exit_reason: 'expired', realized_pnl: 0}),
    ],
    showing_closed: true,
  });
  assert.equal(showingClosed, true);
  const [target, stop, manual, unfilled] = recommendations;
  assert.ok(target && stop && manual && unfilled);
  assert.equal(target.status, 'hit_target');
  assert.equal(target.ref_price, 1490);
  assert.equal(target.ref_basis, 'exit');
  assert.equal(target.resolved_price, 1490);
  assert.equal(target.realized_pnl, 448);
  assert.equal(target.cmp, null);
  assert.equal(stop.status, 'hit_stop');
  assert.equal(stop.realized_pnl, -238);
  assert.equal(manual.status, 'expired');
  assert.equal(unfilled.status, 'expired');
  assert.equal(unfilled.ref_basis, 'entry_mid');
  assert.equal(unfilled.ref_price, 1426);
  assert.equal('resolved_price' in unfilled, false);
});

test('showing_closed is carried only when the server says so, and next_batch_at is no longer read', async () => {
  const open = await read({recommendations: [row()]});
  assert.equal('showing_closed' in open, false);
  assert.equal('next_batch_at' in open, false);
  const notClosed = await read({
    recommendations: [row()],
    showing_closed: false,
  });
  assert.equal('showing_closed' in notClosed, false);
});

test('an answer with no list, a null list or no body reads as no picks', async () => {
  for (const body of [
    {},
    {recommendations: null},
    null,
    {recommendations: {}},
  ]) {
    assert.deepEqual(await read(body), {recommendations: [], dropped: 0});
  }
});

test('a hold label, remark or rationale left empty falls back, and a modify zone is kept when whole', async () => {
  const {recommendations} = await read({
    recommendations: [
      row({
        hold_label: null,
        remark: '',
        rationale: null,
        modify_min: 1440,
        modify_max: 1445,
        modify_note: 'Trail the stop to entry',
      }),
      row({id: 2, modify_min: 1440, modify_max: null}),
    ],
  });
  const [first, second] = recommendations;
  assert.ok(first && second);
  assert.equal(first.hold_label, 'intraday');
  assert.equal(first.remark, null);
  assert.equal(first.rationale, '');
  assert.deepEqual(first.modify_zone, [1440, 1445]);
  assert.equal(first.modify_note, 'Trail the stop to entry');
  assert.equal(second.modify_zone, null);
});

test('the request asks for the horizon and equities, the only kind the picks read', async () => {
  const {http, calls} = fakeHttp([
    {recommendations: []},
    {recommendations: []},
  ]);
  await marketApi(http).getRecommendations({horizon: 'swing'});
  await marketApi(http).getRecommendations({kind: 'commodity'});
  assert.deepEqual(
    calls.map(call => call.path),
    [
      '/market/recommendations?horizon=swing&kind=equity',
      '/market/recommendations?kind=commodity',
    ],
  );
});

test('rows that cannot be kept are counted as dropped; rows that are not picks are not', async () => {
  const {recommendations, dropped} = await read({
    recommendations: [
      row({id: 1}),
      // Not picks, by design, as on web: an options spread, the portfolio, a neutral view.
      row({id: 2, legs: [{instrument: 'NIFTY26OCT24500CE-NSE'}]}),
      row({id: 3, horizon: 'portfolio'}),
      row({id: 4, direction: 'neutral'}),
      // Could not be kept: a missing edge, a commodity, a stop above a long's entry, no stamp.
      row({id: 5, target_max: null}),
      row({id: 6, kind: 'commodity', symbol: 'GOLD-MCX'}),
      row({id: 7, stop_loss_min: 1440, stop_loss_max: 1445}),
      row({id: 8, valid_until: ''}),
      null,
    ],
  });
  assert.deepEqual(
    recommendations.map(pick => pick.id),
    [1],
  );
  assert.equal(dropped, 5);
});

test('a pick needs stamps the app can read; Go’s nanosecond and Postgres’s microsecond forms are read', async () => {
  const {recommendations} = await read({
    recommendations: [
      row({id: 1, published_at: '2026-10-20T03:40:00.123456789Z'}),
      row({id: 2, valid_until: '2026-10-20 09:45:00.827232+00'}),
      row({id: 3, published_at: 'soon'}),
      row({id: 4, valid_until: null as unknown as string}),
      row({id: 5, published_at: 42 as unknown as string}),
    ],
  });
  assert.deepEqual(
    recommendations.map(pick => pick.id),
    [1, 2],
  );
});
