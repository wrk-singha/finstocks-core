import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  alertReading,
  deriveWatchlistName,
  draftFromAlert,
  newWatchlistId,
} from '../watchlists.ts';

test('ids are unique strings', () => {
  const a = newWatchlistId();
  assert.equal(typeof a, 'string');
  assert.notEqual(a, newWatchlistId());
});

test('names drop the lead-in, take the first clause and cap the length', () => {
  assert.equal(
    deriveWatchlistName('Tell me when Reliance breaks out. Also TCS.'),
    'Reliance breaks out',
  );
  assert.equal(
    deriveWatchlistName('please can you alert me if   nifty drops 2%'),
    'Nifty drops 2%',
  );
  assert.equal(
    deriveWatchlistName(
      'watch for a golden cross on any of the private banks in the nifty',
      30,
    ),
    'A golden cross on any of the…',
  );
  assert.equal(deriveWatchlistName('...'), '...');
});

const setup = {
  rows: [
    {k: 'Stock', v: 'reliance, tcs, Nifty 100'},
    {k: 'Condition', v: 'RSI below 30'},
    {k: 'Timeframe', v: '1d'},
  ],
};

test('the reading separates instruments from the scope and names the watch', () => {
  const reading = alertReading(setup);
  assert.equal(reading.name, 'RSI below 30');
  assert.equal(reading.summary, 'Nifty 100 — RSI below 30 (1d)');
  assert.deepEqual(reading.matches, [{symbol: 'RELIANCE'}, {symbol: 'TCS'}]);

  const named = alertReading({
    rows: [
      {k: 'Alert Name', v: 'Oversold banks'},
      {k: 'Tickers', v: 'HDFCBANK'},
    ],
  });
  assert.equal(named.name, 'Oversold banks');
  assert.equal(named.summary, undefined);
  assert.deepEqual(named.matches, [{symbol: 'HDFCBANK'}]);
});

test('a draft keeps the typed prompt, else the summary, and carries the config', () => {
  const now = new Date('2026-09-11T10:00:00Z');
  const typed = draftFromAlert(
    setup,
    {symbol: 'RELIANCE', timeframe: '1d'},
    '  Ping me on dips ',
    now,
  );
  assert.equal(typed.prompt, 'Ping me on dips');
  assert.equal(typed.status, 'draft');
  assert.equal(typed.notify, true);
  assert.equal(typed.created_at, '2026-09-11T10:00:00.000Z');
  assert.equal(typed.symbol, 'RELIANCE');
  assert.equal(typed.timeframe, '1d');
  assert.equal('original_query' in typed, false);

  const untyped = draftFromAlert(setup, {}, '   ', now);
  assert.equal(untyped.prompt, 'Nifty 100 — RSI below 30 (1d)');
  assert.equal('symbol' in untyped, false);
});
