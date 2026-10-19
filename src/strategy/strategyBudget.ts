/**
 * Reading a strategy's `budget_config`, whichever shape the row carries (see BudgetConfig): a
 * mode and its figure, or an Athena script's capital with its allocation or its quantity. Read through these rather than off the fields: an Athena script row has no
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

const upper = (value: unknown): string | undefined =>
  typeof value === 'string' ? value.toUpperCase() : undefined;

/**
 * Whether this is an Athena script budget sized by quantity, `{val, type: "QTY", qty}`: what
 * backend-go writes for a QTY strategy-action (deploy, deploy_live, replace and backtest) since
 * 4c1db7b4. Its `val` is the capital pool - the backend's 1,00,000 unless the run sent
 * `total_capital` - and `qty` the lots or shares each order takes. A `mode` the row writes wins.
 */
const isScriptQtyBudget = (budget: BudgetSource): boolean =>
  budget != null &&
  upper(budget.mode) === undefined &&
  upper(budget.type) === 'QTY';

/**
 * The sizing mode, upper-cased. A script budget says it by its `type` (QTY; AMOUNT otherwise).
 * AMOUNT when the row names none - the backend's default - and a mode that is not a string reads
 * as none rather than throws.
 */
export const budgetMode = (budget: BudgetSource): string =>
  upper(budget?.mode) ?? (isScriptQtyBudget(budget) ? 'QTY' : 'AMOUNT');

/** The mode as one of the rules editor's four; anything else is AMOUNT, the editor's default. */
export const budgetSizingMode = (budget: BudgetSource): ConsoleSizingMode => {
  const mode = budgetMode(budget);
  return SIZING_MODES.find(known => known === mode) ?? 'AMOUNT';
};

const finite = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * The figure the row sizes by, in its mode's unit (`budgetMode`), when it is a finite number;
 * undefined when the row carries none. That is `val`, except on a script QTY budget, where `val`
 * is a capital pool the user may never have set and the size is `qty`: such a row with no
 * readable `qty` has no size, never its `val` read as one.
 */
export const budgetVal = (budget: BudgetSource): number | undefined =>
  isScriptQtyBudget(budget) ? finite(budget?.qty) : finite(budget?.val);

/**
 * Whether the row states real rupee capital: an AMOUNT budget with a positive `val`. A QTY budget
 * never does - its count is not rupees, and a script QTY budget's `val` is a pool the backend
 * fills with 1,00,000 when the run sent none - nor does PERCENT or RISK_PERCENT. A return or a
 * drawdown in percent is measured only against real capital.
 */
export const budgetHasRealCapital = (budget: BudgetSource): boolean =>
  budgetMode(budget) === 'AMOUNT' && (budgetVal(budget) ?? 0) > 0;

/**
 * Whether this is an Athena script ("C") strategy's budget, `{val, type, allocate}` or
 * `{val, type: "QTY", qty}`: a `type` and no `mode`, or an `allocate` whatever else it carries.
 * Its `val` is the strategy's TOTAL capital and `allocate` the share of it each position takes (or
 * `qty` the count each order takes), so `val` is not the position size it is on every other row.
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
 * Undefined for a script strategy sized by amount, whose `val` is the whole capital: no
 * per-position figure is better than a wrong one. A script sized by quantity states its size,
 * the `qty` each order takes.
 */
export const strategyPositionSize = (
  strategy: ScriptSource,
): number | undefined =>
  isScriptQtyBudget(strategy.budget_config) || !isScriptStrategy(strategy)
    ? budgetVal(strategy.budget_config)
    : undefined;

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
