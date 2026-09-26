import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatCurrency, formatNumber} from '../../format/number.ts';
import type {RuleLeaf, StrategyRuleValues} from '../../types/strategyRun.ts';
import {
  ENTRY_PARTS,
  entryTokenKey,
  parseEntryTokenKey,
  parseRuleFsm,
  qtyUnit,
  ruleRepeat,
  type SizingParts,
  sizingParts,
  strategyRuleParts,
  type StrategyRuleParts,
  takeProfitPct,
  withEntryLeafField,
  withTakeProfitPct,
  type WordedTimeframe,
  wordedTimeframe,
} from '../strategyRuleEdit.ts';

// The compiler's shapes: an AND entry, a comment-tagged take profit and stop loss, a signal exit,
// a self-looping trade-count reset and a news trigger.
const longFsm = {
  initial_state: 'IDLE',
  states: {
    IDLE: {
      transitions: [
        {
          condition: {
            logic: 'AND',
            conditions: [
              {var: 'rsi14', op: '<', val: 30},
              {var: 'close', op: '>', val: 'ema_200'},
            ],
          },
          next_state: 'LONG',
        },
      ],
    },
    LONG: {
      transitions: [
        {
          condition: {var: 'high_price', op: '>=', val: '$entry_price * 1.05'},
          next_state: 'IDLE',
          comment: 'Take profit at 5.0%',
        },
        {
          condition: {var: 'low_price', op: '<=', val: '$entry_price * 0.98'},
          next_state: 'IDLE',
          comment: 'Stop loss at 2.0%',
        },
        {condition: {var: 'rsi14', op: '>', val: 70}, next_state: 'IDLE'},
        {
          condition: {var: 'trade_count', op: '>=', val: 3},
          next_state: 'LONG',
        },
      ],
    },
  },
  nlp_triggers: [{id: 'n1', summary: 'the company cuts guidance'}],
};

const orFsm = {
  initial_state: 'FLAT',
  states: {
    FLAT: {
      transitions: [
        {
          condition: {
            logic: 'OR',
            conditions: [
              {var: 'ema9', op: 'crosses_above', val: 'ema21'},
              {var: 'macd_8_21_9', op: 'crosses_above', val: 'macd_signal'},
            ],
          },
          next_state: 'IN',
        },
      ],
    },
    IN: {
      transitions: [
        {
          condition: {var: 'ema9', op: 'crosses_below', val: 'ema21'},
          next_state: 'FLAT',
        },
      ],
    },
  },
};

const leaf = (o: Partial<RuleLeaf>): RuleLeaf => ({
  indicator: '',
  operator: '',
  value: '',
  numeric: null,
  rawIndicator: '',
  rawOperator: '',
  path: [],
  ...o,
});

test('an FSM reads as entry thresholds, exits and news triggers, self-loops left out', () => {
  assert.deepEqual(parseRuleFsm(longFsm), {
    entries: [
      {
        transitionIndex: 0,
        logic: 'AND',
        leaves: [
          leaf({
            indicator: 'RSI (14)',
            operator: 'below',
            value: '30',
            numeric: 30,
            rawIndicator: 'rsi14',
            rawOperator: '<',
            path: [0],
          }),
          leaf({
            indicator: 'Price',
            operator: 'above',
            value: 'EMA (200)',
            rawIndicator: 'close',
            rawOperator: '>',
            path: [1],
          }),
        ],
      },
    ],
    exits: [
      {
        kind: 'take_profit',
        pct: 5,
        editablePct: true,
        falling: false,
        logic: 'AND',
        leaves: [
          leaf({
            indicator: 'Price',
            operator: 'at or above',
            value: '$entry_price * 1.05',
            rawIndicator: 'high_price',
            rawOperator: '>=',
          }),
        ],
      },
      {
        kind: 'stop_loss',
        pct: 2,
        editablePct: false,
        falling: true,
        logic: 'AND',
        leaves: [
          leaf({
            indicator: 'Price',
            operator: 'at or below',
            value: '$entry_price * 0.98',
            rawIndicator: 'low_price',
            rawOperator: '<=',
          }),
        ],
      },
      {
        kind: 'signal',
        editablePct: false,
        falling: false,
        logic: 'AND',
        leaves: [
          leaf({
            indicator: 'RSI (14)',
            operator: 'above',
            value: '70',
            numeric: 70,
            rawIndicator: 'rsi14',
            rawOperator: '>',
          }),
        ],
      },
    ],
    nlpTriggers: [{id: 'n1', summary: 'the company cuts guidance'}],
    // Price is what every rule watches, so it is not listed as data the rule reads.
    indicators: ['RSI (14)'],
  });
});

