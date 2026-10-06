import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {Regime, RegimeRow} from '../../types/regimePulse.ts';
import {
  filterRegimeRows,
  REGIME_DEFAULT_SORT,
  REGIME_SORT_KEYS,
  regimeScannerStatus,
  regimeSortStartsDescending,
  sortRegimeRows,
} from '../regimeScanner.ts';

const row = (
  underlying: string,
  regime: Regime,
  figures: Partial<RegimeRow> = {},
): RegimeRow => ({
  ts: '2026-10-06 14:32:20',
  trade_date: '2026-10-06',
  underlying,
  spot: 25000,
  avg_ce_z: 0,
  avg_pe_z: 0,
  z_bias: 0,
  avg_ce_roc: 0,
  avg_pe_roc: 0,
  roc_bias: 0,
  roc_bias_z: null,
  regime,
  atm_ce_iv: 0.12,
  atm_pe_iv: 0.13,
  straddle_iv: 0.125,
  atm_ce_ltp: 100,
  atm_pe_ltp: 110,
  straddle_premium: 210,
  pzr1_signal: '',
  pzr1_position: 0,
  pzr1_entry_ts: '',
  pzr1_entry_spot: 0,
  atm_ce_iv_chg: 0,
  atm_pe_iv_chg: 0,
  straddle_iv_chg: 0,
  atm_ce_value: 0,
  atm_pe_value: 0,
  atm_ce_value_chg_pct: 0,
  atm_pe_value_chg_pct: 0,
  straddle_atp: 0,
  straddle_open: 0,
  straddle_chg: 0,
  straddle_chg_pct: 0,
  expiry: null,
  atm_strike: null,
  regime_since: null,
  ...figures,
});

const ROWS: readonly RegimeRow[] = [
  row('NIFTY', 'BULLISH', {z_bias: 2.41, spot: 25118}),
  row('BANKNIFTY', 'NEUTRAL-TO-BULLISH', {z_bias: 0.92, spot: 56204}),
  row('FINNIFTY', 'RANGEBOUND', {z_bias: 0.11, spot: 26740}),
  row('MIDCPNIFTY', 'NEUTRAL-TO-BEARISH', {z_bias: -0.84, spot: 13088}),
  row('RELIANCE', 'BEARISH', {z_bias: -2.63, spot: 1392}),
  row('HDFCBANK', 'WARMING_UP', {z_bias: 0, spot: 964}),
  row('TCS', 'RANGEBOUND', {z_bias: 0.11, spot: 3018}),
];

const symbols = (rows: readonly RegimeRow[]) => rows.map(r => r.underlying);

test("the search matches web's: symbol, regime id, label or short label, case-blind and trimmed", () => {
  assert.deepEqual(symbols(filterRegimeRows(ROWS, '  nifty ', [])), [
    'NIFTY',
    'BANKNIFTY',
    'FINNIFTY',
    'MIDCPNIFTY',
  ]);
  // "bear" is in both bearish regimes' ids; "Nt-bull" is only the mild bullish one's short label.
  assert.deepEqual(symbols(filterRegimeRows(ROWS, 'bear', [])), [
    'MIDCPNIFTY',
    'RELIANCE',
  ]);
  assert.deepEqual(symbols(filterRegimeRows(ROWS, 'nt-bull', [])), [
    'BANKNIFTY',
  ]);
  assert.deepEqual(symbols(filterRegimeRows(ROWS, 'neutral to', [])), [
    'BANKNIFTY',
    'MIDCPNIFTY',
  ]);
  assert.deepEqual(symbols(filterRegimeRows(ROWS, 'warming', [])), [
    'HDFCBANK',
  ]);
  assert.deepEqual(symbols(filterRegimeRows(ROWS, '', [])), symbols(ROWS));
  assert.deepEqual(filterRegimeRows(ROWS, 'zzz', []), []);
});

