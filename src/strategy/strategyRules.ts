/**
 * The legible rows a strategy compiles into before a deploy order (the white-box "Strategy
 * Card"), and the console's read-only / editable rule views.
 *
 * drift resolved 2026-09-13: merged. Mobile won the override semantics in buildStrategyRules
 * (`||`: an empty in-sheet symbol/timeframe edit is no override, so the strategy's own value
 * shows rather than the row vanishing - the web's `??` is the older port). Web contributed
 * buildConsoleRules and buildConsoleRulesDraft, which the mobile copy has no console for yet;
 * its React `ruleValue` wrapper and buildScreenerStrategyRules stay in the web app.
 */
import {formatAllocation, formatCurrency} from '../format/index.ts';
import {extractUnderlyingSymbol} from '../market/symbols.ts';
import {splitEntryExit} from '../screener/screenerUtils.ts';
import type {ConsoleRules, ConsoleRulesDraft} from '../types/console.ts';
import type {ScreenerStrategy} from '../types/screener.ts';
import type {Strategy} from '../types/trade.ts';
import {
  budgetMode,
  budgetSizingMode,
  budgetVal,
  strategyPositionSize,
} from './strategyBudget.ts';
import {type QtyUnit, qtyUnit} from './strategyRuleEdit.ts';

// These rows are English throughout; the unit follows the instrument (see qtyUnit), so a lot is
// never called a share.
const QTY_UNIT_WORDS: Readonly<
  Record<QtyUnit, readonly [one: string, other: string]>
> = {
  lot: ['lot', 'lots'],
  share: ['share', 'shares'],
};

const qtyUnitWord = (isFno: boolean, count: number): string =>
  QTY_UNIT_WORDS[qtyUnit(isFno)][count === 1 ? 0 : 1];

export interface StrategyRule {
  k: string;
  v: string;
}

export interface StrategyRuleOptions {
  mode: 'MOCK' | 'LIVE';
  brokerName?: string | null;
  capitalOverride?: number;
  entryOverride?: string;
  symbolOverride?: string;
  timeframeOverride?: string;
}

const executionLabel = (opts: {
  mode: 'MOCK' | 'LIVE';
  brokerName?: string | null;
}): string =>
  opts.mode === 'MOCK'
    ? 'Simulated — no broker'
    : (opts.brokerName ?? '') || 'Connected broker';

/**
 * Compiles a Strategy into the legible rows shown before a deploy order. Real-data-only: a row
 * is emitted only when its source field is present, so nothing is fabricated. `capitalOverride`
 * reflects an in-sheet capital edit before it has been re-deployed.
 */
export function buildStrategyRules(
  strategy: Strategy,
  opts: StrategyRuleOptions,
): StrategyRule[] {
  const rows: StrategyRule[] = [];

  const rawUniverse = (opts.symbolOverride ?? '') || strategy.symbol;
  const universe = rawUniverse === 'CUSTOM_LIST' ? 'Custom list' : rawUniverse;
  if (universe) rows.push({k: 'Universe', v: universe});

  const entrySource = (opts.entryOverride ?? strategy.original_query) || '';
  const entry = splitEntryExit(entrySource).entry || entrySource;
  if (entry) rows.push({k: 'Entry rule', v: entry});

  // A news strategy has no TP/SL - its exit is prose. Without this the row is omitted entirely
  // and the confirmation card reads "this never sells".
  const exitParts: string[] = [];
  if (strategy.take_profit != null)
    exitParts.push(`TP +${strategy.take_profit}%`);
  if (strategy.stop_loss != null) exitParts.push(`SL −${strategy.stop_loss}%`);
  for (const t of strategy.rules?.nlp_triggers ?? []) exitParts.push(t.summary);
  if (exitParts.length) rows.push({k: 'Exit rule', v: exitParts.join(' · ')});

  // A script strategy's `val` is its total capital, so it states no position size of its own.
  const capital = opts.capitalOverride ?? strategyPositionSize(strategy);
  if (capital != null) {
    rows.push({
      k: 'Position size',
      v: formatAllocation(
        capital,
        budgetMode(strategy.budget_config),
        0,
        qtyUnitWord(strategy.is_fno, capital),
      ),
    });
  }

  const timeframe = (opts.timeframeOverride ?? '') || strategy.timeframe;
  if (strategy.is_intraday) {
    rows.push({k: 'Timeframe', v: 'Intraday · square off same day'});
  } else if (timeframe) {
    rows.push({k: 'Timeframe', v: timeframe});
  }

  rows.push({k: 'Execution', v: executionLabel(opts)});

  return rows;
}

