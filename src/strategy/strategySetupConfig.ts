/**
 * Reading a chat plan card (the LLM's confirm table) back into the create-backtest / create-
 * strategy request.
 *
 * drift resolved 2026-09-13: web won (2026-09-12 "fsm"). It carries `termsToConfig` /
 * `setupConfig` (the tool-emitted machine terms take precedence over parsing prose rows),
 * the `fsm` passthrough, the "1h" timeframe token and the WATCHLIST execution mode - the
 * mobile copy is the older row-parsing subset with none of those.
 */
import type {BacktestSetupTerms} from '../types/backtest.ts';
import type {ConsoleSizingMode} from '../types/console.ts';
import type {ScriptRun} from '../types/strategyRun.ts';

export interface SetupConfig {
  symbol?: string;
  strategy_hname?: string;
  timeframe?: string;
  start_date?: string;
  end_date?: string;
  allocated_amount?: number;
  /**
   * How `allocated_amount` reads - without it the backend falls through to AMOUNT, so "8% of
   * ₹5,00,000" would deploy ₹8.
   */
  sizing_mode?: ConsoleSizingMode;
  total_capital?: number;
  original_query?: string;
  is_intraday?: boolean;
  is_fno?: boolean;
  execution_mode?: string;
  fsm?: unknown;
}

export const normalizeSetupKey = (k: string): string =>
  k.toLowerCase().replace(/\s+/g, '_');

/** The `script_entry` that marks a C strategy card. */
export const SCRIPT_ENTRY_C = 'evaluate_v2';

/**
 * The card's C strategy, when it is one: `script_entry` "evaluate_v2" with its code and the
 * code's hash, and the code's signature when the card carries one (an empty one is none, as the
 * backend reads it). Such a card runs only from its own buttons and only through `strategy-action`:
 * a create-backtest sent for it has no FSM to send (refused), or an FSM that is not the card's
 * code (deployed as a different rule). Null for every other card, including a composed
 * "script_preview" whose `script` is a receipt rather than an entry point.
 */
export function scriptRunOf(
  terms: BacktestSetupTerms | null | undefined,
): ScriptRun | null {
  if (
    terms?.script_entry !== SCRIPT_ENTRY_C ||
    typeof terms.script !== 'string' ||
    terms.script === '' ||
    typeof terms.script_hash !== 'string' ||
    terms.script_hash === ''
  ) {
    return null;
  }
  return {
    script: terms.script,
    scriptHash: terms.script_hash,
    ...(typeof terms.script_sig === 'string' && terms.script_sig !== ''
      ? {scriptSig: terms.script_sig}
      : {}),
    strategyId: terms.strategy_id,
    backtestId: terms.backtest_id,
  };
}

/** Whether a plan card is a C strategy card (`scriptRunOf` on its terms). */
export const isScriptCard = (setup: {
  terms?: BacktestSetupTerms | undefined;
}): boolean => scriptRunOf(setup.terms) !== null;

/** The machine terms a plan card carries, when it carries them. */
export type SetupTerms = BacktestSetupTerms;

const SIZING_MODES: readonly ConsoleSizingMode[] = [
  'AMOUNT',
  'QTY',
  'PERCENT',
  'RISK_PERCENT',
];

const toAmount = (v: string | number | undefined): number | undefined => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Matched by keyword, not exact token - the LLM writes this as a phrase ("percent of capital"),
// not the backend's enum value. LOT and SHARE are here because the sizing row reads "2 lots" /
// "10 shares", and without them such a row fell through to the backend's AMOUNT default.
const parseSizingMode = (val: string): ConsoleSizingMode | undefined => {
  const upper = val.toUpperCase();
  if (upper.includes('RISK')) return 'RISK_PERCENT';
  if (upper.includes('PERCENT') || upper.includes('%')) return 'PERCENT';
  if (/QTY|QUANTITY|LOT|SHARE/.test(upper)) return 'QTY';
  if (upper.includes('AMOUNT')) return 'AMOUNT';
  return undefined;
};

const isSizingMode = (v: unknown): v is ConsoleSizingMode =>
  typeof v === 'string' && (SIZING_MODES as readonly string[]).includes(v);

/**
 * The plan as the backend meant it, when the card carries its own terms.
 *
 * The rows are a table for a person to read. Reading them BACK as configuration is where this
 * went wrong: whatever the model wrote beside "Tickers" became the symbol, uppercased, so
 * "TCS, RELIANCE" and "Tata Consultancy Services" and "Nifty 100" all became symbols that no
 * backtest could ever run - and nothing downstream refused them, so the row was written and
 * never finished. (`timeframe` in extractSetupConfig already had a patch for the same class of
 * problem, for one field: "1m (user preferred)".)
 *
 * `terms` are emitted by the tool that drew the card, from the arguments it was called with,
 * so there is nothing to interpret.
 */
