import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {LibraryStrategy} from '../../types/strategyLibrary.ts';
import {
  applyLibraryFilters,
  countActiveLibraryFilters,
  DEFAULT_LIBRARY_FILTERS,
  nextLibrarySort,
  presentValues,
  scopeLibrary,
  sortLibrary,
  viewLibrary,
} from '../libraryFilters.ts';
import {
  backtestPreview,
  isReference,
  libraryChatContext,
  libraryChatMessage,
  riskDrivers,
  riskLabel,
  riskShort,
  riskTone,
} from '../strategyLibrary.ts';

const strategy = (
  id: string,
  fields: Partial<LibraryStrategy> = {},
): LibraryStrategy => ({
  id,
  name: id,
  tagline: `${id} tagline`,
  summary: '',
  highlights: [],
  style: 'momentum',
  segment: 'equity_cash',
  instruments: ['NIFTY 500 stocks'],
  is_fno: false,
  horizon: 'swing',
  holding_period: '2 to 10 days',
  trade_frequency: 'A few a week',
  direction: 'long',
  structure: 'Cash equity',
  max_open_positions: 5,
  risk_level: 4,
  risk_note: '',
  risk_capped: false,
  protective_exit: true,
  holds_overnight: true,
  capital_note: null,
  suits: [],
  struggles: [],
  complexity: 'simple',
  availability: 'available',
  availability_note: null,
  exchange_category: 'alpha_seeking',
  version: 1,
  ...fields,
});

const condor = strategy('krishna', {
  name: 'Expiry Iron Condor',
  style: 'premium_selling',
  segment: 'index_options',
  is_fno: true,
  risk_level: 5,
  risk_capped: true,
  direction: 'neutral',
  complexity: 'advanced',
});
const futures = strategy('godavari', {
  name: 'Always-In NIFTY Futures',
  style: 'trend_following',
  segment: 'index_futures',
  is_fno: true,
  horizon: 'positional',
  risk_level: 6,
  protective_exit: false,
});
const scalper = strategy('tapi', {
  name: 'Early Intraday Burst',
  horizon: 'intraday',
  risk_level: 3,
  holds_overnight: false,
  complexity: 'moderate',
});
const legacy = strategy('alaknanda', {
  name: 'Legacy Narrow Condor',
  is_fno: true,
  risk_level: 2,
  availability: 'reference',
  availability_note: 'A legacy version.',
});
const library = [condor, futures, scalper, legacy, strategy('beas')];

test('the six risk steps read as SEBI names and fold onto three tones', () => {
  assert.equal(riskLabel(1), 'Low');
  assert.equal(riskLabel(2), 'Low to moderate');
  assert.equal(riskLabel(4), 'Moderately high');
  assert.equal(riskLabel(6), 'Very high');
  assert.equal(riskShort(4), 'Mod. high');
  assert.equal(riskTone(2), 'low');
  assert.equal(riskTone(4), 'med');
  assert.equal(riskTone(5), 'high');
  // Out-of-range and unparseable levels clamp rather than throw.
  assert.equal(riskLabel(0), 'Low');
  assert.equal(riskLabel(9), 'Very high');
  assert.equal(riskLabel(Number.NaN), 'Low');
});

test('risk drivers name what tells two F&O strategies apart', () => {
  assert.deepEqual(riskDrivers(condor), [
    'Sells option premium',
    'Overnight exposure',
  ]);
  assert.deepEqual(riskDrivers(futures), [
    'Leveraged futures',
    'Loss not capped by structure',
    'No protective stop',
    'Overnight exposure',
  ]);
  assert.deepEqual(riskDrivers(scalper), ['Loss not capped by structure']);
});

test('the performance slot names what will appear, by horizon and segment', () => {
  assert.equal(
    backtestPreview(condor)[1],
    'Monthly returns',
    'swing F&O leads with the curve and months',
  );
  assert.equal(backtestPreview(scalper)[1], 'Day-by-day results and worst day');
  assert.equal(backtestPreview(strategy('x'))[2], 'Return against NIFTY 50');
  assert.equal(
    backtestPreview(strategy('y', {horizon: 'intraday', is_fno: true}))[2],
    'Win days, streaks and expiry-day split',
  );
});

