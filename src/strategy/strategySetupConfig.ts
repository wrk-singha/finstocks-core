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

/**
 * The `script_entry` values that mark a C strategy card: the ABI the llm writes the card's code
 * against, `evaluate_v2` (one symbol) or `evaluate_v3` (every symbol of the row in one call), as
 * web reads them (5b02f608). A known set, where web matches `/^evaluate(_v\d+)?$/`: an entry not
 * shipped yet (`evaluate_v4`) or a bare `evaluate` stays a card that cannot be started, rather
 * than one whose code goes to an engine nobody has seen run it.
 *
 * The entry is read, never sent: backend-go's strategy-action has no such field and hands Athena
 * only the card's code, its hash and its signature, so the code itself is what names its entry.
 */
export const SCRIPT_ENTRIES_C: readonly string[] = Object.freeze([
  'evaluate_v2',
  'evaluate_v3',
]);

/** Whether `entry` is exactly one of `SCRIPT_ENTRIES_C`. */
export const isScriptEntry = (entry: unknown): entry is string =>
  typeof entry === 'string' && SCRIPT_ENTRIES_C.includes(entry);

/**
 * The v2 entry alone, as v0.9.0 and earlier exported it. Not what makes a card a C card (that is
 * any of `SCRIPT_ENTRIES_C`, `isScriptEntry`), and never sent or put in place of a card's own.
 */
export const SCRIPT_ENTRY_C = 'evaluate_v2';

/**
 * Where a card's `tickers`, and so a run's `symbol`, goes from one symbol to the next: a comma,
 * with any spaces around it.
 */
export const TICKER_SEPARATOR = /\s*,\s*/;

/**
 * The symbols a card's `tickers` (or a run's `symbol`) names, in order, each trimmed. A stray comma
 * keeps its empty part ("HDFCBANK," is two parts, not one symbol); nothing at all names none.
 */
export const tickersOf = (tickers: string | null | undefined): string[] => {
  const all = (tickers ?? '').trim();
  return all === '' ? [] : all.split(TICKER_SEPARATOR);
};

/**
 * Why a C card cannot be started here, though it is one (`isScriptCard`):
 * - `notRunnable`: the card says the engine cannot run its code yet (`runnable: false`).
 * - `noSymbol`: its `tickers` name no symbol, and a symbol read back out of its prose rows is what
 *   put unrunnable rows in the database.
 * - `severalSymbols`: its `tickers` name more than one. Every run of the card sends them joined as
 *   one `symbol`, which backend-go's `cardRow` makes a single symbol ("HDFCBANK, ICICIBANK") that
 *   no runner trades, and the card's one amount would be shown for what the code may buy of each.
 */
export type ScriptCardHold = 'notRunnable' | 'noSymbol' | 'severalSymbols';

/** The card's code, when it is a C card, whether or not it can be started. */
function scriptCodeOf(
  terms: BacktestSetupTerms | null | undefined,
): ScriptRun | null {
  if (
    !terms ||
    !isScriptEntry(terms.script_entry) ||
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

/** Why a C card cannot be started (`ScriptCardHold`); null for one that can, and any other card. */
export function scriptCardHold(
  terms: BacktestSetupTerms | null | undefined,
): ScriptCardHold | null {
  if (!terms || scriptCodeOf(terms) === null) return null;
  if (terms.runnable === false) return 'notRunnable';
  const tickers = tickersOf(terms.tickers);
  if (tickers.length === 0) return 'noSymbol';
  return tickers.length > 1 ? 'severalSymbols' : null;
}

/**
 * The card's C strategy, when it is one that can be started: a `script_entry` of
 * `SCRIPT_ENTRIES_C` with its code and the code's hash, and the code's signature when the card
 * carries one (an empty one is none, as the backend reads it), on a card with no
 * `scriptCardHold`: runnable, and naming exactly one symbol. Such a card runs only from its own
 * buttons and only through `strategy-action`: a create-backtest sent for it has no FSM to send
 * (refused), or an FSM that is not the card's code (deployed as a different rule). Null for every
 * other card: a held C card, and a composed "script_preview" whose `script` is a receipt rather
 * than an entry point. No request can be built for a card without one.
 */
export function scriptRunOf(
  terms: BacktestSetupTerms | null | undefined,
): ScriptRun | null {
  return scriptCardHold(terms) === null ? scriptCodeOf(terms) : null;
}

/**
 * Whether a plan card is a C strategy card: its rules are its code, whether or not it can be
 * started here (`scriptRunOf`, `scriptCardHold`).
 */
export const isScriptCard = (setup: {
  terms?: BacktestSetupTerms | undefined;
}): boolean => scriptCodeOf(setup.terms) !== null;

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
