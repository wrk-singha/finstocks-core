import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {FlyoneRow} from '../../types/flyone.ts';
import type {Regime} from '../../types/regimePulse.ts';
import {
  clashesWithRegime,
  DIRECTION_DEFAULT_SORT,
  DIRECTION_PRESETS,
  DIRECTION_SORT_KEYS,
  directionBreadth,
  directionPreset,
  directionScannerStatus,
  directionSortStartsDescending,
  directionUniverseRows,
  filterDirectionRows,
  inDirectionUniverse,
  sortDirectionRows,
} from '../directionScanner.ts';

const row = (
  underlying: string,
  patch: Partial<FlyoneRow> = {},
): FlyoneRow => ({
  ts: '2026-10-06 14:32:00',
  trade_date: '2026-10-06',
  underlying,
  expiry: '2026-10-08',
  expiry_rank: 'near',
  spot: 1000,
  forward: 1001,
  atm_strike: 1000,
  straddle: 30,
  sigma_pts: 20,
  dte_days: 2,
  step: 10,
  n_valid_widths: 4,
  price_chg_pct: 0,
  skew: 0,
  fear: 0,
  fear_lb: 0,
  fear_chg: 0,
  tail_ratio: 1,
  mode_minus_fwd: 0,
  straddle_lb: 0,
  future_price: 1002,
  future_vwap: 1000,
  future_vwap_slope: 0,
  gamma_flip: 990,
  call_wall: 1100,
  put_wall: 900,
  total_gex: 0,
  ngex: 0,
  gdi: 0,
  gex_slope: 0,
  gex_regime: 'NEUTRAL',
  ce_vol: 0,
  pe_vol: 0,
  net_vol: 0,
  ce_oi: 0,
  pe_oi: 0,
  net_oi: 0,
  ce_chg_oi: 0,
  pe_chg_oi: 0,
  net_chg_oi: 0,
  score: 0,
  direction_raw: 'NEUTRAL',
  direction: 'NEUTRAL',
  confidence: 0,
  pattern: 'QUIET',
  agree: '',
  width_scores: '',
  reason: '',
  oi_source: 'today',
  n_strikes: 32,
  engine_hash: '',
  direction_since: null,
  ...patch,
});

// One chain per preset case, each passing exactly the presets its name says.
const ROWS: readonly FlyoneRow[] = [
  // Score above zero with dealers net long gamma: bull_calm only.
  row('NIFTY', {
    score: 2,
    ngex: 1.4,
    gex_regime: 'POS',
    direction: 'BULLISH',
    direction_raw: 'BULLISH',
    pattern: 'BULL_LEAN',
  }),
  // A bearish call with dealers short gamma, and a fall backed by hedging: bear_fast and confirmed.
  row('RELIANCE', {
    score: -2,
    ngex: -2.1,
    gex_regime: 'STRONG_NEG',
    direction: 'BEARISH',
    direction_raw: 'BEARISH',
    pattern: 'BEAR_CONFIRM',
  }),
  // Spot 0.4% under its call wall: near_wall only (a positive score with no net gamma is not calm).
  row('SBIN', {
    spot: 996,
    call_wall: 1000,
    put_wall: 940,
    score: 1,
    ngex: null,
    direction: 'LEAN_BULLISH',
    direction_raw: 'LEAN_BULLISH',
  }),
  // Spot exactly 0.5% over its put wall, at the edge: near_wall.
  row('TCS', {
    spot: 1000,
    put_wall: 995,
    call_wall: 1200,
    score: -1,
    direction: 'LEAN_BEARISH',
    direction_raw: 'LEAN_BEARISH',
  }),
  // Bearish but dealers balanced: neither bear_fast nor anything else.
  row('INFY', {
    score: -1,
    gex_regime: 'NEUTRAL',
    direction: 'BEARISH',
    direction_raw: 'BEARISH',
  }),
  // Still warming up: no call yet, so it clashes with nothing and filters out of every direction.
  row('HDFCBANK', {
    direction: 'BULLISH',
    direction_raw: 'WARMUP',
    pattern: '',
  }),
  row('SENSEX', {direction: 'NEUTRAL', direction_raw: 'NEUTRAL'}),
];

const REGIMES: Readonly<Record<string, {regime: Regime}>> = {
  NIFTY: {regime: 'NEUTRAL-TO-BEARISH'},
  RELIANCE: {regime: 'BEARISH'},
  SBIN: {regime: 'BULLISH'},
  TCS: {regime: 'BULLISH'},
  HDFCBANK: {regime: 'BEARISH'},
};

const symbols = (rows: readonly FlyoneRow[]) => rows.map(r => r.underlying);