test('the chat hand-off carries the visible sentence and the hidden id marker', () => {
  assert.equal(
    libraryChatMessage(condor, 'ask'),
    'Tell me about the Expiry Iron Condor strategy. [<Library Strategy: ID: krishna, Name: Expiry Iron Condor>]',
  );
  assert.equal(
    libraryChatMessage(condor, 'backtest'),
    'Backtest the Expiry Iron Condor strategy for me. [<Library Strategy: ID: krishna, Name: Expiry Iron Condor>]',
  );
  assert.deepEqual(libraryChatContext(condor), {
    label: 'Expiry Iron Condor',
    sublabel: 'krishna tagline',
  });
  assert.equal(isReference(legacy), true);
  assert.equal(isReference(condor), false);
});

test('the Stocks and F&O tabs split the library on is_fno', () => {
  assert.deepEqual(
    scopeLibrary(library, 'FNO').map(s => s.id),
    ['krishna', 'godavari', 'alaknanda'],
  );
  assert.deepEqual(
    scopeLibrary(library, 'EQUITY').map(s => s.id),
    ['tapi', 'beas'],
  );
});

test('filters narrow on every field and count one per group', () => {
  const f = {...DEFAULT_LIBRARY_FILTERS, riskLevels: [5, 6]};
  assert.deepEqual(
    applyLibraryFilters(library, f).map(s => s.id),
    ['krishna', 'godavari'],
  );
  assert.deepEqual(
    applyLibraryFilters(library, {
      ...DEFAULT_LIBRARY_FILTERS,
      cappedOnly: true,
    }).map(s => s.id),
    ['krishna'],
  );
  assert.deepEqual(
    applyLibraryFilters(library, {
      ...DEFAULT_LIBRARY_FILTERS,
      flatOvernight: true,
    }).map(s => s.id),
    ['tapi'],
  );
  assert.deepEqual(
    applyLibraryFilters(library, {
      ...DEFAULT_LIBRARY_FILTERS,
      includeReference: false,
    }).map(s => s.id),
    ['krishna', 'godavari', 'tapi', 'beas'],
  );
  assert.equal(countActiveLibraryFilters(DEFAULT_LIBRARY_FILTERS), 0);
  assert.equal(
    countActiveLibraryFilters({
      ...f,
      styles: ['momentum'],
      protectiveOnly: true,
      includeReference: false,
    }),
    4,
  );
});

test('present values keep first-seen order so a panel offers only what can match', () => {
  assert.deepEqual(
    presentValues(library, s => s.horizon),
    ['swing', 'positional', 'intraday'],
  );
});

test('every sort keeps reference strategies after the deployable ones', () => {
  assert.deepEqual(
    sortLibrary(library, 'recommended').map(s => s.id),
    ['krishna', 'godavari', 'tapi', 'beas', 'alaknanda'],
  );
  assert.deepEqual(
    sortLibrary(library, 'risk_asc').map(s => s.id),
    ['tapi', 'beas', 'krishna', 'godavari', 'alaknanda'],
    'the legacy entry is the lowest risk but still last',
  );
  assert.deepEqual(
    sortLibrary(library, 'risk_desc').map(s => s.id),
    ['godavari', 'krishna', 'beas', 'tapi', 'alaknanda'],
  );
  assert.deepEqual(
    sortLibrary(library, 'name').map(s => s.id),
    ['godavari', 'beas', 'tapi', 'krishna', 'alaknanda'],
  );
});

test('the risk chip cycles up, down, off; A–Z toggles', () => {
  assert.equal(nextLibrarySort('recommended', 'risk'), 'risk_asc');
  assert.equal(nextLibrarySort('risk_asc', 'risk'), 'risk_desc');
  assert.equal(nextLibrarySort('risk_desc', 'risk'), 'recommended');
  assert.equal(nextLibrarySort('name', 'risk'), 'risk_asc');
  assert.equal(nextLibrarySort('recommended', 'name'), 'name');
  assert.equal(nextLibrarySort('name', 'name'), 'recommended');
});

test('the whole view: scope, horizon, filters, sort', () => {
  assert.deepEqual(
    viewLibrary(library, {
      scope: 'FNO',
      horizon: 'ALL',
      filters: DEFAULT_LIBRARY_FILTERS,
      sort: 'risk_asc',
    }).map(s => s.id),
    ['krishna', 'godavari', 'alaknanda'],
  );
  assert.deepEqual(
    viewLibrary(library, {
      scope: 'FNO',
      horizon: 'positional',
      filters: DEFAULT_LIBRARY_FILTERS,
      sort: 'recommended',
    }).map(s => s.id),
    ['godavari'],
  );
});