test('an OR entry keeps its logic, each leaf its path, and names read as the catalogue does', () => {
  const parsed = parseRuleFsm(orFsm);
  assert.equal(parsed?.entries[0]?.logic, 'OR');
  assert.deepEqual(
    parsed?.entries[0]?.leaves.map(l => [
      l.indicator,
      l.operator,
      l.value,
      l.path,
    ]),
    [
      ['EMA (9)', 'crosses above', 'EMA (21)', [0]],
      ['MACD_8_21_9', 'crosses above', 'MACD_SIGNAL', [1]],
    ],
  );
  assert.equal(parsed?.exits[0]?.falling, true);
  assert.deepEqual(parsed?.indicators, ['EMA (9)', 'MACD_8_21_9']);

  const nested = parseRuleFsm({
    initial_state: 'A',
    states: {
      A: {
        transitions: [
          {
            condition: {
              logic: 'OR',
              conditions: [
                {var: 'rsi_14', op: '<', val: '25'},
                {
                  logic: 'AND',
                  conditions: [
                    {var: 'close', op: '>', val: 'vwap'},
                    {var: 'volume', op: '>', val: 100000},
                  ],
                },
              ],
            },
            next_state: 'B',
          },
        ],
      },
    },
  });
  assert.deepEqual(
    nested?.entries[0]?.leaves.map(l => [l.indicator, l.numeric, l.path]),
    [
      ['RSI (14)', 25, [0]],
      ['Price', null, [1, 0]],
      ['Volume', 100000, [1, 1]],
    ],
  );
});

test('only the compiler’s own take profit is editable; premium exits and other shapes are shown as they are', () => {
  const parsed = parseRuleFsm({
    initial_state: 'IDLE',
    states: {
      IDLE: {
        transitions: [{condition: {var: 'close', op: '>', val: 1}}],
      },
      SHORT: {
        transitions: [
          {
            condition: {var: 'low_price', op: '<=', val: '$entry_price * 0.99'},
            comment: 'Take profit at 1.0%',
          },
          {
            condition: {var: 'premium', op: '>=', val: '$entry_premium * 1.25'},
            comment: 'Premium SL hit at 25%',
          },
          {
            condition: {var: 'premium', op: '<=', val: '$entry_premium * 0.5'},
            comment: 'Premium TP at 50%',
          },
          {
            condition: {var: 'close', op: '>', val: '$entry_price * 1.1'},
            comment: 'Take profit at 10%',
          },
        ],
      },
    },
  });
  assert.deepEqual(
    parsed?.exits.map(e => [e.kind, e.pct, e.editablePct, e.falling]),
    [
      ['take_profit', 1, true, true],
      ['stop_loss', 25, false, false],
      ['take_profit', 50, false, true],
      // `>` is not the compiler's `>=`, so rewriting its multiple would change what it means.
      ['take_profit', 10, false, false],
    ],
  );
});

test('an FSM with nothing to draw reads as null, and a news-only one still reads', () => {
  for (const fsm of [
    null,
    undefined,
    'fsm',
    {states: {}},
    {initial_state: 'A'},
    {initial_state: 'A', states: {A: {transitions: []}}},
    // Prose the backend could not parse: no var, so no leaf.
    {initial_state: 'A', states: {A: {transitions: [{condition: {}}]}}},
  ]) {
    assert.equal(parseRuleFsm(fsm), null, JSON.stringify(fsm));
  }
  assert.deepEqual(
    parseRuleFsm({
      initial_state: 'A',
      states: {A: {transitions: []}},
      nlp_triggers: [{id: 't', summary: 'RBI surprises'}],
    }),
    {
      entries: [],
      exits: [],
      nlpTriggers: [{id: 't', summary: 'RBI surprises'}],
      indicators: [],
    },
  );
});

