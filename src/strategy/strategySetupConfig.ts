/**
 * Reading a chat plan card (the LLM's confirm table) back into the create-backtest / create-
 * strategy request.
 *
 * drift resolved 2026-09-13: web won (2026-09-12 "fsm"). It carries `termsToConfig` /
 * `setupConfig` (the tool-emitted machine terms take precedence over parsing prose rows),
 * the `fsm` passthrough, the "1h" timeframe token and the WATCHLIST execution mode - the
 * mobile copy is the older row-parsing subset with none of those.
 */
import {
  BSE_INDICES,
  FNO_STOCK_UNDERLYINGS,
  NIFTY100_SYMBOLS,
  NSE_INDICES,
} from '../data/stocksData.ts';
import {parseFuturesSymbol} from '../market/futuresSymbol.ts';
import {parseOptionSymbol} from '../market/optionContract.ts';
import {extractUnderlyingSymbol, TRADABLE_INDICES} from '../market/symbols.ts';
import {BASKETS} from './strategyConflicts.ts';
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
 * keeps its empty part ("HDFCBANK," is two parts, not one symbol); nothing at all names none, and
 * so does anything that is not a string (a card can carry an array or a number there).
 */
export const tickersOf = (tickers: unknown): string[] => {
  const all = typeof tickers === 'string' ? tickers.trim() : '';
  return all === '' ? [] : all.split(TICKER_SEPARATOR);
};

/**
 * The longest one symbol can be: core's longest F&O contract spelling. Measured, not guessed: the
 * ISO option form (`parseOptionSymbol`, as backend-go's fnocontract.Parse) on a 10-letter
 * underlying, the longest in FNO_STOCK_UNDERLYINGS and FNO_INDEX_UNDERLYINGS (MIDCPNIFTY,
 * NIFTYNXT50, BAJAJ-AUTO), an 8-digit date, a 6-digit strike with one decimal (NSE's 2.5-rupee
 * spacing) and CE/PE: 10 + 8 + 8 + 2. The longest in core's own tests is 25
 * (NIFTYNXT502026102770000CE); every equity symbol core lists is 10 or less.
 */
export const MAX_SYMBOL_LENGTH = 28;

/** What a card writes where it has no symbol, compared upper-cased: no symbol at all. */
const PLACEHOLDERS: ReadonlySet<string> = new Set([
  '-',
  '.',
  'NA',
  'N/A',
  'NONE',
  'TBD',
  'TBA',
  'NULL',
  'UNDEFINED',
  'NAN',
  'NIL',
  'XXX',
]);

/**
 * Every index (NSE_INDICES and BSE_INDICES, by symbol and by name) that is not one of the
 * `TRADABLE_INDICES`, and core's basket names (`BASKETS`): none is one symbol a strategy trades.
 * "NIFTY100" and "NIFTY 100" alike.
 */
const INDEX_OR_BASKET: ReadonlySet<string> = new Set([
  ...BASKETS,
  ...[...NSE_INDICES, ...BSE_INDICES]
    .filter(index => !TRADABLE_INDICES.includes(index.symbol))
    .flatMap(index => [index.symbol, index.name]),
]);

/**
 * The tradable indices by the names with a space NSE_INDICES gives them ("NIFTY 50", "NIFTY
 * BANK"): the only spellings with a space that are one symbol.
 */
const SPACED_INDEX_NAMES: ReadonlySet<string> = new Set(
  NSE_INDICES.filter(index => TRADABLE_INDICES.includes(index.symbol)).map(
    index => index.name,
  ),
);

/**
 * The equity symbols core can resolve (NIFTY100_SYMBOLS, "every NSE equity symbol the app can
 * resolve", and FNO_STOCK_UNDERLYINGS): the only ones an `&` or a `-` is trusted in (M&M,
 * BAJAJ-AUTO, J&KBANK), since a join ("HDFCBANK&ICICIBANK") or a series suffix ("RELIANCE-EQ")
 * is spelled the same way.
 */
