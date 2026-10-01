import {
  type AlertExpiry,
  type AlertField,
  alertField,
  EXPIRY_CHOICES,
  findAlertField,
} from '../data/alertFields.ts';
import {formatCurrency} from '../format/number.ts';
import type {SavedAlert} from '../types/savedAlert.ts';
import {isExchangeSymbol} from './optionContract.ts';

/** One test the engine evaluates on a bar: a column, an operator, and a number, expression or column to compare with. */
export type AlertLeaf = {
  var: string;
  op: string;
  val: number | string | boolean;
};

export type AlertCondition =
  AlertLeaf | {logic: 'AND' | 'OR'; conditions: AlertCondition[]};

export type MonitorAction = {
  type: 'ORDER' | 'UPDATE_CONTEXT';
  payload: Record<string, string>;
};

export type MonitorTransition = {
  comment: string;
  condition: AlertCondition;
  next_state: string;
  actions: MonitorAction[];
};

export type MonitorState = {
  on_entry: MonitorAction[];
  on_exit: MonitorAction[];
  on_tick: MonitorAction[];
  transitions: MonitorTransition[];
};

export type MonitorFsm = {
  initial_state: 'IDLE';
  intent: 'monitor';
  variables: string[];
  nlp_triggers: never[];
  states: Record<'IDLE' | 'BOUGHT', MonitorState>;
};

/**
 * The same two-state machine the strategy compiler emits for a simple entry
 * (`_build_simple` in llm/graph/nodes/strategy/alpha/compiler.py), with
 * `intent: "monitor"`. The state is named BOUGHT because that is what the
 * alerts query reads as "matched" (repository/trading/queries.go); in
 * WATCHLIST mode the ORDER action notifies rather than trades, and its
 * `target` names the option contract an F&O alert reads, in the compiler's
 * own spelling (`_compile_target` in fno_compiler.py). No way out of BOUGHT,
 * so an alert fires once — the default every broker uses.
 *
 * Shared between the New alert form and the chat card's condition, so an alert
 * made either way runs the same shape.
 */
export const monitorFsm = (
  condition: AlertCondition,
  target?: string,
): MonitorFsm => {
  const order: Record<string, string> = {side: 'BUY'};
  if (target !== undefined) order.target = target;
  return {
    initial_state: 'IDLE',
    intent: 'monitor',
    variables: ['$entry_price'],
    nlp_triggers: [],
    states: {
      IDLE: {
        on_entry: [],
        on_exit: [],
        on_tick: [],
        transitions: [
          {
            comment: 'Entry',
            condition,
            next_state: 'BOUGHT',
            actions: [
              {type: 'ORDER', payload: order},
              {
                type: 'UPDATE_CONTEXT',
                payload: {key: '$entry_price', value: 'close_price'},
              },
            ],
          },
        ],
      },
      BOUGHT: {on_entry: [], on_exit: [], on_tick: [], transitions: []},
    },
  };
};

export type AlertOp =
  'rises_above' | 'falls_below' | 'is_above' | 'is_below' | 'appears';

/** How an alert's clauses combine: all of them true, or any one. */
export type AlertLogic = 'AND' | 'OR';

/** A straight line drawn on the chart, by its two anchors (epoch seconds). */
export type TrendLine = {
  fromEpoch: number;
  fromPrice: number;
  toEpoch: number;
  toPrice: number;
};

/**
 * One line of an alert: a field, what it does, and what to. `target` is set
 * when the level is another line on the chart ("Price crosses above EMA 50")
 * rather than a number; `line` when it is a trendline, whose level moves with
 * every bar.
 */
export type AlertClause = {
  key: string;
  field: string;
  op: AlertOp;
  value: number | null;
  target?: string;
  line?: TrendLine;
};

const slopeOf = (l: TrendLine): number =>
  (l.toPrice - l.fromPrice) / (l.toEpoch - l.fromEpoch);

/** The trendline's price at a moment, extended past its anchors. */
export const lineAt = (l: TrendLine, epochSec: number): number =>
  l.fromPrice + slopeOf(l) * (epochSec - l.fromEpoch);

/** The same expression the strategy compiler writes for a trendline
 *  (`expression` in llm/graph/nodes/strategy/submit_plan.py): the engine
 *  evaluates a `val` as arithmetic over `time_now`, the bar's epoch. */
const lineExpression = (l: TrendLine): string =>
  `${l.fromPrice} + ${slopeOf(l).toFixed(12)} * (time_now - ${l.fromEpoch})`;

