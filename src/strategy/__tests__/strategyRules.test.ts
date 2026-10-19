import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ScreenerStrategy} from '../../types/screener.ts';
import {
  buildConsoleRules,
  buildConsoleRulesDraft,
  buildScreenerStrategySpec,
  buildStrategyRules,
} from '../strategyRules.ts';
import {athenaRow, sparseRow, strategy, UUID_A} from './fixtures.ts';

const base = strategy({
  strategy_id: UUID_A,
  symbol: 'CUSTOM_LIST',
  original_query: 'Buy when RSI < 30. Exit when RSI > 70',
  take_profit: 5,
  stop_loss: 2,
  budget_config: {val: 50000, mode: 'AMOUNT'},
  timeframe: '15m',
  rules: {
    entry: [],
    exit: [],
    nlp_triggers: [{id: '1', summary: 'Exit on bad news'}],
  },
});

test('buildStrategyRules compiles the deploy card rows from real fields only', () => {
  assert.deepEqual(
    buildStrategyRules(base, {mode: 'LIVE', brokerName: 'Zerodha'}),
    [
      {k: 'Universe', v: 'Custom list'},
      {k: 'Entry rule', v: 'RSI < 30'},
      {k: 'Exit rule', v: 'TP +5% · SL −2% · Exit on bad news'},
      {k: 'Position size', v: '₹50,000'},
      {k: 'Timeframe', v: '15m'},
      {k: 'Execution', v: 'Zerodha'},
    ],
  );
});

test('buildStrategyRules: overrides, empty overrides, intraday, QTY and mock execution', () => {
  const rows = buildStrategyRules(
    strategy({
      ...base,
      is_intraday: true,
      budget_config: {val: 5, mode: 'QTY'},
      take_profit: null,
      stop_loss: null,
      rules: null,
      original_query: '',
    }),
    {
      mode: 'MOCK',
      symbolOverride: '',
      timeframeOverride: '',
      capitalOverride: 1000,
      entryOverride: 'EMA 9 crosses above EMA 21',
    },
  );
  assert.deepEqual(rows, [
    {k: 'Universe', v: 'Custom list'},
    {k: 'Entry rule', v: 'EMA 9 crosses above EMA 21'},
    {k: 'Position size', v: '1,000 shares'},
    {k: 'Timeframe', v: 'Intraday · square off same day'},
    {k: 'Execution', v: 'Simulated — no broker'},
  ]);
  // QTY is a lot count in F&O: the F&O executor multiplies it by the lot size.
  const lots = (val: number) =>
    buildStrategyRules(
      strategy({
        ...base,
        is_fno: true,
        budget_config: {val, mode: 'QTY'},
      }),
      {mode: 'MOCK'},
    ).find(row => row.k === 'Position size')?.v;
  assert.equal(lots(1), '1 lot');
  assert.equal(lots(3), '3 lots');
  assert.equal(
    buildStrategyRules(base, {mode: 'LIVE'}).at(-1)?.v,
    'Connected broker',
  );
  assert.equal(
    buildStrategyRules(base, {mode: 'LIVE', symbolOverride: 'INFY'})[0]?.v,
    'INFY',
  );
});

const pick: ScreenerStrategy = {
  id: 7,
  name: 'EMA cross',
  description:
    'Buy when price crosses above EMA 20. Sell when it crosses below.',
  symbol: 'NIFTY100',
  is_premium: false,
  is_intraday: true,
  todays_symbol: 'TCS',
  created_at: '2026-01-01',
};

test('buildScreenerStrategySpec previews a pick that has no strategy row yet', () => {
  assert.deepEqual(
    buildScreenerStrategySpec(pick, {mode: 'LIVE', capital: 10000}),
    [
      {k: 'Universe', v: 'TCS'},
      {k: 'Entry rule', v: 'price crosses above EMA 20'},
      {k: 'Exit rule', v: 'it crosses below.'},
      {k: 'Position size', v: '₹10,000.00'},
      {k: 'Timeframe', v: 'Intraday · square off same day'},
      {k: 'Execution', v: 'Connected broker'},
    ],
  );
});

test('buildConsoleRules projects the model into read-only rows, sized per budget mode', () => {
  const qty = buildConsoleRules(
    strategy({
      ...base,
      symbol: 'NIFTY2681824400PE',
      budget_config: {val: 2, mode: 'QTY'},
      timeframe: '1d',
      is_intraday: true,
      is_fno: true,
      rules: null,
    }),
    100000,
  );
  assert.deepEqual(qty, {
    universe: 'NIFTY',
    timeframe: '1D',
    entry: 'Buy when RSI < 30. Exit when RSI > 70',
    takeProfit: '+5%',
    stopLoss: '-2%',
    timeExit: 'Square off same day',
    capital: '2 lots',
    sizingMethod: 'QTY',
    fsm: null,
  });
  assert.equal(
    buildConsoleRules(
      strategy({...base, budget_config: {val: 1, mode: 'QTY'}}),
      100000,
    ).capital,
    '1 share',
  );
  const amount = buildConsoleRules(base, 100000);
  assert.equal(amount.universe, 'Custom list');
  assert.equal(amount.capital, '₹1,00,000');
  assert.equal(amount.sizingMethod, 'Fixed amount');
  assert.equal(amount.timeExit, undefined);
  assert.deepEqual(amount.fsm, base.rules);
});