const LISTED_EQUITIES: ReadonlySet<string> = new Set([
  ...NIFTY100_SYMBOLS,
  ...FNO_STOCK_UNDERLYINGS,
]);

/**
 * The roots index names are spelled from, as strategyConflicts' INDEX_NAME reads them, with CNX
 * (the old NSE index prefix: CNXIT, CNXPHARMA). No equity core lists starts with one.
 */
const INDEX_ROOT = /^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|BANKEX|CNX)/;

/** Spellings of an index that neither core's index lists nor INDEX_ROOT reach. */
const INDEX_ALIASES: ReadonlySet<string> = new Set([
  'NIFTYBANK',
  'NIFTYFIN',
  'NIFTYNEXT50',
  'BSESENSEX',
]);

const isContract = (symbol: string): boolean =>
  parseOptionSymbol(symbol) !== null || parseFuturesSymbol(symbol) !== null;

/**
 * A cleanly spelled symbol that is still an index: one that is not a contract and starts with an
 * index root ("NIFTY50", "NIFTYINFRA", "SENSEX30", "CNXIT"), or whose underlying is a tradable
 * index it is not. `isFnOSymbol` reads each of these as an equity, so a delivery card on one read
 * no segment's kill switch. A tradable index itself is not one, nor is an equity core lists, nor
 * a contract, which `isFnOSymbol` reads as F&O. Exchange-traded funds named from an index root
 * (NIFTYBEES, NIFTY1) are held with them: core lists none, so none can be told apart.
 */
const isIndexSpelling = (symbol: string): boolean => {
  if (
    TRADABLE_INDICES.includes(symbol) ||
    SPACED_INDEX_NAMES.has(symbol) ||
    LISTED_EQUITIES.has(symbol) ||
    isContract(symbol)
  ) {
    return false;
  }
  return (
    INDEX_ROOT.test(symbol) ||
    TRADABLE_INDICES.includes(extractUnderlyingSymbol(symbol))
  );
};

/**
 * One symbol, as a strategy trades one: a tradable index by its spaced name, or letters and digits
 * (a letter among them), no longer than `MAX_SYMBOL_LENGTH`, with an `&` or a `-` only where a
 * listed equity carries one, itself or as a contract's underlying, and a `.` only in an option's
 * strike (TATASTEEL26SEP187.5CE). Never a `_`, a space otherwise, or any other sign ("TCS.INFY",
 * "RELIANCE.NS", "NIFTY_BANKNIFTY").
 */
const isCleanSymbol = (symbol: string): boolean => {
  if (SPACED_INDEX_NAMES.has(symbol)) return true;
  if (symbol.length > MAX_SYMBOL_LENGTH) return false;
  const option = parseOptionSymbol(symbol);
  const spelling = option === null ? /^[A-Z0-9&-]+$/ : /^[A-Z0-9&.-]+$/;
  if (!spelling.test(symbol) || !/[A-Z]/.test(symbol)) return false;
  const base =
    option?.underlying ?? parseFuturesSymbol(symbol)?.underlying ?? symbol;
  return !/[&-]/.test(symbol) || LISTED_EQUITIES.has(base);
};

/**
 * Why `tickers` is not exactly one clean symbol, or null when it is:
 * - `noSymbol`: no part with anything in it (nothing, spaces, bare commas, not a string), or a
 *   placeholder ("-", "NA", "TBD", "null").
 * - `severalSymbols`: more than one part, at least two of them clean symbols.
 * - `unreadableSymbols`: a list that cannot be read: a stray comma beside one part (",HDFCBANK",
 *   "HDFCBANK,"), or several parts fewer than two of which are clean symbols ("NA, TBD",
 *   "RELIANCE, -").
 * - `indexOrBasket`: an index that is not one of the tradable ones, or a basket (`isIndexOrBasket`:
 *   "NIFTY100", "SENSEX", "NIFTY50", "CNXIT", "NSE500").
 * - `unreadableSymbol`: one part that is not one clean symbol (`isCleanSymbol`): separated some
 *   other way ("HDFCBANK ICICIBANK", "HDFCBANK;ICICIBANK", a newline), joined
 *   ("HDFCBANK&ICICIBANK", "TCS.INFY"), suffixed ("RELIANCE-EQ"), or too long. Each would go out
 *   as one symbol no runner trades, and read no segment's kill switch.
 *
 * A join of two symbols in letters alone ("TCSINFY") cannot be told from one symbol here: core's
 * equity list is what the app resolves, not all of NSE, and a contract or a new listing is not on
 * it. Such a spelling starts, and trades nothing.
 */
