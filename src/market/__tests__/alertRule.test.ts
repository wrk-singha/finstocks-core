import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  type AlertClause,
  appliesToEveryStock,
  buildAlert,
  clauseComplete,
  clauseFor,
  clauseFromSeed,
  clauseParts,
  dailyOnly,
  DEFAULT_CONTRACT,
  describeClause,
  formatAlertValue,
  isFnoAlert,
  levelAtPct,
  levelDirection,
  lineAt,
  opsFor,
  opVerb,
  parseAlertValue,
  priceWarning,
  savedAlertFrom,
  timeframeForCandle,
  type TrendLine,
  usesContract,
  usesFno,
} from '../alertRule.ts';
import {alertField} from '../../data/alertFields.ts';

const clause = (
  field: string,
  op: AlertClause['op'],
  value: number | null,
  extra: Partial<AlertClause> = {},
): AlertClause => ({key: 'k', field, op, value, ...extra});

const entry = (alert: ReturnType<typeof buildAlert>) =>
  alert?.fsm.states.IDLE.transitions[0];

const LINE: TrendLine = {
  fromEpoch: 1_758_000_000,
  fromPrice: 1200,
  toEpoch: 1_758_086_400,
  toPrice: 1260,
};

test('a picked field opens as the sentence people set for it', () => {
  const withoutKey = (c: AlertClause) => ({...c, key: undefined});
  assert.deepEqual(withoutKey(clauseFor('close_price')), {
    key: undefined,
    field: 'close_price',
    op: 'rises_above',
    value: null,
  });
  // A line is what price crosses, not a level of its own.
  assert.deepEqual(withoutKey(clauseFor('ema50')), {
    key: undefined,
    field: 'close_price',
    op: 'rises_above',
    value: null,
    target: 'ema50',
  });
  assert.equal(clauseFor('bullish_engulfing').op, 'appears');
  // The day's move opens on its middle preset.
  assert.equal(clauseFor('__day_move').value, 3);
  // A band's low end falls; a single threshold is crossed upward.
  assert.deepEqual(
    [clauseFor('rsi14').op, clauseFor('rsi14').value],
    ['falls_below', 30],
  );
  assert.deepEqual(
    [clauseFor('di_plus_14').op, clauseFor('di_plus_14').value],
    ['rises_above', 25],
  );
  // A daily number is a state, not a crossing.
  assert.equal(clauseFor('pe_ttm').op, 'is_above');
  assert.notEqual(clauseFor('rsi14').key, clauseFor('rsi14').key);
});

test('a seed names a field or the line it crosses, and keeps what it says', () => {
  const crossing = clauseFromSeed({field: 'close_price', target: 'ema50'});
  assert.equal(describeClause(crossing), 'price crosses above EMA 50');
  const below = clauseFromSeed({
    field: 'close_price',
    target: 'sma200',
    op: 'falls_below',
  });
  assert.equal(describeClause(below), 'price crosses below SMA 200');
  const rsi = clauseFromSeed({field: 'rsi14', op: 'rises_above', value: 70});
  assert.equal(describeClause(rsi), 'RSI (14) rises above 70');
  // A value of null is said, and so kept; an absent one leaves the preset.
  assert.equal(clauseFromSeed({field: 'rsi14', value: null}).value, null);
  assert.equal(clauseFromSeed({field: 'rsi14'}).value, 30);
});

test('a seed can name a trendline, which the price crosses with no level of its own', () => {
  const crossing = clauseFromSeed({field: 'close_price', line: LINE});
  assert.deepEqual(crossing.line, LINE);
  assert.equal(crossing.value, null);
  assert.equal(crossing.target, undefined);
  assert.equal(clauseComplete(crossing), true);
  assert.equal(
    describeClause(crossing),
    'price crosses above the trendline from ₹1,200.00 to ₹1,260.00',
  );
  const below = clauseFromSeed({
    field: 'close_price',
    op: 'falls_below',
    line: LINE,
  });
  assert.equal(opVerb(below), 'crosses_below');
  // Compiled as the strategy compiler writes a trendline: a level that moves with the bar's time.
  assert.deepEqual(
    entry(buildAlert('TCS', [below], 'AND', '5m', DEFAULT_CONTRACT))?.condition,
    {
      var: 'close_price',
      op: 'crosses_below',
      val: '1200 + 0.000694444444 * (time_now - 1758000000)',
    },
  );
  // Without one, a seed is as it was.
  assert.equal(clauseFromSeed({field: 'close_price'}).line, undefined);
});