/** The option contract an F&O alert reads, by where it sits in the chain. */
export type AlertContract = {
  moneyness: 'ATM' | 'ITM' | 'OTM';
  type: 'CE' | 'PE';
  expiry: AlertExpiry;
};

export const DEFAULT_CONTRACT: AlertContract = {
  moneyness: 'ATM',
  type: 'CE',
  expiry: 'current',
};

export const MAX_CLAUSES = 5;
/** One alert is one running watch server-side, so a screen alerts on its top rows only. */
export const MAX_BULK_ALERTS = 50;

export type AlertTimeframe = '1m' | '5m' | '15m' | '1d';

export type TimeframeChoice = {
  value: AlertTimeframe;
  minutes: number;
  label: string;
  hint: string;
};

export const TIMEFRAME_CHOICES: readonly TimeframeChoice[] = [
  {
    value: '1m',
    minutes: 1,
    label: '1 min',
    hint: "Looks every minute — for a level you want the moment it's hit.",
  },
  {
    value: '5m',
    minutes: 5,
    label: '5 min',
    hint: 'Looks on each 5-minute candle close.',
  },
  {
    value: '15m',
    minutes: 15,
    label: '15 min',
    hint: 'Looks on each 15-minute candle close — fewer false alarms intraday.',
  },
  {
    value: '1d',
    minutes: 1440,
    label: 'Daily',
    hint: 'Looks once a day, on the daily close.',
  },
];

/** The coarsest alert timeframe that still looks at least once per chart candle. */
export const timeframeForCandle = (minutes: number): AlertTimeframe =>
  [...TIMEFRAME_CHOICES].reverse().find(tf => tf.minutes <= minutes)?.value ??
  '1m';

let keySeq = 0;
const nextKey = (): string => `c${++keySeq}`;

/**
 * The sentence a field starts as when it's picked, so nobody is asked for an
 * operator before they have seen the idea. A line (an average, a band, a
 * pivot) is something price crosses, so picking EMA 50 means "Price crosses
 * above EMA 50" — not "EMA 50 is above ₹___", which nobody sets.
 */
export const clauseFor = (fieldId: string): AlertClause => {
  const f = alertField(fieldId);
  const key = nextKey();
  switch (f.kind) {
    case 'line':
      return {
        key,
        field: 'close_price',
        op: 'rises_above',
        value: null,
        target: f.id,
      };
    case 'pattern':
      return {key, field: f.id, op: 'appears', value: null};
    case 'daymove':
      return {key, field: f.id, op: 'is_above', value: f.presets?.[1] ?? 3};
    case 'bounded': {
      // Two presets are a band (30/70) and the low end is the usual ask; one
      // is a threshold (ADX 25) people wait to be crossed upward.
      const op: AlertOp =
        (f.presets?.length ?? 0) >= 2 ? 'falls_below' : 'rises_above';
      return {key, field: f.id, op, value: f.presets?.[0] ?? null};
    }
    default:
      return {
        key,
        field: f.id,
        op: f.daily === true ? 'is_above' : 'rises_above',
        value: f.presets?.[0] ?? null,
      };
  }
};

/** A condition to open the form with, as the assistant read it from a message. */
export type AlertClauseSeed = {
  field: string;
  op?: AlertOp | undefined;
  value?: number | null | undefined;
  /** A line the price crosses, which then names the clause's field itself. */
  target?: string | undefined;
  /** A trendline the price crosses, by the two anchors drawn on the chart. */
  line?: TrendLine | undefined;
};

export const clauseFromSeed = (seed: AlertClauseSeed): AlertClause => {
  // A line is the thing crossed: clauseFor builds "Price crosses above EMA 50"
  // from the line's own id.
  const clause = clauseFor(seed.target ?? seed.field);
  if (seed.op !== undefined) clause.op = seed.op;
  if (seed.value !== undefined) clause.value = seed.value;
  if (seed.line !== undefined) clause.line = seed.line;
  return clause;
};

/**
 * The words an operator reads as. The same operator reads differently by
 * field: against a line, rising above it is crossing it; the day's move is up
 * or down by a percentage.
 */
export type AlertVerb =
  | 'rises_above'
  | 'falls_below'
  | 'crosses_above'
  | 'crosses_below'
  | 'is_above'
  | 'is_below'
  | 'is_up_by'
  | 'is_down_by'
  | 'appears';

export type AlertOpOption = {value: AlertOp; verb: AlertVerb; label: string};