export type TickersHold =
  | 'noSymbol'
  | 'severalSymbols'
  | 'unreadableSymbols'
  | 'indexOrBasket'
  | 'unreadableSymbol';

/** Why one part is not one symbol a strategy trades, or null when it is. */
const partHold = (
  part: string,
): 'noSymbol' | 'indexOrBasket' | 'unreadableSymbol' | null => {
  const symbol = part.toUpperCase();
  if (PLACEHOLDERS.has(symbol)) return 'noSymbol';
  // Any NSE or BSE index outside TRADABLE_INDICES by symbol or name, a basket, or an alias.
  if (INDEX_OR_BASKET.has(symbol) || INDEX_ALIASES.has(symbol)) {
    return 'indexOrBasket';
  }
  if (!isCleanSymbol(symbol)) return 'unreadableSymbol';
  return isIndexSpelling(symbol) ? 'indexOrBasket' : null;
};

export function tickersHold(tickers: unknown): TickersHold | null {
  const parts = tickersOf(tickers);
  const named = parts.filter(part => part !== '');
  if (named.length === 0) return 'noSymbol';
  // "Several stocks" only of a list that names at least two: placeholders or junk beside one, or
  // none, are a list that cannot be read.
  if (named.length > 1) {
    const clean = named.filter(part => partHold(part) === null);
    return clean.length >= 2 ? 'severalSymbols' : 'unreadableSymbols';
  }
  const hold = partHold(named[0] ?? '');
  if (hold === 'noSymbol') return 'noSymbol';
  return parts.length > 1 ? 'unreadableSymbols' : hold;
}

/**
 * Whether `symbol` can be charted: exactly one named part, and not a placeholder or a basket. Not
 * the rule a strategy starts by (`tickersHold`): an index, a non-tradable one included, has bars,
 * and a plan without code is only looked at.
 */
export function isChartSymbol(symbol: unknown): boolean {
  const parts = tickersOf(symbol);
  const only = (parts[0] ?? '').toUpperCase();
  return (
    parts.length === 1 &&
    only !== '' &&
    !PLACEHOLDERS.has(only) &&
    !BASKETS.has(only)
  );
}

/** Whether `tickers` names exactly one clean symbol (`tickersHold` is null). */
export const isOneSymbol = (tickers: unknown): boolean =>
  tickersHold(tickers) === null;

/**
 * Why a C card cannot be started here, though it is one (`isScriptCard`):
 * - `notRunnable`: the card says the engine cannot run its code yet (`runnable: false`).
 * - any `TickersHold`: its `tickers` are not exactly one clean symbol. Every run of the card sends
 *   them as one `symbol`, which backend-go's `cardRow` makes a single symbol ("HDFCBANK,
 *   ICICIBANK") that no runner trades, and the card's one amount would be shown for what the code
 *   may buy of each; with none, a symbol read back out of its prose rows is what put unrunnable
 *   rows in the database.
 */
export type ScriptCardHold = 'notRunnable' | TickersHold;

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
  return tickersHold(terms.tickers);
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
  // Not a string (an array, a number) is no symbol, never a throw in a host's render.
  const tickers: unknown = terms.tickers;
  const symbol = (typeof tickers === 'string' ? tickers : '')
    .trim()
    .toUpperCase();
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
