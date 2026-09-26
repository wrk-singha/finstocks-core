/**
 * A strategy's FSM read as rule steps - entry thresholds, exits, news triggers - and the writers
 * that change one value in it, plus the parts a rule's one-line description and its size are
 * worded from.
 *
 * Parts, not sentences: each app words them in its own strings. A leaf's `indicator` and `value`
 * are catalogue names like the rule picker's labels, and its `operator` is the projection's English
 * beside the raw `op`, which an app that translates words instead.
 */
import type {
  ParsedEntryRule,
  ParsedExitRule,
  ParsedRuleFsm,
  RuleLeaf,
  RuleTokenKey,
  StrategyRuleValues,
} from '../types/strategyRun.ts';
import type {NLPTrigger} from '../types/trade.ts';
import {humanizeValue, humanizeVar, OPERATOR_TEXT} from './fsmProjection.ts';

interface RawCondition {
  var?: string;
  op?: string;
  val?: unknown;
  conditions?: RawCondition[];
  logic?: 'AND' | 'OR';
}

interface RawTransition {
  condition?: RawCondition;
  next_state?: string;
  comment?: string;
}

interface RawFsm {
  initial_state?: string;
  states?: Record<string, {transitions?: RawTransition[]}>;
  nlp_triggers?: NLPTrigger[];
}

// The compiler's own wording (llm/graph/nodes/strategy/alpha/compiler.py): a take profit is
// `high_price >= $entry_price * 1.01` commented "Take profit at 1.0%", mirrored with low_price/<=
// for shorts. Only this exact shape is rewritten; anything else is shown and left alone.
const TAKE_PROFIT_COMMENT = /^Take profit at ([\d.]+)%/;
const STOP_LOSS_COMMENT = /^Stop loss at ([\d.]+)%/;
const PREMIUM_TP_COMMENT = /^Premium TP.*?([\d.]+)%/;
const PREMIUM_SL_COMMENT = /^Premium SL.*?([\d.]+)%/;
const ENTRY_PRICE_MULTIPLE = /^\$entry_price\s*\*\s*([\d.]+)$/;

const EXIT_COMMENTS: readonly [RegExp, 'take_profit' | 'stop_loss'][] = [
  [TAKE_PROFIT_COMMENT, 'take_profit'],
  [PREMIUM_TP_COMMENT, 'take_profit'],
  [STOP_LOSS_COMMENT, 'stop_loss'],
  [PREMIUM_SL_COMMENT, 'stop_loss'],
];

const PRICE_VARS = new Set([
  'close',
  'ltp',
  'price',
  'close_price',
  'high_price',
  'low_price',
  'open_price',
]);
const PRICE_LABEL = 'Price';
const IDENTIFIER = /^[a-z0-9_]+$/i;
const NAME_AND_PERIOD = /^([a-z]+)_?(\d+)$/;

/** `rsi14` -> `RSI (14)`, `ema_50` -> `EMA (50)`, `close` -> `Price`. */
function indicatorLabel(name: string): string {
  const lower = name.toLowerCase();
  if (PRICE_VARS.has(lower)) return PRICE_LABEL;
  const [, base, period] = NAME_AND_PERIOD.exec(lower) ?? [];
  if (base !== undefined && period !== undefined) {
    return `${base.toUpperCase()} (${period})`;
  }
  return humanizeVar(name);
}

const toNumber = (val: unknown): number | null => {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (
    typeof val === 'string' &&
    val.trim() !== '' &&
    Number.isFinite(Number(val))
  ) {
    return Number(val);
  }
  return null;
};

function collectLeaves(
  condition: RawCondition | undefined,
  path: number[] = [],
): RuleLeaf[] {
  if (!condition) return [];
  if (condition.conditions?.length) {
    return condition.conditions.flatMap((c, i) =>
      collectLeaves(c, [...path, i]),
    );
  }
  if (condition.var === undefined) return [];
  const numeric = toNumber(condition.val);
  const rawOperator = condition.op ?? '';
  return [
    {
      indicator: indicatorLabel(condition.var),
      operator: OPERATOR_TEXT[rawOperator] ?? rawOperator,
      value:
        numeric !== null
          ? String(numeric)
          : typeof condition.val === 'string' && IDENTIFIER.test(condition.val)
            ? indicatorLabel(condition.val)
            : humanizeValue(condition.val),
      numeric,
      rawIndicator: condition.var,
      rawOperator,
      path,
    },
  ];
}