const VERB_LABEL: Record<AlertVerb, string> = {
  rises_above: 'rises above',
  falls_below: 'falls below',
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
  is_above: 'is above',
  is_below: 'is below',
  is_up_by: 'is up by',
  is_down_by: 'is down by',
  appears: 'appears',
};

const opOption = (value: AlertOp, verb: AlertVerb): AlertOpOption => ({
  value,
  verb,
  label: VERB_LABEL[verb],
});

/** What the operator reads as for this field — the sentence, not the symbol. */
export const opsFor = (clause: AlertClause): AlertOpOption[] => {
  const f = alertField(clause.field);
  if (f.kind === 'pattern') return [opOption('appears', 'appears')];
  if (f.kind === 'daymove') {
    return [
      opOption('is_above', 'is_up_by'),
      opOption('is_below', 'is_down_by'),
    ];
  }
  const crosses = Boolean(clause.target) || clause.line !== undefined;
  return [
    opOption('rises_above', crosses ? 'crosses_above' : 'rises_above'),
    opOption('falls_below', crosses ? 'crosses_below' : 'falls_below'),
    opOption('is_above', 'is_above'),
    opOption('is_below', 'is_below'),
  ];
};

/** The verb the clause reads with; an operator its field does not offer reads as itself. */
export const opVerb = (clause: AlertClause): AlertVerb =>
  opsFor(clause).find(o => o.value === clause.op)?.verb ?? clause.op;

export const opLabel = (clause: AlertClause): string =>
  opsFor(clause).find(o => o.value === clause.op)?.label ?? clause.op;

export const usesContract = (clauses: readonly AlertClause[]): boolean =>
  clauses.some(c => alertField(c.field).contract === true);

export const usesFno = (clauses: readonly AlertClause[]): boolean =>
  clauses.some(c => alertField(c.field).tab === 'fno');

/** Fundamentals and the day's move are daily numbers; checking them every
 *  minute only re-reads the same value. */
export const dailyOnly = (clauses: readonly AlertClause[]): boolean =>
  clauses.some(c => alertField(c.field).daily === true);

/** A list of stocks has no one price or option chain, so only relative conditions apply to all of them. */
export const appliesToEveryStock = (f: AlertField): boolean =>
  f.kind !== 'price' && f.tab !== 'fno';

export const clauseComplete = (c: AlertClause): boolean => {
  const f = alertField(c.field);
  if (f.kind === 'pattern') return true;
  // Only a pattern appears; a level has nothing to appear, and the engine no
  // operator to watch it with.
  if (c.op === 'appears') return false;
  if (Boolean(c.target) || c.line !== undefined) return true;
  if (c.value === null || !Number.isFinite(c.value)) return false;
  if (f.kind === 'daymove') return c.value > 0 && c.value < 100;
  if (f.kind === 'price') return c.value > 0;
  return true;
};

// The default grouping toLocaleString('en-IN') gives, held once: building a
// formatter per call is what core/format avoids.
const CRORE = new Intl.NumberFormat('en-IN', {maximumFractionDigits: 3});

/** A level as its field reads: "₹2,500.00", "₹1,20,000 Cr", "30", "5%", "2x". */
export const formatAlertValue = (f: AlertField, value: number): string => {
  if (f.unit === '₹') return formatCurrency(value);
  if (f.unit === '₹ Cr') return `₹${CRORE.format(value)} Cr`;
  const n = String(Number(value.toFixed(4)));
  return f.unit === '%' ? `${n}%` : f.unit === 'x' ? `${n}x` : n;
};

/** Who a compare clause is about: the price itself, or a field by its mid-sentence label. */
export type ClauseSubject = {kind: 'price'} | {kind: 'field'; label: string};

/** What a compare clause measures against. */
export type ClauseLevel =
  | {kind: 'value'; value: number; text: string}
  | {kind: 'target'; label: string}
  | {kind: 'line'; fromPrice: number; toPrice: number}
  | {kind: 'pending'};

/** A clause as the parts of its sentence, for an app that words it itself. */
export type ClauseParts =
  | {kind: 'pattern'; label: string}
  | {
      kind: 'compare';
      subject: ClauseSubject;
      verb: AlertVerb;
      level: ClauseLevel;
    };

