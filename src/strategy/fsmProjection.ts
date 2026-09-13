/**
 * Projects a raw backend FSM (states + transitions) into the entry/exit clauses the rules panel
 * renders. Web-only today; pure.
 */
import type {
  ConditionClause,
  FSMRule,
  FSMStrategyRules,
  NLPTrigger,
} from '../types/trade.ts';

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

const OPERATOR_TEXT: Record<string, string> = {
  '>': 'above',
  '<': 'below',
  '>=': 'at or above',
  '<=': 'at or below',
  '==': 'equals',
  '!=': 'does not equal',
  crosses_above: 'crosses above',
  crosses_below: 'crosses below',
};

const UPPERCASE_INDICATORS = [
  'rsi',
  'atr',
  'macd',
  'adx',
  'di_',
  'cci',
  'mfi',
  'cmf',
  'obv',
  'ema',
  'sma',
  'vwap',
  'roc',
  'bb_',
  'sar',
  'iv',
  'oi',
  'ltp',
];

// Comment strings emitted by the backend compiler (graph/nodes/strategy/alpha/compiler.py).
const EXIT_COMMENT_PATTERNS: {
  pattern: RegExp;
  exitType: FSMRule['exit_type'];
}[] = [
  {pattern: /^Take profit at ([\d.]+)%/, exitType: 'take_profit'},
  {pattern: /^Stop loss at ([\d.]+)%/, exitType: 'stop_loss'},
  {pattern: /^Premium TP.*?([\d.]+)%/, exitType: 'take_profit'},
  {pattern: /^Premium SL.*?([\d.]+)%/, exitType: 'stop_loss'},
];

const IDENTIFIER = /^[a-z0-9_]+$/i;

// An unbound var compiles to an expression like "atr14 / volume_ma50". It is shown verbatim
// rather than prettified, because it signals a compiler failure worth seeing.
function humanizeVar(value: string): string {
  if (!IDENTIFIER.test(value)) return value;
  const lower = value.toLowerCase();
  if (UPPERCASE_INDICATORS.some(prefix => lower.startsWith(prefix)))
    return value.toUpperCase();
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function humanizeValue(value: unknown): string {
  if (
    typeof value === 'string' &&
    (value.startsWith('$') || IDENTIFIER.test(value))
  ) {
    return humanizeVar(value);
  }
  return String(value);
}

function toClauses(condition: RawCondition | undefined): ConditionClause[] {
  if (!condition) return [];
  if (condition.conditions?.length) {
    return condition.conditions.flatMap(toClauses);
  }
  if (condition.var === undefined) return [];
  return [
    {
      indicator: humanizeVar(condition.var),
      operator: OPERATOR_TEXT[condition.op ?? ''] ?? condition.op ?? '',
      value: humanizeValue(condition.val),
    },
  ];
}

function toExitDetails(
  comment: string | undefined,
): Pick<FSMRule, 'exit_type' | 'pct'> {
  if (!comment) return {};
  for (const {pattern, exitType} of EXIT_COMMENT_PATTERNS) {
    const match = pattern.exec(comment);
    if (match)
      return {
        ...(exitType ? {exit_type: exitType} : {}),
        pct: Number(match[1]),
      };
  }
  return {exit_type: 'signal'};
}

function toRule(condition: RawCondition | undefined): FSMRule | null {
  const clauses = toClauses(condition);
  if (!clauses.length) return null;
  const logic = condition?.conditions?.length
    ? (condition.logic ?? 'AND')
    : undefined;
  return {condition: '', clauses, ...(logic !== undefined ? {logic} : {})};
}

/** Returns null when there is nothing to render, so callers fall back to plain-text rows. */
export function projectRawFsm(fsm: unknown): FSMStrategyRules | null {
  const raw = fsm as RawFsm | null | undefined;
  if (!raw?.states || !raw.initial_state) return null;

  const entry: FSMRule[] = [];
  const exit: FSMRule[] = [];

  for (const [stateName, state] of Object.entries(raw.states)) {
    for (const transition of state.transitions ?? []) {
      // Self-loops are compiler bookkeeping (e.g. a daily trade-count reset), not user rules.
      if (transition.next_state === stateName) continue;

      const rule = toRule(transition.condition);
      if (!rule) continue;

      if (stateName === raw.initial_state) {
        entry.push(rule);
      } else {
        exit.push({...rule, ...toExitDetails(transition.comment)});
      }
    }
  }

  if (!entry.length && !exit.length && !raw.nlp_triggers?.length) return null;
  return {
    entry,
    exit,
    ...(raw.nlp_triggers !== undefined ? {nlp_triggers: raw.nlp_triggers} : {}),
  };
}
