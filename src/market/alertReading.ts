import {ALERT_READING_FIELDS} from '../data/alertReadingFields.ts';
import {
  type AlertCondition,
  type AlertLeaf,
  type MonitorFsm,
  monitorFsm,
} from './alertRule.ts';

// The verbs the card's reading uses (`_CONDITION_OPERATOR_ENGLISH` in
// llm/graph/nodes/strategy/submit_plan.py) that the engine has an operator for.
// "makes a new high", "is rising", "is between"… have none, so a reading using
// one is not compiled at all rather than compiled into something else.
const VERBS: [string, string][] = [
  ['crosses above', 'crosses_above'],
  ['crosses below', 'crosses_below'],
  ['is at least', '>='],
  ['is at most', '<='],
  ['is above', '>'],
  ['is below', '<'],
];

// Longest first, so "RSI (14)" never matches inside a longer label.
const LABELS = Object.keys(ALERT_READING_FIELDS).sort(
  (a, b) => b.length - a.length,
);

/** One clause of the reading as the engine's leaf, or null when the engine cannot watch it. */
export const readingLeaf = (clause: string): AlertLeaf | null => {
  const label = LABELS.find(l => clause.startsWith(`${l} `));
  const column = label === undefined ? undefined : ALERT_READING_FIELDS[label];
  if (label === undefined || column === undefined) return null;
  const rest = clause.slice(label.length + 1);
  const verb = VERBS.find(([words]) => rest.startsWith(`${words} `));
  if (verb === undefined) return null;
  const rhs = rest.slice(verb[0].length + 1).trim();
  const compare = ALERT_READING_FIELDS[rhs];
  const value = Number(rhs.replace(/,/g, ''));
  if (compare === undefined && (rhs === '' || !Number.isFinite(value)))
    return null;
  return {var: column, op: verb[1], val: compare ?? value};
};

/**
 * The engine's machine for the chat card's Condition row, or null when any
 * part of it is something the engine cannot watch.
 *
 * create-backtest refuses an alert without an FSM, and the card carries only
 * the reading. The reading is not free prose, though: it is the assistant's
 * checked conditions rendered with one label per field and one verb per
 * operator, joined with " and " — so it reads back exactly, and anything it
 * cannot read back exactly is refused rather than approximated.
 */
export const readingFsm = (reading: string | undefined): MonitorFsm | null => {
  const clauses = (reading ?? '').trim().split(' and ').filter(Boolean);
  const leaves: AlertLeaf[] = [];
  for (const clause of clauses) {
    const leaf = readingLeaf(clause);
    if (leaf === null) return null;
    leaves.push(leaf);
  }
  const [first] = leaves;
  if (first === undefined) return null;
  const condition: AlertCondition =
    leaves.length === 1 ? first : {logic: 'AND', conditions: leaves};
  return monitorFsm(condition);
};