export const clauseParts = (c: AlertClause): ClauseParts => {
  const f = alertField(c.field);
  if (f.kind === 'pattern')
    return {kind: 'pattern', label: f.label.toLowerCase()};
  const level: ClauseLevel =
    c.line !== undefined
      ? {kind: 'line', fromPrice: c.line.fromPrice, toPrice: c.line.toPrice}
      : c.target
        ? {kind: 'target', label: alertField(c.target).label}
        : c.value !== null
          ? {kind: 'value', value: c.value, text: formatAlertValue(f, c.value)}
          : {kind: 'pending'};
  // Mid-sentence, "Candle open" reads as "candle open"; "RSI (14)" keeps its capitals.
  const subject: ClauseSubject =
    f.id === 'close_price'
      ? {kind: 'price'}
      : {
          kind: 'field',
          label: /^[A-Z+-]{2}/.test(f.label)
            ? f.label
            : f.label.charAt(0).toLowerCase() + f.label.slice(1),
        };
  return {kind: 'compare', subject, verb: opVerb(c), level};
};

const levelText = (level: ClauseLevel): string => {
  switch (level.kind) {
    case 'value':
      return level.text;
    case 'target':
      return level.label;
    case 'line':
      return `the trendline from ${formatCurrency(level.fromPrice)} to ${formatCurrency(level.toPrice)}`;
    case 'pending':
      return '…';
  }
};

/** The clause in English: "price rises above ₹2,500.00". */
export const describeClause = (c: AlertClause): string => {
  const parts = clauseParts(c);
  if (parts.kind === 'pattern') return `a ${parts.label} appears`;
  const subject =
    parts.subject.kind === 'price' ? 'price' : parts.subject.label;
  return `${subject} ${opLabel(c)} ${levelText(parts.level)}`;
};

const contractText = (c: AlertContract): string =>
  `${c.moneyness} ${c.type === 'CE' ? 'call' : 'put'}, ${
    EXPIRY_CHOICES.find(e => e.value === c.expiry)?.label.toLowerCase() ??
    c.expiry
  }`;

/**
 * A price alert that is already true fires on its first check. Worth saying
 * before Create, not after the notification: the side of the level the price
 * already stands on, or null when there is nothing to say.
 */
export const priceWarning = (
  c: AlertClause,
  ltp: number | null,
): 'above' | 'below' | null => {
  if (
    c.field !== 'close_price' ||
    Boolean(c.target) ||
    ltp === null ||
    c.value === null ||
    c.value <= 0
  )
    return null;
  if ((c.op === 'is_above' || c.op === 'rises_above') && ltp > c.value)
    return 'above';
  if ((c.op === 'is_below' || c.op === 'falls_below') && ltp < c.value)
    return 'below';
  return null;
};

/** A price clause's one-tap levels, in % from the live price. */
export const LEVEL_CHIPS: readonly number[] = [-5, -2, 2, 5];

// NSE prices move in five-paise ticks.
const TICK = 0.05;

/** The level `pct` away from the live price, rounded to the NSE tick, so the level is one a trade can actually print at. */
export const levelAtPct = (ltp: number, pct: number): number =>
  Number((Math.round((ltp * (1 + pct / 100)) / TICK) * TICK).toFixed(2));

/** The direction a typed price level points from the live price. */
export const levelDirection = (value: number, ltp: number): AlertOp =>
  value >= ltp ? 'rises_above' : 'falls_below';

/** A typed level: "2,500" reads as 2500, and blank or not a number as none. */
export const parseAlertValue = (raw: string): number | null => {
  const n = Number(raw.replace(/,/g, '').trim());
  return raw.trim() !== '' && Number.isFinite(n) ? n : null;
};

// The F&O dialect names the candle's open/high/low bare (conditions.py, FNO).
const FNO_COLUMNS: Record<string, string> = {
  open_price: 'open',
  high_price: 'high',
  low_price: 'low',
};

const OP_CODE: Record<AlertOp, string> = {
  rises_above: 'crosses_above',
  falls_below: 'crosses_below',
  is_above: '>',
  is_below: '<',
  // Never compiled from here: a pattern is its own leaf, and any other
  // "appears" is an incomplete clause.
  appears: '==',
};

const round6 = (n: number): number => Number(n.toFixed(6));

const leafOf = (c: AlertClause, fno: boolean): AlertLeaf => {
  const col = (id: string): string => (fno ? (FNO_COLUMNS[id] ?? id) : id);
  const f = alertField(c.field);
  // Patterns compile the way the strategy compiler writes them (PatternCondition).
  if (f.kind === 'pattern') return {var: f.id, op: '==', val: true};
  if (f.kind === 'daymove') {
    const pct = c.value ?? 0;
    return c.op === 'is_below'
      ? {
          var: 'close_price',
          op: '<=',
          val: `prev_close_price * ${round6(1 - pct / 100)}`,
        }
      : {
          var: 'close_price',
          op: '>=',
          val: `prev_close_price * ${round6(1 + pct / 100)}`,
        };
  }
  return {
    var: col(f.id),
    op: OP_CODE[c.op],
    val:
      c.line !== undefined
        ? lineExpression(c.line)
        : c.target
          ? col(c.target)
          : (c.value ?? 0),
  };
};

