import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  extractSetupConfig,
  isScriptCard,
  normalizeSetupKey,
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