test('the regime filters keep any of the picked regimes, and narrow a search', () => {
  assert.deepEqual(symbols(filterRegimeRows(ROWS, '', ['RANGEBOUND'])), [
    'FINNIFTY',
    'TCS',
  ]);
  assert.deepEqual(
    symbols(filterRegimeRows(ROWS, '', ['BULLISH', 'BEARISH'])),
    ['NIFTY', 'RELIANCE'],
  );
  assert.deepEqual(
    symbols(filterRegimeRows(ROWS, 'nifty', ['RANGEBOUND', 'BULLISH'])),
    ['NIFTY', 'FINNIFTY'],
  );
});

test('the table opens on the bias, high first; figures start descending, text ascending', () => {
  assert.equal(REGIME_DEFAULT_SORT, 'zBias');
  assert.equal(regimeSortStartsDescending('zBias'), true);
  assert.equal(regimeSortStartsDescending('regime'), true);
  assert.equal(regimeSortStartsDescending('symbol'), false);
  assert.equal(regimeSortStartsDescending('lastLog'), false);
  assert.equal(REGIME_SORT_KEYS.length, 11);
  // FINNIFTY and TCS tie on the bias; the symbol breaks the tie A–Z whichever way the sort runs.
  assert.deepEqual(symbols(sortRegimeRows(ROWS, 'zBias', true)), [
    'NIFTY',
    'BANKNIFTY',
    'FINNIFTY',
    'TCS',
    'HDFCBANK',
    'MIDCPNIFTY',
    'RELIANCE',
  ]);
  assert.deepEqual(symbols(sortRegimeRows(ROWS, 'zBias', false)), [
    'RELIANCE',
    'MIDCPNIFTY',
    'HDFCBANK',
    'FINNIFTY',
    'TCS',
    'BANKNIFTY',
    'NIFTY',
  ]);
  assert.deepEqual(symbols(sortRegimeRows(ROWS, 'symbol', false)), [
    'BANKNIFTY',
    'FINNIFTY',
    'HDFCBANK',
    'MIDCPNIFTY',
    'NIFTY',
    'RELIANCE',
    'TCS',
  ]);
  assert.deepEqual(symbols(sortRegimeRows(ROWS, 'spot', true)).slice(0, 2), [
    'BANKNIFTY',
    'FINNIFTY',
  ]);
});

test('by regime, bullish first and warming up last, as having no rank', () => {
  assert.deepEqual(symbols(sortRegimeRows(ROWS, 'regime', true)), [
    'NIFTY',
    'BANKNIFTY',
    'FINNIFTY',
    'TCS',
    'MIDCPNIFTY',
    'RELIANCE',
    'HDFCBANK',
  ]);
  assert.equal(
    sortRegimeRows(ROWS, 'regime', false)[0]?.underlying,
    'HDFCBANK',
  );
  // A new array; the snapshot's own rows keep their order.
  const sorted = sortRegimeRows(ROWS, 'symbol', false);
  assert.notEqual(sorted, ROWS);
  assert.equal(ROWS[0]?.underlying, 'NIFTY');
});

test('the status: a replayed day, live with or without a cycle, the last session, or closed', () => {
  const snapshot = {interval_sec: 60, as_of: '2026-10-06 15:29:40'};
  assert.deepEqual(
    regimeScannerStatus({date: '2026-10-01', isMarketOpen: true, snapshot}),
    {kind: 'replay', date: '2026-10-01'},
  );
  assert.deepEqual(
    regimeScannerStatus({date: undefined, isMarketOpen: true, snapshot}),
    {kind: 'live', intervalSec: 60},
  );
  assert.deepEqual(
    regimeScannerStatus({
      date: '',
      isMarketOpen: true,
      snapshot: {interval_sec: 0, as_of: null},
    }),
    {kind: 'live', intervalSec: null},
  );
  assert.deepEqual(
    regimeScannerStatus({date: undefined, isMarketOpen: false, snapshot}),
    {kind: 'lastSession', at: '15:29'},
  );
  assert.deepEqual(
    regimeScannerStatus({
      date: undefined,
      isMarketOpen: false,
      snapshot: {interval_sec: 0, as_of: ''},
    }),
    {kind: 'closed'},
  );
  assert.deepEqual(
    regimeScannerStatus({
      date: undefined,
      isMarketOpen: false,
      snapshot: undefined,
    }),
    {kind: 'closed'},
  );
});
