import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  extractSetupConfig,
  isOneSymbol,
  isScriptCard,
  isScriptEntry,
  normalizeSetupKey,
  SCRIPT_ENTRIES_C,
  SCRIPT_ENTRY_C,
  scriptCardHold,
  scriptRunOf,
  setupConfig,
  termsToConfig,
  TICKER_SEPARATOR,
  tickersHold,
  type TickersHold,
  tickersOf,
} from '../strategySetupConfig.ts';

const without = <T extends object>(terms: T, key: keyof T): Partial<T> =>
  Object.fromEntries(
    Object.entries(terms).filter(([name]) => name !== key),
  ) as Partial<T>;

test('a C strategy card is its code, its hash and the rows it was saved as; nothing else is one', () => {
  const terms = {
    tickers: 'HDFCBANK',
    script_entry: 'evaluate_v2',
    script: 'def evaluate_v2(ctx): ...',
    script_hash: 'abc123',
    strategy_id: '6f1c2a7e-0d4b-4c3e-9a1f-2b3c4d5e6f70',
  };
  assert.deepEqual(scriptRunOf(terms), {
    script: terms.script,
    scriptHash: 'abc123',
    strategyId: terms.strategy_id,
    backtestId: undefined,
  });
  assert.equal(isScriptCard({terms}), true);
  // A composed "script_preview" carries a script as its receipt, not as an entry point: it still
  // runs through create-backtest from its FSM.
  assert.equal(scriptRunOf(without(terms, 'script_entry')), null);
  assert.equal(scriptRunOf({...terms, script_entry: 'evaluate'}), null);
  // Without the code or its hash there is nothing strategy-action could run or check.
  assert.equal(scriptRunOf({...terms, script: ''}), null);
  assert.equal(scriptRunOf(without(terms, 'script_hash')), null);
  assert.equal(scriptRunOf(undefined), null);
  assert.equal(isScriptCard({}), false);
});

// Web 5b02f608: llm writes a C card's code against evaluate_v2 (one symbol) or evaluate_v3 (every
// symbol of the row in one call). Without v3 here, a v3 card read as one without code: retired, its
// Start, Backtest and Deploy locked.
test('a C card is either known entry, evaluate_v2 or evaluate_v3, and its run is its own code', () => {
  const v3 = {
    tickers: 'HDFCBANK',
    script_entry: 'evaluate_v3',
    script: 'def evaluate_v3(ctx, symbols): ...',
    script_hash: 'v3-hash',
    script_sig: 'v3-sig',
    strategy_id: '6f1c2a7e-0d4b-4c3e-9a1f-2b3c4d5e6f70',
    backtest_id: '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d',
  };
  assert.deepEqual(SCRIPT_ENTRIES_C, ['evaluate_v2', 'evaluate_v3']);
  // Read-only in fact, not only in its type: no host can add an entry.
  assert.equal(Object.isFrozen(SCRIPT_ENTRIES_C), true);
  for (const entry of SCRIPT_ENTRIES_C) {
    assert.equal(isScriptEntry(entry), true);
    assert.equal(isScriptCard({terms: {...v3, script_entry: entry}}), true);
  }
  // The card's own code, hash and signature, whichever entry it names: nothing is swapped in.
  assert.deepEqual(scriptRunOf(v3), {
    script: 'def evaluate_v3(ctx, symbols): ...',
    scriptHash: 'v3-hash',
    scriptSig: 'v3-sig',
    strategyId: v3.strategy_id,
    backtestId: v3.backtest_id,
  });
});

// A known set, not web's /^evaluate(_v\d+)?$/: an ABI nobody has shipped stays a card that cannot
// be started, rather than code sent to an engine that may not run it.
test('any other entry is not a C card: not a later version, not a near miss, not empty', () => {
  const terms = {
    tickers: 'HDFCBANK',
    script: 'def evaluate_v4(ctx): ...',
    script_hash: 'abc123',
    script_sig: 'sig-1',
  };
  for (const entry of [
    'evaluate_v4',
    'evaluate_v1',
    'evaluate_v30',
    'evaluate',
    '',
    'EVALUATE_V3',
    ' evaluate_v3',
    'evaluate_v3 ',
    'evaluate_v3x',
    'evaluate_v',
  ]) {
    assert.equal(isScriptEntry(entry), false, entry);
    assert.equal(scriptRunOf({...terms, script_entry: entry}), null, entry);
    assert.equal(isScriptCard({terms: {...terms, script_entry: entry}}), false);
    assert.equal(scriptCardHold({...terms, script_entry: entry}), null);
  }
  for (const entry of [undefined, null, 3, ['evaluate_v3']]) {
    assert.equal(isScriptEntry(entry), false);
    assert.equal(
      scriptRunOf({...terms, script_entry: entry as unknown as string}),
      null,
    );
  }
  // The single entry v0.9.0 exported is still v2 alone, for a host that imported it.
  assert.equal(SCRIPT_ENTRY_C, 'evaluate_v2');
});

