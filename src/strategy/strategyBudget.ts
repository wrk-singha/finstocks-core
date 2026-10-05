/**
 * Reading a strategy's `budget_config`, whichever of its two shapes the row carries (see
 * BudgetConfig). Read through these rather than off the fields: an Athena script row has no
 * `mode`, and `budget_config.mode.toUpperCase()` on one took down the Console, the Portfolio
 * strategies pane and the chat strategy cards.
 */
import type {ConsoleSizingMode} from '../types/console.ts';
import type {BudgetConfig} from '../types/trade.ts';

type BudgetSource = BudgetConfig | null | undefined;

const SIZING_MODES: readonly ConsoleSizingMode[] = [
  'AMOUNT',
  'QTY',
  'PERCENT',
  'RISK_PERCENT',
];

/**
 * The sizing mode, upper-cased. AMOUNT when the row names none - the backend's default, and what
 * every script budget sizes by - and a mode that is not a string reads as none rather than throws.
 */
export const budgetMode = (budget: BudgetSource): string => {
  const mode = budget?.mode;
  return typeof mode === 'string' ? mode.toUpperCase() : 'AMOUNT';
};

/** The mode as one of the rules editor's four; anything else is AMOUNT, the editor's default. */
export const budgetSizingMode = (budget: BudgetSource): ConsoleSizingMode => {
  const mode = budgetMode(budget);
  return SIZING_MODES.find(known => known === mode) ?? 'AMOUNT';
};

/** `val` when it is a finite number; undefined when the row carries none. */
export const budgetVal = (budget: BudgetSource): number | undefined => {
  const val = budget?.val;
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
};

/**
 * Whether this is an Athena script ("C") strategy's budget, `{val, type, allocate}`: a `type` and
 * no `mode`. Its `val` is the strategy's TOTAL capital and `allocate` the share of it each
 * position takes, so `val` is not the position size it is on every other row.
 */
export const isScriptBudget = (budget: BudgetSource): boolean =>
  budget != null && typeof budget.mode !== 'string' && budget.type != null;

/**
 * One position's size as the row states it, in its mode's unit (₹, a count or a percent).
 * Undefined on a script budget, whose `val` is the whole capital: no per-position figure is better
 * than a wrong one.
 */
export const budgetPositionSize = (budget: BudgetSource): number | undefined =>
  isScriptBudget(budget) ? undefined : budgetVal(budget);