const passing = (key: Parameters<typeof directionPreset>[0]) =>
  symbols(
    filterDirectionRows(ROWS, {
      query: '',
      directions: [],
      preset: key,
      regimes: REGIMES,
    }),
  );

test("web's five presets, in its order, each keeping the chains its test names", () => {
  assert.deepEqual(
    DIRECTION_PRESETS.map(p => p.key),
    ['bull_calm', 'bear_fast', 'near_wall', 'confirmed', 'clash'],
  );
  assert.deepEqual(passing('bull_calm'), ['NIFTY']);
  assert.deepEqual(passing('bear_fast'), ['RELIANCE']);
  assert.deepEqual(passing('near_wall'), ['SBIN', 'TCS']);
  assert.deepEqual(passing('confirmed'), ['RELIANCE']);
  // NIFTY reads bullish against a bearish regime, TCS bearish against a bullish one; HDFCBANK has
  // made no call yet and INFY has no regime to disagree with.
  assert.deepEqual(passing('clash'), ['NIFTY', 'TCS']);
});

test('a call wall half a percent off is near, a hair past it is not, and a missing wall never is', () => {
  const test = directionPreset('near_wall')?.test;
  assert.ok(test);
  assert.equal(
    test(row('A', {spot: 1000, call_wall: 1005, put_wall: null}), undefined),
    true,
  );
  assert.equal(
    test(row('A', {spot: 1000, call_wall: 1005.1, put_wall: null}), undefined),
    false,
  );
  assert.equal(
    test(row('A', {spot: 1000, call_wall: null, put_wall: null}), undefined),
    false,
  );
  assert.equal(test(row('A', {spot: null}), undefined), false);
});

test('the disagreement joins the regime of the same name and needs a call and a regime', () => {
  const [nifty, , , , , hdfcbank] = ROWS;
  assert.ok(nifty && hdfcbank);
  assert.equal(clashesWithRegime(nifty, 'NEUTRAL-TO-BEARISH'), true);
  assert.equal(clashesWithRegime(nifty, 'BULLISH'), false);
  assert.equal(clashesWithRegime(nifty, 'RANGEBOUND'), false);
  assert.equal(clashesWithRegime(nifty, undefined), false);
  assert.equal(clashesWithRegime(hdfcbank, 'BEARISH'), false);
  // Without the map the clash preset keeps nothing.
  assert.deepEqual(
    filterDirectionRows(ROWS, {
      query: '',
      directions: [],
      preset: 'clash',
      regimes: {},
    }),
    [],
  );
});

test('the universe splits indices from stocks, SENSEX among the indices', () => {
  assert.equal(inDirectionUniverse('NIFTY', 'index'), true);
  assert.equal(inDirectionUniverse('SENSEX', 'index'), true);
  assert.equal(inDirectionUniverse('BANKEX', 'index'), true);
  assert.equal(inDirectionUniverse('RELIANCE', 'index'), false);
  assert.equal(inDirectionUniverse('RELIANCE', 'stock'), true);
  assert.equal(inDirectionUniverse('SENSEX', 'stock'), false);
  assert.equal(inDirectionUniverse('SENSEX', 'all'), true);
  assert.deepEqual(symbols(directionUniverseRows(ROWS, 'index')), [
    'NIFTY',
    'SENSEX',
  ]);
  assert.deepEqual(symbols(directionUniverseRows(ROWS, 'stock')), [
    'RELIANCE',
    'SBIN',
    'TCS',
    'INFY',
    'HDFCBANK',
  ]);
  assert.equal(directionUniverseRows(ROWS, 'all').length, ROWS.length);
});

test('the breadth counts each call, keeps a warming chain out of them, and splits the dealers', () => {
  const breadth = directionBreadth(ROWS);
  assert.deepEqual(breadth.counts, {
    BULLISH: 1,
    LEAN_BULLISH: 1,
    NEUTRAL: 1,
    LEAN_BEARISH: 1,
    BEARISH: 2,
  });
  assert.equal(breadth.total, 7);
  assert.equal(breadth.warming, 1);
  assert.equal(breadth.called, 6);
  assert.equal(breadth.calm, 1);
  assert.equal(breadth.fast, 1);
  assert.equal(breadth.balanced, 5);
  assert.deepEqual(directionBreadth([]), {
    counts: {
      BULLISH: 0,
      LEAN_BULLISH: 0,
      NEUTRAL: 0,
      LEAN_BEARISH: 0,
      BEARISH: 0,
    },
    total: 0,
    warming: 0,
    called: 0,
    calm: 0,
    fast: 0,
    balanced: 0,
  });
});