test('a C card’s code signature is carried exactly when the card carries one', () => {
  const terms = {
    tickers: 'HDFCBANK',
    script_entry: 'evaluate_v2',
    script: 'def evaluate_v2(ctx): ...',
    script_hash: 'abc123',
  };
  assert.notEqual(scriptRunOf(terms), null);
  assert.equal(
    scriptRunOf({...terms, script_sig: 'sig-1'})?.scriptSig,
    'sig-1',
  );
  // None, or an empty one (which the backend reads as none), is not invented as a key.
  assert.equal('scriptSig' in (scriptRunOf(terms) ?? {}), false);
  assert.equal(
    'scriptSig' in (scriptRunOf({...terms, script_sig: ''}) ?? {}),
    false,
  );
  // A card can arrive with a JSON null where a string belongs.
  assert.equal(
    'scriptSig' in
      (scriptRunOf({...terms, script_sig: null as unknown as string}) ?? {}),
    false,
  );
  // A signature does not make a card a C card on its own.
  assert.equal(
    scriptRunOf({...terms, script_sig: 'sig-1', script_entry: 'evaluate'}),
    null,
  );
});

test('tickers are split at a comma with any spaces around it, and a stray comma is not one symbol', () => {
  assert.deepEqual(tickersOf('HDFCBANK'), ['HDFCBANK']);
  assert.deepEqual(tickersOf('  HDFCBANK '), ['HDFCBANK']);
  assert.deepEqual(tickersOf('HDFCBANK, ICICIBANK'), ['HDFCBANK', 'ICICIBANK']);
  assert.deepEqual(tickersOf('HDFCBANK ,ICICIBANK,SBIN'), [
    'HDFCBANK',
    'ICICIBANK',
    'SBIN',
  ]);
  // Only a comma separates: a name with a space in it is one symbol.
  assert.deepEqual(tickersOf('NIFTY 50'), ['NIFTY 50']);
  assert.deepEqual(tickersOf('HDFCBANK,'), ['HDFCBANK', '']);
  assert.deepEqual(tickersOf(', '), ['', '']);
  for (const none of ['', '   ', undefined, null]) {
    assert.deepEqual(tickersOf(none), []);
  }
  assert.equal(TICKER_SEPARATOR.test('A , B'), true);
});

/**
 * Every spelling a card's `tickers` has been seen in or could be, with its verdict: null is one
 * clean symbol (the card can start), anything else the reason it is held. A comma is the only
 * separator, so any other one leaves a single part that is no symbol: unreadable, never one symbol.
 */
const TICKER_VERDICTS: readonly (readonly [string, TickersHold | null])[] = [
  ['HDFCBANK', null],
  [' HDFCBANK ', null],
  ['hdfcbank', null],
  ['M&M', null],
  ['BAJAJ-AUTO', null],
  ['NIFTY24OCTFUT', null],
  // The tradable indices by their spaced names, as NSE_INDICES spells them.
  ['NIFTY 50', null],
  ['NIFTY BANK', null],
  ['nifty bank', null],
  ['HDFCBANK, ICICIBANK', 'severalSymbols'],
  ['HDFCBANK,ICICIBANK', 'severalSymbols'],
  ['NIFTY24OCTFUT, RELIANCE', 'severalSymbols'],
  [',HDFCBANK', 'unreadableSymbols'],
  ['HDFCBANK,', 'unreadableSymbols'],
  ['HDFCBANK, ,', 'unreadableSymbols'],
  ['HDFCBANK ICICIBANK', 'unreadableSymbols'],
  ['HDFCBANK;ICICIBANK', 'unreadableSymbols'],
  ['HDFCBANK/ICICIBANK', 'unreadableSymbols'],
  ['HDFCBANK\nICICIBANK', 'unreadableSymbols'],
  ['NIFTY  50', 'unreadableSymbols'],
  // An index with a space that is not one of the tradable ones is not taken on trust.
  ['NIFTY 100', 'unreadableSymbols'],
  ['', 'noSymbol'],
  [' ', 'noSymbol'],
  [',', 'noSymbol'],
  [', ', 'noSymbol'],
  [' , , ', 'noSymbol'],
];