test('buildConsoleRulesDraft preserves the sizing mode and total pool', () => {
  const normalize = (raw?: string | null) => (raw ?? '1d').toUpperCase();
  const draft = buildConsoleRulesDraft(
    strategy({
      ...base,
      budget_config: {val: 1, mode: 'RISK_PERCENT', total: 500000},
      is_parent: true,
    }),
    100000,
    normalize,
  );
  assert.deepEqual(draft, {
    capital: 1,
    sizingMode: 'RISK_PERCENT',
    totalCapital: 500000,
    entryQuery: 'Buy when RSI < 30. Exit when RSI > 70',
    symbol: 'CUSTOM_LIST',
    timeframe: '15M',
    rawFSM: base.fsm,
    strategyId: UUID_A,
    isParent: true,
    isIntraday: false,
    executionMode: 'LOOP',
    isFno: false,
  });
  assert.equal(
    buildConsoleRulesDraft(base, 100000, normalize).sizingMode,
    'AMOUNT',
  );
  assert.equal(
    'totalCapital' in buildConsoleRulesDraft(base, 100000, normalize),
    false,
  );
});

test('an Athena script row states no position size: its val is the total capital', () => {
  const script = athenaRow();
  const rows = buildStrategyRules(script, {mode: 'MOCK'});
  assert.equal(
    rows.find(row => row.k === 'Position size'),
    undefined,
  );
  assert.deepEqual(
    rows.find(row => row.k === 'Universe'),
    {k: 'Universe', v: 'RELIANCE'},
  );
  assert.equal(
    buildStrategyRules(script, {mode: 'MOCK', capitalOverride: 50000}).find(
      row => row.k === 'Position size',
    )?.v,
    '₹50,000',
  );

  const rules = buildConsoleRules(script, 200000);
  assert.equal(rules.capital, '₹2,00,000');
  assert.equal(rules.sizingMethod, undefined);
  assert.equal(rules.fsm, null);

  const draft = buildConsoleRulesDraft(script, 0, raw => raw ?? '');
  assert.equal(draft.sizingMode, 'AMOUNT');
  assert.equal(draft.capital, 200000);
  assert.equal(draft.rawFSM, null);
});

test('an Athena script sized by quantity states its count, never its capital as rupees', () => {
  const lots = athenaRow({
    budget_config: {val: 100000, type: 'QTY', qty: 2},
    is_fno: true,
  });
  assert.equal(
    buildStrategyRules(lots, {mode: 'MOCK'}).find(
      row => row.k === 'Position size',
    )?.v,
    '2 lots',
  );
  const rules = buildConsoleRules(lots, 100000);
  assert.equal(rules.capital, '2 lots');
  assert.equal(rules.sizingMethod, 'QTY');
  const draft = buildConsoleRulesDraft(lots, 100000, raw => raw ?? '');
  assert.equal(draft.sizingMode, 'QTY');
  assert.equal(draft.capital, 2);

  const shares = athenaRow({budget_config: {val: 100000, type: 'QTY', qty: 1}});
  assert.equal(buildConsoleRules(shares, 100000).capital, '1 share');
  // No count to read: no size, not the 1,00,000 passed in.
  const unread = athenaRow({budget_config: {val: 100000, type: 'QTY'}});
  assert.equal(buildConsoleRules(unread, 100000).capital, undefined);
  const unreadDraft = buildConsoleRulesDraft(unread, 100000, raw => raw ?? '');
  assert.equal(unreadDraft.sizingMode, 'QTY');
  assert.equal('capital' in unreadDraft, false);
  assert.equal(
    'capital' in
      buildConsoleRulesDraft(
        strategy({...base, budget_config: {mode: 'QTY'}}),
        100000,
        raw => raw ?? '',
      ),
    false,
  );
  assert.equal(
    buildStrategyRules(unread, {mode: 'MOCK'}).find(
      row => row.k === 'Position size',
    ),
    undefined,
  );
});

test('a mode that is not a string reads as none, and a missing val falls back', () => {
  const odd = {
    ...base,
    budget_config: {mode: 7},
  } as unknown as Parameters<typeof buildConsoleRules>[0];
  assert.equal(buildConsoleRules(odd, 100000).capital, '₹1,00,000');
  assert.equal(
    buildConsoleRulesDraft(odd, 100000, raw => raw ?? '').sizingMode,
    'AMOUNT',
  );
  assert.equal(
    buildConsoleRulesDraft(odd, 100000, raw => raw ?? '').capital,
    100000,
  );
  assert.equal(
    buildStrategyRules(odd, {mode: 'MOCK'}).find(
      row => row.k === 'Position size',
    ),
    undefined,
  );
});

test('a script row that gained a mode still states no position size; a sparse row builds its rows', () => {
  const withMode = athenaRow({
    budget_config: {val: 200000, mode: 'AMOUNT', allocate: '25%'},
  });
  assert.equal(
    buildStrategyRules(withMode, {mode: 'MOCK'}).find(
      row => row.k === 'Position size',
    ),
    undefined,
  );
  // No mode, FSM or rules: a script by what it lacks.
  assert.equal(
    buildStrategyRules(
      strategy({strategy_id: UUID_A, budget_config: {val: 50000}}),
      {mode: 'MOCK'},
    ).find(row => row.k === 'Position size'),
    undefined,
  );

  const sparse = sparseRow();
  assert.deepEqual(buildStrategyRules(sparse, {mode: 'MOCK'}), [
    {k: 'Execution', v: 'Simulated — no broker'},
  ]);
  assert.deepEqual(buildConsoleRules(sparse, 0), {universe: '', fsm: null});
  const draft = buildConsoleRulesDraft(sparse, 0, raw => raw ?? '');
  assert.equal(draft.symbol, '');
  assert.equal(draft.entryQuery, '');
  assert.equal(draft.sizingMode, 'AMOUNT');
});
