import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  LibraryActivity,
  LibraryBacktest,
  LibraryBacktestTrade,
  LibraryStrategy,
} from '../../types/strategyLibrary.ts';
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
  activitySession,
  backtestPreview,
  hasFnoStrategy,
  isReference,
  isTodaysSession,
  libraryBacktestLead,
  libraryChatContext,
  libraryChatMessage,
  libraryTradeLog,
  libraryWinPeriods,
  liveThrough,
  positionKey,
  publishedLibrary,
  riskDrivers,
  riskLabel,
  riskShort,
  riskTone,
  sideLabel,
  tradeRowKey,
  tradesBothWays,
  tradesWithLiveSession,
} from '../strategyLibrary.ts';

const strategy = (
  id: string,
  fields: Partial<LibraryStrategy> = {},
): LibraryStrategy => ({
  id,
  slug: id,
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
  has_backtest: false,
  backtest_summary: null,
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

test('the page lists the published strategies only, and offers F&O only when one is published', () => {
  const published = strategy('annapurna', {
    has_backtest: true,
    backtest_summary: {annual_return: 0.214, max_drawdown: -0.18},
  });
  const fno = strategy('kangto', {is_fno: true, has_backtest: true});
  assert.deepEqual(
    publishedLibrary([condor, published, scalper, fno]).map(s => s.id),
    ['annapurna', 'kangto'],
  );
  assert.equal(hasFnoStrategy(publishedLibrary([condor, published])), false);
  assert.equal(hasFnoStrategy(publishedLibrary([published, fno])), true);
  assert.equal(hasFnoStrategy([]), false);
});

const trade = (
  symbol: string,
  entry: string,
  exit: string,
  returnPct: number,
  fields: Partial<LibraryBacktestTrade> = {},
): LibraryBacktestTrade => ({
  symbol,
  entry_date: entry,
  exit_date: exit,
  entry_price: 100,
  exit_price: 100 * (1 + returnPct / 100),
  return_pct: returnPct,
  ...fields,
});

const backtest: LibraryBacktest = {
  label: 'Hypothetical backtest',
  window_start: '2023-10-10',
  window_end: '2026-10-09',
  benchmark: 'NIFTY 50',
  daily: [
    {date: '2023-10-10', nav: 1, benchmark: 1},
    {date: '2024-10-10', nav: 1.1, benchmark: 1.05},
    {date: '2025-10-10', nav: 1.21, benchmark: 1.1025},
  ],
  trades: [
    trade('ABREL', '2023-10-11', '2023-10-23', -7.3),
    trade('ITI', '2026-09-01', '', 4.2),
    trade('BSE', '2026-09-20', '2026-10-01', 12.5),
    trade('TCS', '2026-10-01', '', -1.1, {side: 'short'}),
  ],
};

test('the lead is the annualised return and its benchmark, in percent', () => {
  const lead = libraryBacktestLead(backtest);
  assert.ok(lead);
  // Two calendar years of 365.25 days: 1.21 compounds at just under 10% a year.
  assert.equal(lead.value.toFixed(1), '10.0');
  assert.equal(lead.benchmark?.toFixed(1), '5.0');
  // Under a year there is no annual figure to claim.
  assert.equal(libraryBacktestLead({daily: backtest.daily.slice(0, 1)}), null);
  assert.equal(
    libraryBacktestLead({
      daily: [
        {date: '2026-01-01', nav: 1, benchmark: 1},
        {date: '2026-06-01', nav: 1.3, benchmark: 1},
      ],
    }),
    null,
  );
  // A curve with no benchmark leaves the comparison out rather than inventing one.
  assert.equal(
    libraryBacktestLead({
      daily: [
        {date: '2023-10-10', nav: 1, benchmark: 0},
        {date: '2025-10-10', nav: 1.21, benchmark: 0},
      ],
    })?.benchmark,
    null,
  );
  assert.deepEqual(
    libraryWinPeriods(backtest.daily).map(p => Number(p.net.toFixed(4))),
    [0, 0.1, 0.1],
  );
});

const live = (fields: Partial<LibraryActivity> = {}): LibraryActivity => ({
  date: '2026-10-12',
  live: true,
  buys: [],
  sells: [],
  ...fields,
});

test('a live session runs the log past the backtest, and a finished one does not', () => {
  assert.equal(liveThrough(backtest, null), '2026-10-09');
  assert.equal(liveThrough(backtest, live()), '2026-10-12');
  assert.equal(
    liveThrough(backtest, live({live: false, date: '2026-10-09'})),
    '2026-10-09',
  );
  assert.equal(activitySession(null), '');
  assert.equal(activitySession(live()), '2026-10-12:true');
  // Today's trades only while the session is live and dated today in India.
  assert.equal(isTodaysSession(live(), '2026-10-12'), true);
  assert.equal(isTodaysSession(live(), '2026-10-13'), false);
  assert.equal(isTodaysSession(live({live: false}), '2026-10-12'), false);
});

test('a position is keyed by its stock and side, and a long-short strategy names the side', () => {
  assert.equal(positionKey({symbol: 'TCS'}), 'TCS-long');
  assert.equal(positionKey({symbol: 'TCS', side: 'short'}), 'TCS-short');
  assert.equal(sideLabel(), 'Long');
  assert.equal(sideLabel('short'), 'Short');
  assert.equal(tradesBothWays(strategy('x', {direction: 'both'})), true);
  assert.equal(tradesBothWays(strategy('x', {direction: 'long'})), false);
});

test('a live session closes what it sold and opens what it bought, the same day included', () => {
  const session = live({
    buys: [
      {symbol: 'INFY', price: 1500, last: 1530, return_pct: 2},
      {symbol: 'HAL', price: 4000, return_pct: 0},
    ],
    sells: [
      {symbol: 'ITI', price: 260, return_pct: 5.1},
      {symbol: 'INFY', price: 1520, return_pct: 1.3},
      // A short TCS is held, so a long TCS sale closes nothing.
      {symbol: 'TCS', price: 3000, return_pct: 0.4},
    ],
  });
  const applied = tradesWithLiveSession(backtest.trades, session);
  const bySymbol = new Map(
    applied.map(t => [`${t.symbol}-${t.entry_date}`, t]),
  );
  assert.deepEqual(bySymbol.get('ITI-2026-09-01'), {
    ...trade('ITI', '2026-09-01', '', 4.2),
    exit_date: '2026-10-12',
    exit_price: 260,
    return_pct: 5.1,
  });
  // Opened and closed in the one session (web 69addf02).
  assert.deepEqual(bySymbol.get('INFY-2026-10-12'), {
    symbol: 'INFY',
    entry_date: '2026-10-12',
    exit_date: '2026-10-12',
    entry_price: 1500,
    exit_price: 1520,
    return_pct: 1.3,
  });
  // A buy without a latest price is valued at its fill.
  assert.equal(bySymbol.get('HAL-2026-10-12')?.exit_price, 4000);
  assert.equal(bySymbol.get('HAL-2026-10-12')?.exit_date, '');
  assert.equal(bySymbol.get('TCS-2026-10-01')?.exit_date, '');
  assert.equal(applied.length, 6);
  // A finished session is already in the backtest, and changes nothing.
  assert.deepEqual(
    tradesWithLiveSession(
      backtest.trades,
      live({live: false, sells: session.sells}),
    ),
    backtest.trades,
  );
  assert.deepEqual(
    tradesWithLiveSession(backtest.trades, null),
    backtest.trades,
  );
});

test('the log lists open positions first, then the latest exits, and counts those in profit', () => {
  const log = libraryTradeLog(backtest, null);
  assert.equal(log.through, '2026-10-09');
  assert.deepEqual(
    log.rows.map(r => [r.symbol, r.open]),
    [
      ['TCS', true],
      ['ITI', true],
      ['BSE', false],
      ['ABREL', false],
    ],
  );
  assert.equal(log.inProfit, 2);
  const withSession = libraryTradeLog(
    backtest,
    live({sells: [{symbol: 'ITI', price: 260, return_pct: 5.1}]}),
  );
  assert.equal(withSession.through, '2026-10-12');
  assert.deepEqual(
    withSession.rows.map(r => [r.symbol, r.open, r.exit_date]),
    [
      ['TCS', true, ''],
      ['ITI', false, '2026-10-12'],
      ['BSE', false, '2026-10-01'],
      ['ABREL', false, '2023-10-23'],
    ],
  );
  // The backtest's own array is left as it was.
  assert.equal(backtest.trades[0]?.symbol, 'ABREL');
});

test('two trades in one stock on one day keep separate row keys', () => {
  const first = trade('UPL', '2024-10-08', '2024-10-08', -0.9, {
    entry_price: 580.05,
  });
  const second = trade('UPL', '2024-10-08', '2024-10-08', 0.4, {
    entry_price: 575.4,
  });
  assert.notEqual(tradeRowKey(first), tradeRowKey(second));
  assert.equal(tradeRowKey(first), 'UPL-long-2024-10-08-2024-10-08-580.05');
});