test('an entry leaf is rewritten in a copy, one field at a time', () => {
  const next = withEntryLeafField(longFsm, 0, [0], 'entry', 25);
  assert.notEqual(next, longFsm);
  assert.deepEqual(
    parseRuleFsm(next)?.entries[0]?.leaves.map(l => l.value),
    ['25', 'EMA (200)'],
  );
  assert.equal(
    longFsm.states.IDLE.transitions[0]?.condition.conditions[0]?.val,
    30,
  );

  const retargeted = withEntryLeafField(
    withEntryLeafField(longFsm, 0, [1], 'entryVar', 'ema50'),
    0,
    [1],
    'entryOp',
    '>=',
  );
  assert.deepEqual(
    parseRuleFsm(retargeted)?.entries[0]?.leaves[1],
    leaf({
      indicator: 'EMA (50)',
      operator: 'at or above',
      value: 'EMA (200)',
      rawIndicator: 'ema50',
      rawOperator: '>=',
      path: [1],
    }),
  );
});

test('a leaf that is not a plain triple is never written over', () => {
  // The compound node itself, a path past the end, a transition that does not exist and a
  // threshold that is not a number all leave the FSM exactly as it was.
  assert.equal(withEntryLeafField(longFsm, 0, [], 'entry', 1), longFsm);
  assert.equal(withEntryLeafField(longFsm, 0, [7], 'entryVar', 'x'), longFsm);
  assert.equal(withEntryLeafField(longFsm, 3, [0], 'entry', 1), longFsm);
  assert.equal(withEntryLeafField(longFsm, 0, [1], 'entry', 1), longFsm);
  assert.equal(withEntryLeafField(null, 0, [], 'entry', 1), null);
  const prose = {
    initial_state: 'A',
    states: {A: {transitions: [{condition: {logic: 'AND'}}]}},
  };
  assert.equal(withEntryLeafField(prose, 0, [], 'entryVar', 'rsi14'), prose);
});

test('a take profit is rewritten through its multiple and its comment, long and short', () => {
  assert.equal(takeProfitPct(longFsm), 5);
  const next = withTakeProfitPct(longFsm, 2.5);
  assert.equal(takeProfitPct(next), 2.5);
  const exits = (next as typeof longFsm).states.LONG.transitions;
  assert.deepEqual(exits[0], {
    condition: {var: 'high_price', op: '>=', val: '$entry_price * 1.025'},
    next_state: 'IDLE',
    comment: 'Take profit at 2.5%',
  });
  // The stop loss beside it is not a take profit and is left alone.
  assert.deepEqual(exits[1], longFsm.states.LONG.transitions[1]);

  const short = {
    initial_state: 'FLAT',
    states: {
      FLAT: {transitions: [{condition: {var: 'rsi14', op: '>', val: 70}}]},
      SHORT: {
        transitions: [
          {
            condition: {var: 'low_price', op: '<=', val: '$entry_price * 0.99'},
            comment: 'Take profit at 1.0% (short)',
          },
        ],
      },
    },
  };
  assert.deepEqual(
    (withTakeProfitPct(short, 3) as typeof short).states.SHORT.transitions[0],
    {
      condition: {var: 'low_price', op: '<=', val: '$entry_price * 0.97'},
      comment: 'Take profit at 3% (short)',
    },
  );
  // Nothing to rewrite: the same FSM comes back, not a copy.
  assert.equal(withTakeProfitPct(orFsm, 2), orFsm);
  assert.equal(takeProfitPct(orFsm), undefined);
});

test('an entry token key addresses one part of one leaf and parses back', () => {
  assert.deepEqual([...ENTRY_PARTS], ['entry', 'entryOp', 'entryVar']);
  assert.equal(entryTokenKey(2, [1, 0]), 'entry:2:1.0');
  assert.equal(entryTokenKey(0, [], 'entryVar'), 'entryVar:0:');
  for (const part of ENTRY_PARTS) {
    assert.deepEqual(parseEntryTokenKey(entryTokenKey(3, [0, 2], part)), {
      part,
      transitionIndex: 3,
      path: [0, 2],
    });
  }
  assert.deepEqual(parseEntryTokenKey('entry:0:'), {
    part: 'entry',
    transitionIndex: 0,
    path: [],
  });
  for (const key of ['symbol', 'entry:x:1', 'exit:1:0', '', 'entryOp']) {
    assert.equal(parseEntryTokenKey(key), null, key);
  }
});