test('operators read as the field’s sentence', () => {
  const words = (c: AlertClause) => opsFor(c).map(o => o.verb);
  assert.deepEqual(words(clause('bullish_engulfing', 'appears', null)), [
    'appears',
  ]);
  assert.deepEqual(words(clause('__day_move', 'is_above', 3)), [
    'is_up_by',
    'is_down_by',
  ]);
  assert.deepEqual(words(clause('close_price', 'rises_above', 1)), [
    'rises_above',
    'falls_below',
    'is_above',
    'is_below',
  ]);
  // Against a line or a trendline, rising above it is crossing it.
  for (const extra of [{target: 'ema50'}, {line: LINE}]) {
    assert.deepEqual(words(clause('close_price', 'rises_above', null, extra)), [
      'crosses_above',
      'crosses_below',
      'is_above',
      'is_below',
    ]);
  }
  assert.equal(
    opsFor(clause('close_price', 'rises_above', 1))[0]?.label,
    'rises above',
  );
  // An operator the field does not offer reads as itself.
  assert.equal(opVerb(clause('__day_move', 'rises_above', 3)), 'rises_above');
});

test('a clause is complete when the engine has everything it needs to watch it', () => {
  assert.equal(
    clauseComplete(clause('close_price', 'rises_above', null)),
    false,
  );
  assert.equal(clauseComplete(clause('close_price', 'rises_above', 0)), false);
  assert.equal(
    clauseComplete(clause('close_price', 'rises_above', 0.05)),
    true,
  );
  assert.equal(clauseComplete(clause('__day_move', 'is_above', 100)), false);
  assert.equal(clauseComplete(clause('__day_move', 'is_above', 0)), false);
  assert.equal(clauseComplete(clause('__day_move', 'is_below', 2)), true);
  // Oscillators and distances may be zero or negative.
  assert.equal(clauseComplete(clause('williams_r_14', 'is_below', -80)), true);
  assert.equal(clauseComplete(clause('rsi14', 'is_below', Number.NaN)), false);
  assert.equal(clauseComplete(clause('doji', 'appears', null)), true);
  assert.equal(
    clauseComplete(
      clause('close_price', 'rises_above', null, {target: 'ema50'}),
    ),
    true,
  );
  // A trendline is the level, so there is no value to wait for.
  assert.equal(
    clauseComplete(clause('close_price', 'rises_above', null, {line: LINE})),
    true,
  );
  // Only a pattern appears.
  assert.equal(clauseComplete(clause('rsi14', 'appears', 30)), false);
});

test('a clause reads as a sentence, and as the parts of one', () => {
  assert.equal(
    describeClause(clause('close_price', 'rises_above', 2500)),
    'price rises above ₹2,500.00',
  );
  assert.equal(
    describeClause(clause('open_price', 'falls_below', 1200)),
    'candle open falls below ₹1,200.00',
  );
  assert.equal(
    describeClause(clause('di_plus_14', 'is_above', 25)),
    '+DI (14) is above 25',
  );
  assert.equal(
    describeClause(clause('__day_move', 'is_below', 2.5)),
    "day's % change is down by 2.5%",
  );
  assert.equal(
    describeClause(clause('market_cap', 'is_above', 125000.5)),
    'market cap is above ₹1,25,000.5 Cr',
  );
  assert.equal(
    describeClause(clause('rvol', 'rises_above', 2)),
    'relative volume rises above 2x',
  );
  assert.equal(
    describeClause(clause('bullish_engulfing', 'appears', null)),
    'a bullish engulfing appears',
  );
  assert.equal(
    describeClause(clause('rsi14', 'falls_below', null)),
    'RSI (14) falls below …',
  );
  assert.equal(
    describeClause(clause('close_price', 'falls_below', null, {line: LINE})),
    'price crosses below the trendline from ₹1,200.00 to ₹1,260.00',
  );
  assert.deepEqual(clauseParts(clause('close_price', 'rises_above', 2500)), {
    kind: 'compare',
    subject: {kind: 'price'},
    verb: 'rises_above',
    level: {kind: 'value', value: 2500, text: '₹2,500.00'},
  });
  assert.deepEqual(
    clauseParts(clause('close_price', 'rises_above', null, {target: 'ema50'})),
    {
      kind: 'compare',
      subject: {kind: 'price'},
      verb: 'crosses_above',
      level: {kind: 'target', label: 'EMA 50'},
    },
  );
  assert.deepEqual(clauseParts(clause('hammer', 'appears', null)), {
    kind: 'pattern',
    label: 'hammer',
  });
  assert.deepEqual(clauseParts(clause('gap_pct', 'is_above', null)), {
    kind: 'compare',
    subject: {kind: 'field', label: 'gap at open'},
    verb: 'is_above',
    level: {kind: 'pending'},
  });
});