test('direction filters keep the calls picked, never a warming chain; the search is the symbol', () => {
  const filter = (query: string, directions: FlyoneRow['direction'][]) =>
    symbols(
      filterDirectionRows(ROWS, {
        query,
        directions,
        preset: null,
        regimes: REGIMES,
      }),
    );
  // HDFCBANK's direction is BULLISH underneath, but it has made no call.
  assert.deepEqual(filter('', ['BULLISH']), ['NIFTY']);
  assert.deepEqual(filter('', ['BEARISH', 'LEAN_BEARISH']), [
    'RELIANCE',
    'TCS',
    'INFY',
  ]);
  assert.deepEqual(filter('  sb ', []), ['SBIN']);
  assert.deepEqual(filter('bull', []), []);
  assert.deepEqual(filter('', []), symbols(ROWS));
  // Filters, a preset and the search all apply at once.
  assert.deepEqual(
    symbols(
      filterDirectionRows(ROWS, {
        query: 't',
        directions: ['LEAN_BEARISH', 'LEAN_BULLISH'],
        preset: 'near_wall',
        regimes: REGIMES,
      }),
    ),
    ['TCS'],
  );
});

test('the table opens on the score, high first; a tie is by symbol, a missing level last', () => {
  assert.equal(DIRECTION_DEFAULT_SORT, 'score');
  assert.equal(directionSortStartsDescending('score'), true);
  assert.equal(directionSortStartsDescending('symbol'), false);
  assert.equal(directionSortStartsDescending('read'), false);
  assert.deepEqual(DIRECTION_SORT_KEYS, [
    'symbol',
    'spot',
    'direction',
    'score',
    'read',
    'support',
    'gammaFlip',
    'resistance',
    'dealers',
    'sigma',
  ]);
  // A reversed input, so only the tie-break orders HDFCBANK before SENSEX (both score 0).
  const reversed = [...ROWS].reverse();
  assert.deepEqual(symbols(sortDirectionRows(reversed, 'score', true)), [
    'NIFTY',
    'SBIN',
    'HDFCBANK',
    'SENSEX',
    'INFY',
    'TCS',
    'RELIANCE',
  ]);
  assert.deepEqual(
    symbols(sortDirectionRows(reversed, 'score', false)).slice(0, 2),
    ['RELIANCE', 'INFY'],
  );
  // Bullish ranks highest; HDFCBANK sorts by the direction underneath its warm-up, as web's does.
  assert.deepEqual(symbols(sortDirectionRows(ROWS, 'direction', true)), [
    'HDFCBANK',
    'NIFTY',
    'SBIN',
    'SENSEX',
    'TCS',
    'INFY',
    'RELIANCE',
  ]);
  // "Read" is the pattern's id A–Z; HDFCBANK has none, and the four quiet chains tie by symbol.
  assert.deepEqual(symbols(sortDirectionRows(ROWS, 'read', false)), [
    'HDFCBANK',
    'RELIANCE',
    'NIFTY',
    'INFY',
    'SBIN',
    'SENSEX',
    'TCS',
  ]);
  const walls = [
    row('A', {call_wall: null}),
    row('B', {call_wall: 1200}),
    row('C', {call_wall: 1100}),
  ];
  assert.deepEqual(symbols(sortDirectionRows(walls, 'resistance', true)), [
    'B',
    'C',
    'A',
  ]);
  assert.deepEqual(symbols(sortDirectionRows(walls, 'resistance', false)), [
    'A',
    'C',
    'B',
  ]);
});

test("the status reads web's four states, the last session with its day", () => {
  const snapshot = {
    interval_sec: 60,
    as_of: '2026-10-05 15:29:00',
    date: '2026-10-05',
  };
  assert.deepEqual(
    directionScannerStatus({date: '2026-10-01', isMarketOpen: true, snapshot}),
    {kind: 'replay', date: '2026-10-01'},
  );
  assert.deepEqual(
    directionScannerStatus({date: undefined, isMarketOpen: true, snapshot}),
    {
      kind: 'live',
      intervalSec: 60,
    },
  );
  assert.deepEqual(
    directionScannerStatus({
      date: undefined,
      isMarketOpen: true,
      snapshot: {...snapshot, interval_sec: 0},
    }),
    {kind: 'live', intervalSec: null},
  );
  assert.deepEqual(
    directionScannerStatus({date: '', isMarketOpen: false, snapshot}),
    {
      kind: 'lastSession',
      day: '2026-10-05',
      at: '15:29',
    },
  );
  assert.deepEqual(
    directionScannerStatus({
      date: undefined,
      isMarketOpen: false,
      snapshot: {interval_sec: 60, as_of: '', date: ''},
    }),
    {kind: 'closed'},
  );
  assert.deepEqual(
    directionScannerStatus({
      date: undefined,
      isMarketOpen: false,
      snapshot: undefined,
    }),
    {kind: 'closed'},
  );
});
