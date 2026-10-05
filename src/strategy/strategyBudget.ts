/**
 * Reading a strategy's `budget_config`, whichever of its two shapes the row carries (see
 * BudgetConfig). Read through these rather than off the fields: an Athena script row has no
 * `mode`, and `budget_config.mode.toUpperCase()` on one took down the Console, the Portfolio
 * strategies pane and the chat strategy cards.
 */
import type {ConsoleSizingMode} from '../types/console.ts';
import type {
  BudgetConfig,
  Strategy,
  StrategyRow,
  useTradeStatusResponse,
} from '../types/trade.ts';

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
 * no `mode`, or an `allocate` whatever else it carries. Its `val` is the strategy's TOTAL capital
 * and `allocate` the share of it each position takes, so `val` is not the position size it is on
 * every other row.
 */
export const isScriptBudget = (budget: BudgetSource): boolean =>
  budget != null &&
  ((budget.type != null && budget.mode == null) || budget.allocate != null);

type ScriptSource = Pick<StrategyRow, 'budget_config' | 'fsm' | 'rules'>;

/**
 * Whether a strategy's rules are its code - an Athena script ("C") strategy. By its budget's
 * shape (`isScriptBudget`), which holds even if the row later gains a `mode`; or by what it
 * lacks: no sizing mode, no FSM and no projected rules. Neither `update-fsm` (there is no FSM to
 * write) nor `switch-strategy` (it would recreate the strategy from its prompt, not its code) can
 * take one, and it states no position size. The one test both apps and every surface use.
 */
export const isScriptStrategy = (strategy: ScriptSource): boolean =>
  isScriptBudget(strategy.budget_config) ||
  (typeof strategy.budget_config?.mode !== 'string' &&
    Object.keys(strategy.fsm?.states ?? {}).length === 0 &&
    [
      strategy.rules?.entry,
      strategy.rules?.exit,
      strategy.rules?.nlp_triggers,
    ].every(list => (list ?? []).length === 0));

/**
 * One position's size as the row states it, in its mode's unit (₹, a count or a percent).
 * Undefined for a script strategy, whose `val` is the whole capital: no per-position figure is
 * better than a wrong one.
 */
export const strategyPositionSize = (
  strategy: ScriptSource,
): number | undefined =>
  isScriptStrategy(strategy) ? undefined : budgetVal(strategy.budget_config);

/**
 * An is-alive row with every field the backend may have dropped filled in with its empty value
 * (`omitempty`: "", false, 0). `budget_config` and `fsm` stay as sent - absent means absent.
 */
export const normalizeStrategyRow = (row: StrategyRow): Strategy => ({
  ...row,
  user_id: row.user_id ?? 0,
  symbol: row.symbol ?? '',
  status: row.status ?? '',
  shard_id: row.shard_id ?? 0,
  market: row.market ?? 'IN',
  timeframe: row.timeframe ?? '',
  execution_mode: row.execution_mode ?? '',
  original_query: row.original_query ?? '',
  target_scope: row.target_scope ?? null,
  is_parent: row.is_parent ?? false,
  is_intraday: row.is_intraday ?? false,
  is_backtest: row.is_backtest ?? false,
  is_fno: row.is_fno ?? false,
});

/**
 * The is-alive answer with its rows normalised; a missing list is an empty one. An answer that is
 * no object at all is handed back as it came, for the caller's own error handling to meet.
 */
export const normalizeTradeStatus = (
  response: Omit<useTradeStatusResponse, 'strategies'> & {
    strategies?: StrategyRow[] | null;
  },
): useTradeStatusResponse =>
  typeof response !== 'object' || response === null
    ? response
    : {
        ...response,
        strategies: (response.strategies ?? []).map(normalizeStrategyRow),
      };