test('values read in their field’s unit', () => {
  assert.equal(
    formatAlertValue(alertField('close_price'), 1305.6),
    '₹1,305.60',
  );
  assert.equal(formatAlertValue(alertField('iv'), 18.123456), '18.1235%');
  assert.equal(formatAlertValue(alertField('pe_ttm'), 20), '20x');
  assert.equal(formatAlertValue(alertField('delta'), 0.5), '0.5');
  assert.equal(
    formatAlertValue(alertField('market_cap'), 1_234_567),
    '₹12,34,567 Cr',
  );
});

test('a price level already crossed says which side the price is on', () => {
  const above = clause('close_price', 'rises_above', 1250);
  assert.equal(priceWarning(above, 1280), 'above');
  assert.equal(priceWarning(above, 1200), null);
  assert.equal(
    priceWarning(clause('close_price', 'is_below', 1300), 1280),
    'below',
  );
  assert.equal(priceWarning(above, null), null);
  assert.equal(
    priceWarning(
      clause('close_price', 'rises_above', 1250, {target: 'ema50'}),
      1280,
    ),
    null,
  );
  assert.equal(priceWarning(clause('rsi14', 'rises_above', 30), 50), null);
});

test('level chips land on the NSE tick, and a typed level points the way it lies', () => {
  assert.equal(levelAtPct(1280, 2), 1305.6);
  assert.equal(levelAtPct(1280, -5), 1216);
  assert.equal(levelAtPct(101.23, -5), 96.15);
  assert.equal(levelAtPct(3.33, 2), 3.4);
  assert.equal(levelDirection(1300, 1280), 'rises_above');
  assert.equal(levelDirection(1280, 1280), 'rises_above');
  assert.equal(levelDirection(1200, 1280), 'falls_below');
  assert.equal(parseAlertValue('2,500'), 2500);
  assert.equal(parseAlertValue(' 12.5 '), 12.5);
  assert.equal(parseAlertValue(''), null);
  assert.equal(parseAlertValue('  '), null);
  assert.equal(parseAlertValue('12a'), null);
});

test('the coarsest timeframe that still looks once per chart candle', () => {
  assert.equal(timeframeForCandle(1), '1m');
  assert.equal(timeframeForCandle(3), '1m');
  assert.equal(timeframeForCandle(5), '5m');
  assert.equal(timeframeForCandle(60), '15m');
  assert.equal(timeframeForCandle(1440), '1d');
  assert.equal(timeframeForCandle(0.5), '1m');
});

test('a trendline extends past both anchors', () => {
  assert.equal(lineAt(LINE, LINE.fromEpoch), 1200);
  assert.equal(lineAt(LINE, LINE.toEpoch), 1260);
  assert.equal(lineAt(LINE, LINE.toEpoch + 86_400), 1320);
  assert.equal(lineAt(LINE, LINE.fromEpoch - 43_200), 1170);
});