test('tickers are exactly one clean symbol, or held for why: each spelling, its verdict and reason', () => {
  for (const [tickers, reason] of TICKER_VERDICTS) {
    assert.equal(tickersHold(tickers), reason, JSON.stringify(tickers));
    assert.equal(
      isOneSymbol(tickers),
      reason === null,
      JSON.stringify(tickers),
    );
  }
  // Not a string is no symbol, and no throw.
  for (const notString of [['HDFCBANK'], 7, null, undefined, {}]) {
    assert.equal(tickersHold(notString), 'noSymbol');
    assert.deepEqual(tickersOf(notString), []);
  }
});

// Every run of a card sends its tickers as one `symbol`, which backend-go's cardRow makes ONE
// symbol: "HDFCBANK, ICICIBANK" is a symbol no runner trades, under a card that says Running, and
// the card's one amount is shown for what the code may buy of each. A v2 card's code is no
// different here: both are held, and both were startable before.
test('a C card is held unless its tickers are one clean symbol: v2 and v3 alike, a C card still', () => {
  for (const entry of SCRIPT_ENTRIES_C) {
    const terms = {
      tickers: 'HDFCBANK',
      script_entry: entry,
      script: `def ${entry}(ctx): ...`,
      script_hash: 'abc123',
      script_sig: 'sig-1',
      strategy_id: '6f1c2a7e-0d4b-4c3e-9a1f-2b3c4d5e6f70',
    };
    for (const [tickers, reason] of TICKER_VERDICTS) {
      const card = {...terms, tickers};
      const label = `${entry} ${JSON.stringify(tickers)}`;
      assert.equal(scriptCardHold(card), reason, label);
      assert.equal(scriptRunOf(card) === null, reason !== null, label);
      assert.equal(isScriptCard({terms: card}), true, label);
    }
    for (const held of [
      without(terms, 'tickers'),
      {...terms, tickers: ['HDFCBANK'] as unknown as string},
      {...terms, tickers: 7 as unknown as string},
    ]) {
      assert.equal(scriptCardHold(held), 'noSymbol', entry);
      assert.equal(scriptRunOf(held), null);
      assert.equal(isScriptCard({terms: held}), true);
    }
  }
});

test('a card whose tickers are not a string reads as naming no symbol, without throwing', () => {
  for (const tickers of [['HDFCBANK', 'SBIN'], 7]) {
    assert.equal(
      termsToConfig({tickers: tickers as unknown as string, timeframe: '1d'}),
      null,
    );
  }
});

// types/backtest: `runnable: false` is a composed script the engine cannot run yet. Web starts it
// anyway; here it is held, ahead of what its symbols say.
test('a C card whose code the engine cannot run yet is held, whatever it names', () => {
  const terms = {
    tickers: 'HDFCBANK',
    script_entry: 'evaluate_v3',
    script: 'def evaluate_v3(ctx, symbols): ...',
    script_hash: 'abc123',
  };
  assert.equal(scriptCardHold({...terms, runnable: false}), 'notRunnable');
  assert.equal(scriptRunOf({...terms, runnable: false}), null);
  assert.equal(isScriptCard({terms: {...terms, runnable: false}}), true);
  assert.equal(
    scriptCardHold({...terms, tickers: 'HDFCBANK, SBIN', runnable: false}),
    'notRunnable',
  );
  // Only an explicit false holds it: true, or no word at all, is the card as it was.
  assert.equal(scriptCardHold({...terms, runnable: true}), null);
  assert.equal(scriptCardHold(terms), null);
  // And none of it is said of a card that is not a C card.
  assert.equal(
    scriptCardHold({...terms, script_entry: 'evaluate', runnable: false}),
    null,
  );
  assert.equal(scriptCardHold(undefined), null);
});