test('the parts a size, a candle and a repeat are worded from', () => {
  assert.equal(qtyUnit(true), 'lot');
  assert.equal(qtyUnit(false), 'share');
  const size = (o: Partial<StrategyRuleValues>) =>
    sizingParts({amount: 5, sizingMode: 'AMOUNT', isFno: false, ...o});
  assert.deepEqual(size({sizingMode: 'QTY'}), {
    mode: 'QTY',
    count: 5,
    unit: 'share',
  });
  assert.deepEqual(size({sizingMode: 'QTY', isFno: true}), {
    mode: 'QTY',
    count: 5,
    unit: 'lot',
  });
  assert.deepEqual(size({sizingMode: 'PERCENT'}), {mode: 'PERCENT', pct: 5});
  assert.deepEqual(size({sizingMode: 'RISK_PERCENT'}), {
    mode: 'RISK_PERCENT',
    pct: 5,
  });
  assert.deepEqual(size({amount: 50000}), {mode: 'AMOUNT', amount: 50000});

  assert.equal(wordedTimeframe('1h'), '1h');
  assert.equal(wordedTimeframe('1d'), '1d');
  assert.equal(wordedTimeframe('1D'), undefined);
  assert.equal(wordedTimeframe('30m'), undefined);

  assert.equal(ruleRepeat('ONCE'), 'ONCE');
  assert.equal(ruleRepeat('WATCHLIST'), 'WATCHLIST');
  assert.equal(ruleRepeat('LOOP'), 'LOOP');
  assert.equal(ruleRepeat('auto'), 'LOOP');
});

const values = (o: Partial<StrategyRuleValues>): StrategyRuleValues => ({
  symbol: 'TCS',
  timeframe: '15m',
  amount: 50000,
  sizingMode: 'AMOUNT',
  isIntraday: false,
  executionMode: 'LOOP',
  isFno: false,
  fsm: longFsm,
  ...o,
});

const partsOf = (v: StrategyRuleValues) =>
  strategyRuleParts(v, parseRuleFsm(v.fsm));

test('a rule description is its parts: size, first entry, exits in order, repeat', () => {
  const parts = partsOf(values({isIntraday: true}));
  assert.equal(parts?.action, 'buy');
  assert.deepEqual(parts?.sizing, {mode: 'AMOUNT', amount: 50000});
  assert.equal(parts?.entry?.logic, 'AND');
  assert.deepEqual(
    parts?.exits.map(e => e.kind),
    ['take_profit', 'stop_loss', 'signal', 'news', 'square_off'],
  );
  assert.equal(parts?.repeat, 'LOOP');

  // A rupee budget says nothing about a derivative position, so F&O is sized only in lots.
  const fnoRupees = partsOf(values({isFno: true, symbol: 'NIFTY'}));
  assert.equal(fnoRupees?.action, 'enter');
  assert.equal(fnoRupees !== null && 'sizing' in fnoRupees, false);
  assert.deepEqual(
    partsOf(values({isFno: true, sizingMode: 'QTY', amount: 2}))?.sizing,
    {mode: 'QTY', count: 2, unit: 'lot'},
  );

  assert.equal(partsOf(values({fsm: null})), null);
  const newsOnly = partsOf(
    values({
      fsm: {
        initial_state: 'A',
        states: {A: {transitions: []}},
        nlp_triggers: [{id: 't', summary: 'RBI surprises'}],
      },
    }),
  );
  assert.equal(newsOnly !== null && 'entry' in newsOnly, false);
  assert.deepEqual(newsOnly?.exits, [{kind: 'news', summary: 'RBI surprises'}]);
});

// The web still reads these as one English sentence. Rebuilt here from the parts alone, it must
// match web's describeStrategyRule word for word, or the parts dropped something the sentence said.
const CANDLE: Record<WordedTimeframe, string> = {
  '1m': '1-min',
  '5m': '5-min',
  '15m': '15-min',
  '1h': 'hourly',
  '1d': 'daily',
};

