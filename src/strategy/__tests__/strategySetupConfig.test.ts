import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  extractSetupConfig,
  isScriptCard,
  isScriptEntry,
  normalizeSetupKey,
  SCRIPT_ENTRIES_C,
  SCRIPT_ENTRY_C,
  scriptRunOf,
  setupConfig,
  termsToConfig,
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
    tickers: 'HDFCBANK, ICICIBANK',
    script_entry: 'evaluate_v3',
    script: 'def evaluate_v3(ctx, symbols): ...',
    script_hash: 'v3-hash',
    script_sig: 'v3-sig',
    strategy_id: '6f1c2a7e-0d4b-4c3e-9a1f-2b3c4d5e6f70',
    backtest_id: '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d',
  };
  assert.deepEqual(SCRIPT_ENTRIES_C, ['evaluate_v2', 'evaluate_v3']);
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
    script_entry: 'evaluate_v2',
    script: 'def evaluate_v2(ctx): ...',
    script_hash: 'abc123',
  };
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