test('nothing is built until the symbol and every clause are there', () => {
  const ready = clause('close_price', 'rises_above', 2500);
  assert.equal(buildAlert('', [ready], 'AND', '1m', DEFAULT_CONTRACT), null);
  assert.equal(buildAlert('RELIANCE', [], 'AND', '1m', DEFAULT_CONTRACT), null);
  assert.equal(
    buildAlert(
      'RELIANCE',
      [ready, clause('close_price', 'rises_above', null)],
      'AND',
      '1m',
      DEFAULT_CONTRACT,
    ),
    null,
  );
});

test('one price clause compiles to one crossing leaf in the monitor machine', () => {
  const alert = buildAlert(
    'RELIANCE',
    [clause('close_price', 'rises_above', 2500)],
    'AND',
    '5m',
    DEFAULT_CONTRACT,
  );
  assert.deepEqual(
    {
      name: alert?.name,
      summary: alert?.summary,
      sentence: alert?.sentence,
      rule: alert?.rule,
      timeframe: alert?.timeframe,
      isFno: alert?.isFno,
    },
    {
      name: 'RELIANCE Price rises above ₹2,500.00',
      summary: 'RELIANCE: price rises above ₹2,500.00',
      sentence: 'price rises above ₹2,500.00',
      rule: 'RELIANCE: price rises above ₹2,500.00',
      timeframe: '5m',
      isFno: false,
    },
  );
  assert.equal(alert?.fsm.intent, 'monitor');
  assert.deepEqual(entry(alert)?.condition, {
    var: 'close_price',
    op: 'crosses_above',
    val: 2500,
  });
  assert.deepEqual(entry(alert)?.actions[0], {
    type: 'ORDER',
    payload: {side: 'BUY'},
  });
});

test('several clauses compile under their logic, and the name counts the rest', () => {
  const clauses = [
    clause('rsi14', 'falls_below', 30),
    clause('close_price', 'rises_above', null, {target: 'ema50'}),
    clause('bullish_engulfing', 'appears', null),
    clause('__day_move', 'is_below', 2),
    clause('__day_move', 'is_above', 2.5),
  ];
  const alert = buildAlert('TCS', clauses, 'OR', '15m', DEFAULT_CONTRACT);
  assert.equal(alert?.name, 'TCS RSI (14) falls below 30 +4 more');
  assert.equal(
    alert?.sentence,
    "RSI (14) falls below 30 or price crosses above EMA 50 or a bullish engulfing appears or day's % change is down by 2% or day's % change is up by 2.5%",
  );
  // The day's move is a daily number, so the whole alert looks on the close.
  assert.equal(alert?.timeframe, '1d');
  assert.deepEqual(entry(alert)?.condition, {
    logic: 'OR',
    conditions: [
      {var: 'rsi14', op: 'crosses_below', val: 30},
      {var: 'close_price', op: 'crosses_above', val: 'ema50'},
      {var: 'bullish_engulfing', op: '==', val: true},
      {var: 'close_price', op: '<=', val: 'prev_close_price * 0.98'},
      {var: 'close_price', op: '>=', val: 'prev_close_price * 1.025'},
    ],
  });
});

test('a trendline compiles to the strategy compiler’s own time_now expression', () => {
  const alert = buildAlert(
    'RELIANCE',
    [clause('close_price', 'rises_above', null, {line: LINE})],
    'AND',
    '1m',
    DEFAULT_CONTRACT,
  );
  assert.deepEqual(entry(alert)?.condition, {
    var: 'close_price',
    op: 'crosses_above',
    val: '1200 + 0.000694444444 * (time_now - 1758000000)',
  });
  assert.equal(
    alert?.summary,
    'RELIANCE: price crosses above the trendline from ₹1,200.00 to ₹1,260.00',
  );
});