export function termsToConfig(
  terms: SetupTerms | undefined,
): SetupConfig | null {
  if (!terms || typeof terms !== 'object') return null;
  const symbol = (terms.tickers ?? '').trim().toUpperCase();
  if (!symbol) return null;

  const allocated_amount = toAmount(terms.position_sizing);
  const total_capital = toAmount(terms.total_capital);
  // The RULES, joined exactly as the rows path joins them - entry then exit, newline between.
  // `original_query` is what the engine parses the strategy out of (OriginalQuery in
  // createbacktest.go, commented "entry/exit rules"), so putting `strategy_name` here handed it
  // a title and let it infer whatever it could: "9/21 EMA Crossover" happened to work because
  // the name described the rules, "TCS RSI Oversold-Overbought" returned zero trades, and a
  // sweep's variants - which differ ONLY in entry/exit and share one name - all ran as the same
  // strategy. Falls back to the name when a card carries no rules, which is the most the engine
  // can be given in that case.
  const original_query =
    [terms.entry_condition, terms.exit_condition].filter(Boolean).join('\n') ||
    terms.strategy_name;

  return {
    symbol,
    ...(terms.strategy_name !== undefined
      ? {strategy_hname: terms.strategy_name}
      : {}),
    ...(terms.timeframe !== undefined ? {timeframe: terms.timeframe} : {}),
    ...(terms.backtest_start !== undefined
      ? {start_date: terms.backtest_start}
      : {}),
    ...(terms.backtest_end !== undefined ? {end_date: terms.backtest_end} : {}),
    ...(allocated_amount !== undefined ? {allocated_amount} : {}),
    ...(total_capital !== undefined ? {total_capital} : {}),
    ...(isSizingMode(terms.sizing_mode)
      ? {sizing_mode: terms.sizing_mode}
      : {}),
    ...(terms.execution_mode !== undefined
      ? {execution_mode: terms.execution_mode}
      : {}),
    is_intraday: Boolean(terms.intraday),
    is_fno: Boolean(terms.fno_mode),
    ...(original_query !== undefined ? {original_query} : {}),
    ...(terms.fsm !== undefined ? {fsm: terms.fsm} : {}),
  };
}

/**
 * The plan, from its terms if it has them and from its rows if it does not.
 *
 * Older cards in an existing chat have no terms, and they still have to open. A card with
 * terms never falls back: a partial parse of the rows beside them would be a second answer to a
 * question already answered.
 */
export function setupConfig(
  rows: {k: string; v?: string}[],
  terms?: SetupTerms,
): SetupConfig {
  return termsToConfig(terms) ?? extractSetupConfig(rows);
}

/**
 * Shared by the backtest and strategy setup cards - both render the same k/v row shape from the
 * LLM's confirm table and need to pull the same fields back out of it before calling
 * create-backtest.
 */
export function extractSetupConfig(
  rows: {k: string; v?: string}[],
): SetupConfig {
  const config: SetupConfig = {};

  rows.forEach(row => {
    const key = normalizeSetupKey(row.k);
    if (!row.v || typeof row.v !== 'string') return;

    const val = row.v.trim();
    switch (key) {
      case 'tickers':
      case 'ticker':
        config.symbol = val.toUpperCase();
        break;
      case 'strategy_name':
        config.strategy_hname = val;
        break;
      case 'timeframe': {
        // The LLM sometimes annotates the value, e.g. "1m (user preferred)" - pull out just the
        // canonical token the backend/pill options accept.
        const match = /\b(1m|5m|15m|1h|1d)\b/.exec(val.toLowerCase());
        if (match?.[1]) config.timeframe = match[1];
        break;
      }
      case 'start_date':
        config.start_date = val;
        break;
      case 'backtest_period': {
        const isoDates = val.match(/\d{4}-\d{2}-\d{2}/g);
        if (isoDates?.[0]) config.start_date = isoDates[0];
        if (isoDates?.[1]) config.end_date = isoDates[1];
        break;
      }
      case 'end_date':
        config.end_date = val;
        break;
      case 'position_size':
      case 'position_sizing':
      case 'capital':
      case 'allocated_amount': {
        const numeric = parseFloat(val.replace(/[₹,%]/g, ''));
        if (Number.isFinite(numeric)) config.allocated_amount = numeric;
        break;
      }
      case 'sizing_mode': {
        const mode = parseSizingMode(val);
        if (mode) config.sizing_mode = mode;
        break;
      }
      case 'total_capital': {
        const tc = parseFloat(val.replace(/[₹,]/g, ''));
        if (Number.isFinite(tc)) config.total_capital = tc;
        break;
      }
      case 'entry_condition':
      case 'entry':
      case 'exit_condition':
      case 'exit':
        config.original_query = config.original_query
          ? `${config.original_query}\n${val}`
          : val;
        break;
      case 'intraday':
        config.is_intraday =
          val.toLowerCase() === 'yes' || val.toLowerCase() === 'true';
        break;
      case 'f&o_mode':
      case 'fno_mode':
      case 'f&o':
        config.is_fno =
          val.toLowerCase() === 'yes' || val.toLowerCase() === 'true';
        break;
      case 'execution_mode': {
        const mode = val.toUpperCase();
        config.execution_mode =
          mode === 'ONCE'
            ? 'ONCE'
            : mode === 'WATCHLIST'
              ? 'WATCHLIST'
              : 'LOOP';
        break;
      }
    }
  });

  return config;
}