/** The alert as the engine runs it — see `monitorFsm` for the machine. */
const compileFsm = (
  clauses: readonly AlertClause[],
  logic: AlertLogic,
  fno: boolean,
  contract: AlertContract | null,
): MonitorFsm => {
  const leaves = clauses.map(c => leafOf(c, fno));
  const [only] = leaves;
  const condition: AlertCondition =
    leaves.length === 1 && only !== undefined
      ? only
      : {logic, conditions: leaves};
  return monitorFsm(
    condition,
    contract === null
      ? undefined
      : `${contract.moneyness}_${contract.type}_${contract.expiry.toUpperCase()}`,
  );
};

// A condition written in the F&O dialect, read back as the picker's field ids.
const COLUMN_BACK: Record<string, string> = Object.fromEntries(
  Object.entries(FNO_COLUMNS).map(([id, col]) => [col, id]),
);

/**
 * Whether an alert on `symbol` with this condition is an F&O read — a
 * contract, or a field such as premium, OI or IV — so the engine looks among
 * contracts, not cash symbols.
 */
export const isFnoAlert = (symbol: string, condition: unknown): boolean => {
  const readsFno = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    const n = node as {conditions?: unknown; var?: unknown};
    if (Array.isArray(n.conditions)) return n.conditions.some(readsFno);
    const column = String(n.var);
    return findAlertField(COLUMN_BACK[column] ?? column)?.tab === 'fno';
  };
  return isExchangeSymbol(symbol) || readsFno(condition);
};

export type BuiltAlert = {
  symbol: string;
  timeframe: string;
  /** The saved alert's title: "RELIANCE Price rises above ₹2,500.00 +1 more". */
  name: string;
  /** "RELIANCE: price rises above ₹2,500.00". */
  summary: string;
  /** The conditions alone, which a bulk alert shares across its stocks. */
  sentence: string;
  /** What create-backtest records as the alert's query. */
  rule: string;
  fsm: MonitorFsm;
  isFno: boolean;
};

const capitalise = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Everything create-backtest needs for one alert, or null until every clause
 * is complete. The English strings are what the saved alert is stored and
 * listed as, on either app.
 */
export const buildAlert = (
  symbol: string,
  clauses: readonly AlertClause[],
  logic: AlertLogic,
  timeframe: string,
  contract: AlertContract,
): BuiltAlert | null => {
  const [first] = clauses;
  if (symbol === '' || first === undefined || !clauses.every(clauseComplete))
    return null;
  const fno = usesFno(clauses);
  const needsContract = usesContract(clauses);
  const joined = clauses
    .map(describeClause)
    .join(logic === 'AND' ? ' and ' : ' or ');
  const sentence = needsContract
    ? `${joined} (${contractText(contract)})`
    : joined;
  const head = capitalise(describeClause(first));
  return {
    symbol,
    timeframe: dailyOnly(clauses) ? '1d' : timeframe,
    name: `${symbol} ${clauses.length === 1 ? head : `${head} +${clauses.length - 1} more`}`,
    summary: `${symbol}: ${sentence}`,
    sentence,
    rule: `${symbol}: ${sentence}`,
    fsm: compileFsm(clauses, logic, fno, needsContract ? contract : null),
    // A contract's own price is still an F&O read: sent as equity, the engine
    // would look for the ticker among cash symbols and never find it.
    isFno: fno || isExchangeSymbol(symbol),
  };
};

/**
 * The saved alert for one the engine now runs as strategy `id`: live at once,
 * following its own symbol, with no draft step — everything it watches was on
 * screen when Create was pressed.
 */
export const savedAlertFrom = (
  alert: BuiltAlert,
  id: string,
  now: Date = new Date(),
): SavedAlert => ({
  id,
  prompt: alert.rule,
  name: alert.name,
  status: 'active',
  notify: true,
  created_at: now.toISOString(),
  summary: alert.summary,
  matches: [{symbol: alert.symbol}],
  symbol: alert.symbol,
  timeframe: alert.timeframe,
  original_query: alert.rule,
});