test('an option read names its contract, in the F&O dialect, as an F&O alert', () => {
  const clauses = [
    clause('iv', 'rises_above', 20),
    clause('high_price', 'is_above', 24_600),
  ];
  assert.equal(usesContract(clauses), true);
  assert.equal(usesFno(clauses), true);
  const alert = buildAlert('NIFTY', clauses, 'AND', '1m', {
    moneyness: 'OTM',
    type: 'PE',
    expiry: 'next_week',
  });
  assert.equal(
    alert?.sentence,
    'implied volatility (IV) rises above 20% and candle high is above ₹24,600.00 (OTM put, next week)',
  );
  assert.equal(alert?.isFno, true);
  assert.deepEqual(entry(alert)?.condition, {
    logic: 'AND',
    conditions: [
      {var: 'iv', op: 'crosses_above', val: 20},
      // The F&O dialect names the candle's high bare.
      {var: 'high', op: '>', val: 24_600},
    ],
  });
  assert.deepEqual(entry(alert)?.actions[0], {
    type: 'ORDER',
    payload: {side: 'BUY', target: 'OTM_PE_NEXT_WEEK'},
  });
  // A chain-wide read is F&O but needs no contract.
  assert.equal(
    usesContract([clause('max_call_oi_strike', 'is_above', 25_000)]),
    false,
  );
});

test('a contract symbol is an F&O alert even on its own price', () => {
  const alert = buildAlert(
    'NIFTY26SEP24500CE',
    [clause('close_price', 'falls_below', 80)],
    'AND',
    '1m',
    DEFAULT_CONTRACT,
  );
  assert.equal(alert?.isFno, true);
  assert.deepEqual(entry(alert)?.condition, {
    var: 'close_price',
    op: 'crosses_below',
    val: 80,
  });
  assert.equal(entry(alert)?.actions[0]?.payload.target, undefined);
});

test('a compiled condition is an F&O read by its symbol or by any field it names', () => {
  // A cash symbol on a cash field is looked for among cash symbols.
  assert.equal(isFnoAlert('RELIANCE', {var: 'rsi14', op: '<', val: 30}), false);
  assert.equal(
    isFnoAlert('NIFTY26SEP24500CE', {var: 'rsi14', op: '<', val: 30}),
    true,
  );
  // An F&O field counts wherever it sits, under either logic.
  assert.equal(
    isFnoAlert('NIFTY', {
      logic: 'OR',
      conditions: [
        {var: 'rsi14', op: '<', val: 30},
        {
          logic: 'AND',
          conditions: [
            {var: 'close_price', op: 'crosses_above', val: 'ema50'},
            {var: 'iv', op: '>', val: 20},
          ],
        },
      ],
    }),
    true,
  );
  // The F&O dialect's bare candle names are still the candle, not an F&O field.
  assert.equal(isFnoAlert('NIFTY', {var: 'high', op: '>', val: 24_600}), false);
  // A card without a condition has nothing to read.
  assert.equal(isFnoAlert('RELIANCE', undefined), false);
  assert.equal(isFnoAlert('RELIANCE', null), false);
});

test('daily-only clauses and what a list of stocks can share', () => {
  assert.equal(dailyOnly([clause('pe_ttm', 'is_below', 20)]), true);
  assert.equal(dailyOnly([clause('rsi14', 'is_below', 20)]), false);
  assert.equal(appliesToEveryStock(alertField('close_price')), false);
  assert.equal(appliesToEveryStock(alertField('iv')), false);
  assert.equal(appliesToEveryStock(alertField('ema50')), true);
  assert.equal(appliesToEveryStock(alertField('__day_move')), true);
});

test('a created alert is saved live, following its own symbol', () => {
  const alert = buildAlert(
    'TCS',
    [clause('close_price', 'falls_below', 3200)],
    'AND',
    '1m',
    DEFAULT_CONTRACT,
  );
  assert.ok(alert);
  assert.deepEqual(
    savedAlertFrom(alert, 'strat-1', new Date('2026-09-28T04:00:00Z')),
    {
      id: 'strat-1',
      prompt: 'TCS: price falls below ₹3,200.00',
      name: 'TCS Price falls below ₹3,200.00',
      status: 'active',
      notify: true,
      created_at: '2026-09-28T04:00:00.000Z',
      summary: 'TCS: price falls below ₹3,200.00',
      matches: [{symbol: 'TCS'}],
      symbol: 'TCS',
      timeframe: '1m',
      original_query: 'TCS: price falls below ₹3,200.00',
    },
  );
});