/**
 * Same read-only preview as buildStrategyRules, for a screener pick that has no strategy_id yet
 * - deploying/backtesting it for the first time is a creation, not a redeploy, so there's no
 * Strategy row to build from.
 */
export function buildScreenerStrategySpec(
  strategy: ScreenerStrategy,
  opts: {mode: 'MOCK' | 'LIVE'; brokerName?: string | null; capital?: number},
): StrategyRule[] {
  const rows: StrategyRule[] = [];

  const universe = (strategy.todays_symbol ?? '') || strategy.symbol;
  if (universe) rows.push({k: 'Universe', v: universe});

  const {entry, exit} = splitEntryExit(
    (strategy.full_prompt ?? '') || strategy.description,
  );
  if (entry) rows.push({k: 'Entry rule', v: entry});
  if (exit) rows.push({k: 'Exit rule', v: exit});

  if (opts.capital != null) {
    rows.push({k: 'Position size', v: formatCurrency(opts.capital)});
  }

  if (strategy.is_intraday) {
    rows.push({k: 'Timeframe', v: 'Intraday · square off same day'});
  }

  rows.push({k: 'Execution', v: executionLabel(opts)});

  return rows;
}

/**
 * Structured, read-only rules from the real strategy model. Take-profit/stop-loss/time-exit stay
 * display-only - they're derived from the FSM, which only Model2 builds, so there's no endpoint
 * to hand it edits.
 */
export function buildConsoleRules(
  strategy: Strategy,
  capital: number,
): ConsoleRules {
  const rawUniverse = (strategy.symbol || (strategy.stock_symbol ?? '')) ?? '';
  const universe =
    rawUniverse === 'CUSTOM_LIST'
      ? 'Custom list'
      : extractUnderlyingSymbol(rawUniverse) || rawUniverse;
  const written = strategy.budget_config?.mode;
  const mode = typeof written === 'string' ? written : undefined;
  const displayCapital =
    mode && mode.toUpperCase() !== 'AMOUNT'
      ? (budgetVal(strategy.budget_config) ?? capital)
      : capital;
  const sizingMethod = mode === 'AMOUNT' ? 'Fixed amount' : mode;
  return {
    universe,
    ...(strategy.timeframe
      ? {timeframe: strategy.timeframe.toUpperCase()}
      : {}),
    ...(strategy.original_query ? {entry: strategy.original_query} : {}),
    ...(strategy.take_profit != null
      ? {takeProfit: `+${strategy.take_profit}%`}
      : {}),
    ...(strategy.stop_loss != null
      ? {stopLoss: `-${strategy.stop_loss}%`}
      : {}),
    ...(strategy.is_intraday ? {timeExit: 'Square off same day'} : {}),
    ...(displayCapital
      ? {
          capital: formatAllocation(
            displayCapital,
            mode,
            0,
            qtyUnitWord(strategy.is_fno, displayCapital),
          ),
        }
      : {}),
    ...(sizingMethod !== undefined ? {sizingMethod} : {}),
    fsm: strategy.rules ?? null,
  };
}

/**
 * Raw (unformatted) editable values seeding the rules editor - all of them go out via re-deploy
 * (switch-strategy). `normalizeTimeframe` maps the backend's lowercase timeframe onto the
 * editor's interval pill vocabulary (the web's chart/timeframe helper; not in core).
 */
export function buildConsoleRulesDraft(
  strategy: Strategy,
  capital: number,
  normalizeTimeframe: (raw?: string | null) => string,
): ConsoleRulesDraft {
  // The mode is preserved, not narrowed to QTY/AMOUNT. Collapsing it meant opening the editor on
  // a RISK_PERCENT strategy and pressing redeploy silently converted it to AMOUNT - and
  // reinterpreted `val` (e.g. 1, meaning 1% risk) as ₹1. The editor already offers all four modes.
  const totalCapital = strategy.budget_config?.total;
  return {
    capital: budgetVal(strategy.budget_config) ?? capital,
    sizingMode: budgetSizingMode(strategy.budget_config),
    ...(totalCapital !== undefined ? {totalCapital} : {}),
    entryQuery: strategy.original_query ?? '',
    symbol: strategy.symbol ?? '',
    timeframe: normalizeTimeframe(strategy.timeframe),
    rawFSM: strategy.fsm ?? null,
    strategyId: strategy.strategy_id,
    isParent: strategy.is_parent,
    isIntraday: strategy.is_intraday,
    executionMode: strategy.execution_mode,
    isFno: strategy.is_fno,
  };
}