test('extractSetupConfig reads the confirm table rows back into a request', () => {
  const config = extractSetupConfig([
    {k: 'Tickers', v: 'tcs'},
    {k: 'Strategy Name', v: 'RSI Dip'},
    {k: 'Timeframe', v: '1h (user preferred)'},
    {k: 'Backtest Period', v: '2025-01-01 to 2025-06-30'},
    {k: 'Position Sizing', v: '₹1,00,000'},
    {k: 'Sizing Mode', v: 'percent of capital'},
    {k: 'Total Capital', v: '₹5,00,000'},
    {k: 'Entry Condition', v: 'RSI < 30'},
    {k: 'Exit Condition', v: 'RSI > 70'},
    {k: 'Intraday', v: 'Yes'},
    {k: 'F&O Mode', v: 'no'},
    {k: 'Execution Mode', v: 'watchlist'},
    {k: 'Notes'},
  ]);
  assert.deepEqual(config, {
    symbol: 'TCS',
    strategy_hname: 'RSI Dip',
    timeframe: '1h',
    start_date: '2025-01-01',
    end_date: '2025-06-30',
    allocated_amount: 100000,
    sizing_mode: 'PERCENT',
    total_capital: 500000,
    original_query: 'RSI < 30\nRSI > 70',
    is_intraday: true,
    is_fno: false,
    execution_mode: 'WATCHLIST',
  });
  assert.equal(normalizeSetupKey('Backtest  Period'), 'backtest_period');
});

test('extractSetupConfig: sizing keywords, execution modes and explicit dates', () => {
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: 'risk %'}]).sizing_mode,
    'RISK_PERCENT',
  );
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: 'Quantity'}]).sizing_mode,
    'QTY',
  );
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: 'fixed amount'}]).sizing_mode,
    'AMOUNT',
  );
  // "2 lots" (F&O) and "10 shares" (equity) are how the sizing row is written; either is a QTY.
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: '2 lots'}]).sizing_mode,
    'QTY',
  );
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: '10 shares'}]).sizing_mode,
    'QTY',
  );
  assert.equal(
    extractSetupConfig([{k: 'sizing_mode', v: 'per trade'}]).sizing_mode,
    undefined,
  );
  assert.equal(
    extractSetupConfig([{k: 'execution_mode', v: 'once'}]).execution_mode,
    'ONCE',
  );
  assert.equal(
    extractSetupConfig([{k: 'execution_mode', v: 'whatever'}]).execution_mode,
    'LOOP',
  );
  assert.equal(
    extractSetupConfig([{k: 'timeframe', v: 'daily'}]).timeframe,
    undefined,
  );
  assert.deepEqual(
    extractSetupConfig([
      {k: 'start_date', v: '2025-01-01'},
      {k: 'end_date', v: '2025-02-01'},
    ]),
    {
      start_date: '2025-01-01',
      end_date: '2025-02-01',
    },
  );
});

test('termsToConfig takes the machine terms over the prose rows', () => {
  assert.equal(termsToConfig(undefined), null);
  assert.equal(termsToConfig({strategy_name: 'x'}), null);
  const fsm = {initial_state: 'IDLE'};
  assert.deepEqual(
    termsToConfig({
      tickers: ' tcs ',
      strategy_name: 'RSI Dip',
      entry_condition: 'RSI < 30',
      exit_condition: 'RSI > 70',
      timeframe: '15m',
      position_sizing: '₹1,00,000',
      total_capital: '5,00,000',
      sizing_mode: 'PERCENT',
      execution_mode: 'LOOP',
      intraday: true,
      backtest_start: '2025-01-01',
      backtest_end: '2025-06-30',
      fsm,
    }),
    {
      symbol: 'TCS',
      strategy_hname: 'RSI Dip',
      timeframe: '15m',
      start_date: '2025-01-01',
      end_date: '2025-06-30',
      allocated_amount: 100000,
      total_capital: 500000,
      sizing_mode: 'PERCENT',
      execution_mode: 'LOOP',
      is_intraday: true,
      is_fno: false,
      original_query: 'RSI < 30\nRSI > 70',
      fsm,
    },
  );
  const nameOnly = termsToConfig({
    tickers: 'TCS',
    strategy_name: '9/21 EMA Crossover',
    sizing_mode: 'shares',
  });
  assert.equal(nameOnly?.original_query, '9/21 EMA Crossover');
  assert.equal(nameOnly && 'sizing_mode' in nameOnly, false);
  assert.equal(
    setupConfig([{k: 'Tickers', v: 'INFY'}], {tickers: 'TCS'}).symbol,
    'TCS',
  );
  assert.equal(setupConfig([{k: 'Tickers', v: 'INFY'}]).symbol, 'INFY');
});