function exitKind(
  comment: string | undefined,
): Pick<ParsedExitRule, 'kind' | 'pct'> {
  if (!comment) return {kind: 'signal'};
  for (const [pattern, kind] of EXIT_COMMENTS) {
    const match = pattern.exec(comment);
    if (match) return {kind, pct: Number(match[1])};
  }
  return {kind: 'signal'};
}

const asRaw = (fsm: unknown): RawFsm | null => {
  const raw = fsm as RawFsm | null | undefined;
  return raw?.states && raw.initial_state ? raw : null;
};

/** The FSM as steps: entry thresholds, exits, news triggers. Null when unreadable. */
export function parseRuleFsm(fsm: unknown): ParsedRuleFsm | null {
  const raw = asRaw(fsm);
  if (!raw) return null;

  const entries: ParsedEntryRule[] = [];
  const exits: ParsedExitRule[] = [];
  const indicators: string[] = [];

  const noteIndicators = (leaves: RuleLeaf[]) => {
    for (const leaf of leaves) {
      if (
        leaf.indicator !== PRICE_LABEL &&
        !indicators.includes(leaf.indicator)
      ) {
        indicators.push(leaf.indicator);
      }
    }
  };

  for (const [stateName, state] of Object.entries(raw.states ?? {})) {
    (state.transitions ?? []).forEach((transition, transitionIndex) => {
      // Self-loops are compiler bookkeeping (e.g. a daily trade-count reset), not user rules.
      if (transition.next_state === stateName) return;
      const condition = transition.condition;
      const leaves = collectLeaves(condition);
      const logic = condition?.conditions?.length
        ? (condition.logic ?? 'AND')
        : 'AND';

      if (stateName === raw.initial_state) {
        if (!leaves.length) return;
        noteIndicators(leaves);
        entries.push({transitionIndex, logic, leaves});
        return;
      }

      const kind = exitKind(transition.comment);
      const multiple =
        typeof condition?.val === 'string'
          ? ENTRY_PRICE_MULTIPLE.exec(condition.val.trim())
          : null;
      const editablePct =
        kind.kind === 'take_profit' &&
        TAKE_PROFIT_COMMENT.test(transition.comment ?? '') &&
        multiple !== null &&
        (condition?.op === '>=' || condition?.op === '<=');
      const falling =
        condition?.op === '<=' ||
        condition?.op === '<' ||
        condition?.op === 'crosses_below';
      if (kind.kind === 'signal') {
        noteIndicators(leaves);
        if (!leaves.length) return;
      }
      exits.push({...kind, editablePct, falling, logic, leaves});
    });
  }

  if (!entries.length && !exits.length && !raw.nlp_triggers?.length) {
    return null;
  }
  return {entries, exits, nlpTriggers: raw.nlp_triggers ?? [], indicators};
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The editable parts of an entry condition leaf, and the field each one writes. Adding a part here
 * is the only change a new editable token needs on this side.
 */
const ENTRY_PART_FIELD = {
  entry: 'val',
  entryOp: 'op',
  entryVar: 'var',
} as const satisfies Record<string, keyof RawCondition>;

export type EntryTokenPart = keyof typeof ENTRY_PART_FIELD;

export const ENTRY_PARTS = Object.keys(
  ENTRY_PART_FIELD,
) as readonly EntryTokenPart[];

const isEntryPart = (value: string | undefined): value is EntryTokenPart =>
  (ENTRY_PARTS as readonly (string | undefined)[]).includes(value);

/**
 * A clone of `fsm` with one field of one entry condition leaf replaced, or `fsm` untouched when the
 * leaf is not a plain `{var, op, val}` triple. An unparsed prose condition has no such triple, and
 * writing over it would replace the transition's real condition and brick the strategy.
 */
export function withEntryLeafField(
  fsm: unknown,
  transitionIndex: number,
  path: readonly number[],
  part: EntryTokenPart,
  value: string | number,
): unknown {
  const raw = asRaw(fsm);
  if (!raw?.initial_state) return fsm;
  const next = clone(raw);
  const transition =
    next.states?.[raw.initial_state]?.transitions?.[transitionIndex];
  if (!transition?.condition) return fsm;
  let leaf: RawCondition | undefined = transition.condition;
  for (const i of path) leaf = leaf?.conditions?.[i];
  if (leaf?.var === undefined) return fsm;
  // A threshold only moves between numbers; the projection reads it back with toNumber, so writing
  // a string where one was parsed would drop the token.
  if (part === 'entry' && toNumber(leaf.val) === null) return fsm;
  Object.assign(leaf, {[ENTRY_PART_FIELD[part]]: value});
  return next;
}

/** The first plain take-profit percentage, if the FSM has one it can rewrite. */
export function takeProfitPct(fsm: unknown): number | undefined {
  return parseRuleFsm(fsm)?.exits.find(
    e => e.kind === 'take_profit' && e.editablePct,
  )?.pct;
}

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * A copy of `fsm` with every rewritable take profit set to `pct`: the `$entry_price * m` threshold
 * and the compiler's comment, which is what the console and the engine's own logs read the
 * percentage back from.
 */
export function withTakeProfitPct(fsm: unknown, pct: number): unknown {
  const raw = asRaw(fsm);
  if (!raw) return fsm;
  const next = clone(raw);
  let changed = false;
  for (const [stateName, state] of Object.entries(next.states ?? {})) {
    if (stateName === next.initial_state) continue;
    for (const transition of state.transitions ?? []) {
      const condition = transition.condition;
      if (
        !transition.comment ||
        !TAKE_PROFIT_COMMENT.test(transition.comment)
      ) {
        continue;
      }
      if (
        typeof condition?.val !== 'string' ||
        !ENTRY_PRICE_MULTIPLE.test(condition.val.trim())
      ) {
        continue;
      }
      if (condition.op !== '>=' && condition.op !== '<=') continue;
      const multiplier =
        condition.op === '>=' ? round6(1 + pct / 100) : round6(1 - pct / 100);
      condition.val = `$entry_price * ${multiplier}`;
      transition.comment = transition.comment.replace(
        TAKE_PROFIT_COMMENT,
        `Take profit at ${pct}%`,
      );
      changed = true;
    }
  }
  return changed ? next : fsm;
}

/** `entry:<transition>:<path>` - the token key for one part of one entry condition leaf. */
export const entryTokenKey = (
  transitionIndex: number,
  path: readonly number[],
  part: EntryTokenPart = 'entry',
): RuleTokenKey => `${part}:${transitionIndex}:${path.join('.')}` as const;

export function parseEntryTokenKey(key: string): {
  part: EntryTokenPart;
  transitionIndex: number;
  path: number[];
} | null {
  const [part, transition, pathSegments] = key.split(':');
  if (!isEntryPart(part) || !/^\d+$/.test(transition ?? '')) return null;
  return {
    part,
    transitionIndex: Number(transition),
    path: pathSegments ? pathSegments.split('.').map(Number) : [],
  };
}

/**
 * The candle sizes a rule is worded for ("every 5-min candle", "every daily candle"). Any other
 * timeframe is shown as it is written.
 */
export const WORDED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const;

export type WordedTimeframe = (typeof WORDED_TIMEFRAMES)[number];

export const wordedTimeframe = (
  timeframe: string,
): WordedTimeframe | undefined =>
  WORDED_TIMEFRAMES.find(value => value === timeframe);

/** What a QTY count is of. */
export type QtyUnit = 'lot' | 'share';

/**
 * QTY means lots in F&O and shares in equity - the executors already differ
 * (`sentinel/engine/fno_action_handlers.py` multiplies by the lot size, `action_handlers.py` does
 * not), so the word must follow the instrument.
 */
export const qtyUnit = (isFno: boolean): QtyUnit => (isFno ? 'lot' : 'share');

/** A rule's size: "5 shares", "2 lots", "10% of capital", "1% risk" or a rupee amount. */
export type SizingParts =
  | {mode: 'QTY'; count: number; unit: QtyUnit}
  | {mode: 'PERCENT'; pct: number}
  | {mode: 'RISK_PERCENT'; pct: number}
  | {mode: 'AMOUNT'; amount: number};

export function sizingParts(
  values: Pick<StrategyRuleValues, 'amount' | 'sizingMode' | 'isFno'>,
): SizingParts {
  switch (values.sizingMode) {
    case 'QTY':
      return {mode: 'QTY', count: values.amount, unit: qtyUnit(values.isFno)};
    case 'PERCENT':
      return {mode: 'PERCENT', pct: values.amount};
    case 'RISK_PERCENT':
      return {mode: 'RISK_PERCENT', pct: values.amount};
    default:
      return {mode: 'AMOUNT', amount: values.amount};
  }
}

/** How a rule repeats: once, on each watchlist match, or after each exit (anything else). */
export type RuleRepeat = 'ONCE' | 'WATCHLIST' | 'LOOP';

export const ruleRepeat = (executionMode: string): RuleRepeat =>
  executionMode === 'ONCE' || executionMode === 'WATCHLIST'
    ? executionMode
    : 'LOOP';

/** One way a rule exits, in the order a description lists them. */
export type RuleExitPart =
  | {kind: 'take_profit'; pct: number}
  | {kind: 'stop_loss'; pct: number}
  | {kind: 'signal'; logic: 'AND' | 'OR'; leaves: RuleLeaf[]}
  | {kind: 'news'; summary: string}
  | {kind: 'square_off'};

export interface StrategyRuleParts {
  /** The candle the rule runs on, as written; `wordedTimeframe` says whether it has a word. */
  timeframe: string;
  symbol: string;
  /** Equity buys; F&O enters a position. */
  action: 'buy' | 'enter';
  /**
   * Absent for F&O sized in rupees or percent: a rupee budget says nothing useful about a
   * derivative position; a lot count does.
   */
  sizing?: SizingParts;
  /** The first entry rule; absent when the FSM has only exits or news triggers. */
  entry?: ParsedEntryRule;
  /** The FSM's exits, then its news triggers, then the intraday square-off. */
  exits: RuleExitPart[];
  repeat: RuleRepeat;
}

/**
 * The rule in one line, as parts, from the same FSM the steps are drawn from, so the description
 * and the steps can never disagree after an edit.
 *
 * Null without a readable FSM: the description composes fragments, and the only text available
 * then is `entryText`/`exitText` - whole sentences the step cards already show verbatim. Callers
 * hide the description rather than repeat them.
 */
export function strategyRuleParts(
  values: StrategyRuleValues,
  parsed: ParsedRuleFsm | null,
): StrategyRuleParts | null {
  if (!parsed) return null;

  const exits: RuleExitPart[] = [];
  for (const exit of parsed.exits) {
    if (exit.kind === 'take_profit' && exit.pct !== undefined) {
      exits.push({kind: 'take_profit', pct: exit.pct});
    } else if (exit.kind === 'stop_loss' && exit.pct !== undefined) {
      exits.push({kind: 'stop_loss', pct: exit.pct});
    } else if (exit.leaves.length) {
      exits.push({kind: 'signal', logic: exit.logic, leaves: exit.leaves});
    }
  }
  for (const trigger of parsed.nlpTriggers) {
    exits.push({kind: 'news', summary: trigger.summary});
  }
  if (values.isIntraday) exits.push({kind: 'square_off'});

  const entry = parsed.entries[0];
  // A rupee budget says nothing useful about a derivative position; a lot count does.
  const isSized = !values.isFno || values.sizingMode === 'QTY';
  return {
    timeframe: values.timeframe,
    symbol: values.symbol,
    action: values.isFno ? 'enter' : 'buy',
    ...(isSized ? {sizing: sizingParts(values)} : {}),
    ...(entry ? {entry} : {}),
    exits,
    repeat: ruleRepeat(values.executionMode),
  };
}