const sizeWords = (s: SizingParts): string => {
  switch (s.mode) {
    case 'QTY':
      return `${formatNumber(s.count)} ${s.unit}${s.count === 1 ? '' : 's'}`;
    case 'PERCENT':
      return `${s.pct}% of capital`;
    case 'RISK_PERCENT':
      return `${s.pct}% risk`;
    case 'AMOUNT':
      return formatCurrency(s.amount, 0);
  }
};

const when = (logic: 'AND' | 'OR', leaves: RuleLeaf[]) =>
  leaves
    .map(l => `${l.indicator} ${l.operator} ${l.value}`.trim())
    .join(logic === 'OR' ? ' or ' : ' and ');

function sentence(p: StrategyRuleParts): string {
  const worded = wordedTimeframe(p.timeframe);
  const candle = worded ? CANDLE[worded] : p.timeframe;
  const size = p.sizing ? sizeWords(p.sizing) : '';
  const act =
    p.action === 'buy'
      ? `buys ${size} of ${p.symbol}`
      : p.sizing
        ? `enters ${size} of ${p.symbol}`
        : `enters ${p.symbol}`;
  const entry = p.entry ? ` when ${when(p.entry.logic, p.entry.leaves)}` : '';
  const exits = p.exits.map(e => {
    switch (e.kind) {
      case 'take_profit':
        return `at +${e.pct}% profit`;
      case 'stop_loss':
        return `at a ${e.pct}% stop loss`;
      case 'signal':
        return `when ${when(e.logic, e.leaves)}`;
      case 'news':
        return `on news: ${e.summary}`;
      case 'square_off':
        return 'at the intraday square-off';
    }
  });
  const last = exits.pop();
  const exitClause =
    last === undefined
      ? ''
      : `, then exits ${exits.length ? `${exits.join(', ')} or ${last}` : last}`;
  const repeat = {
    ONCE: 'Runs once.',
    WATCHLIST: 'Alerts on each match.',
    LOOP: 'Repeats after each exit.',
  }[p.repeat];
  return `On every ${candle} candle, ${act}${entry}${exitClause}. ${repeat}`;
}

test('the parts say everything web’s one-line description says', () => {
  const cases: [StrategyRuleValues, string][] = [
    [
      values({}),
      'On every 15-min candle, buys ₹50,000 of TCS when RSI (14) below 30 and Price above EMA (200), then exits at +5% profit, at a 2% stop loss, when RSI (14) above 70 or on news: the company cuts guidance. Repeats after each exit.',
    ],
    [
      values({
        symbol: 'NIFTY',
        isFno: true,
        sizingMode: 'QTY',
        amount: 2,
        timeframe: '5m',
        executionMode: 'ONCE',
        isIntraday: true,
        fsm: orFsm,
      }),
      'On every 5-min candle, enters 2 lots of NIFTY when EMA (9) crosses above EMA (21) or MACD_8_21_9 crosses above MACD_SIGNAL, then exits when EMA (9) crosses below EMA (21) or at the intraday square-off. Runs once.',
    ],
    [
      values({
        symbol: 'BANKNIFTY',
        isFno: true,
        amount: 100000,
        timeframe: '1d',
        executionMode: 'WATCHLIST',
        fsm: orFsm,
      }),
      'On every daily candle, enters BANKNIFTY when EMA (9) crosses above EMA (21) or MACD_8_21_9 crosses above MACD_SIGNAL, then exits when EMA (9) crosses below EMA (21). Alerts on each match.',
    ],
    [
      values({sizingMode: 'QTY', amount: 1, timeframe: '1h', fsm: orFsm}),
      'On every hourly candle, buys 1 share of TCS when EMA (9) crosses above EMA (21) or MACD_8_21_9 crosses above MACD_SIGNAL, then exits when EMA (9) crosses below EMA (21). Repeats after each exit.',
    ],
    [
      values({
        sizingMode: 'PERCENT',
        amount: 10,
        timeframe: '30m',
        fsm: {
          initial_state: 'IDLE',
          states: {IDLE: {transitions: []}},
          nlp_triggers: [{id: 'x', summary: 'RBI surprises'}],
        },
      }),
      'On every 30m candle, buys 10% of capital of TCS, then exits on news: RBI surprises. Repeats after each exit.',
    ],
  ];
  for (const [v, expected] of cases) {
    const parts = partsOf(v);
    assert.ok(parts);
    assert.equal(sentence(parts), expected);
  }
});
