import {normalizeSetupKey} from '../strategy/strategySetupConfig.ts';
import type {Watchlist, WatchlistAlertSetup} from '../types/watchlist.ts';

// drift resolved 2026-09-13: the mobile always minted the `wl_` id; the web
// prefers `crypto.randomUUID` with the same fallback, which wins because
// Hermes lacks randomUUID and the fallback is what it gets either way.
// Read through `globalThis` and typed locally: `crypto` is not in React Native's type library,
// and core must compile inside every consumer's program.
const randomUuid = (): string | null =>
  (
    globalThis as {crypto?: {randomUUID?: () => string}}
  ).crypto?.randomUUID?.() ?? null;

export const newWatchlistId = (): string =>
  randomUuid() ??
  `wl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// How people open a request. Stripped for the card's title, because "Tell me
// when Reliance breaks out" reads better on a card as "Reliance breaks out" —
// the request is addressed to us, the title is about the market.
const LEAD_INS =
  /^(please\s+)?(can you\s+)?(tell me|let me know|notify me|alert me|ping me|watch|track|follow|show me|keep an eye on|i want to know)\b[\s,]*(when|if|whenever|for|about|on)?\s*/i;

/**
 * A short title for a prompt.
 *
 * Cards need a label and prompts are sentences, so this takes the first clause
 * with the lead-in removed. Deliberately dumb — the assistant replaces it with a
 * real name once it has read the prompt, and a heuristic that tried harder would
 * just be wrong in more interesting ways.
 */
export const deriveWatchlistName = (prompt: string, maxLength = 52): string => {
  const cleaned = prompt.trim().replace(LEAD_INS, '').replace(/\s+/g, ' ');
  const firstClause =
    (cleaned.split(/[.;\n]/)[0] ?? '').trim() || prompt.trim();
  const cut = firstClause.lastIndexOf(' ', maxLength);
  const title =
    firstClause.length <= maxLength
      ? firstClause
      : `${firstClause.slice(0, cut === -1 ? maxLength : cut)}…`;
  return title.charAt(0).toUpperCase() + title.slice(1);
};

type SetupRows = {k: string; v?: string}[];

const setupRow = (rows: SetupRows, ...keys: string[]): string => {
  for (const key of keys) {
    const value = rows.find(r => normalizeSetupKey(r.k) === key)?.v;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

/** The card's Condition row as the assistant wrote it — what `readingFsm` compiles. */
export const alertCondition = (rows: SetupRows): string =>
  setupRow(rows, 'condition', 'entry_condition', 'entry');

/**
 * The assistant's reading of a watch, as the fields a card can render.
 *
 * The `submit_watchlist_alert` confirm table is the only place the instruments,
 * the condition and the timeframe exist as separate fields, so this is where a
 * watch stops being a sentence and starts being something that can be evaluated.
 * Everything here is `Watchlist`'s assistant-supplied half — the half the
 * interface documents as "absent until it has read it".
 */
export const alertReading = (
  setup: WatchlistAlertSetup,
): Pick<Watchlist, 'name' | 'summary' | 'matches'> => {
  const rows = setup.rows ?? [];
  const instruments = setupRow(rows, 'stock', 'stocks', 'tickers', 'ticker');
  const alertName = setupRow(rows, 'alert', 'alert_name', 'strategy_name');
  const condition = alertCondition(rows);
  const timeframe = setupRow(rows, 'timeframe');

  const tokens = instruments
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  // A universe ("Nifty 100") is what the watch scans, not an instrument to price.
  // It has no series of its own, so it reads as the scope in the summary rather
  // than as a match row with a permanently blank price.
  const symbols = tokens.filter(t => !/\s/.test(t));
  const scope = tokens.filter(t => /\s/.test(t)).join(', ');

  const line = [scope, condition].filter(Boolean).join(' — ');

  const reading: Pick<Watchlist, 'name' | 'summary' | 'matches'> = {
    name: alertName || deriveWatchlistName(condition || instruments),
    matches: symbols.map(symbol => ({symbol: symbol.toUpperCase()})),
  };
  if (line) reading.summary = timeframe ? `${line} (${timeframe})` : line;
  return reading;
};

/**
 * The strategy engine's structured reading of the same confirm table — the
 * host app extracts it with its strategy setup parser and passes it in, so the
 * draft can call create-backtest without re-parsing `prompt`.
 */
export interface WatchlistDraftConfig {
  symbol?: string;
  timeframe?: string;
  original_query?: string;
  fsm?: unknown;
}

/**
 * A draft watch from the assistant's reading of it.
 *
 * A draft rather than a live watch, because reading a sentence back is not the
 * same as being told to act on it: the pane's Create is where the person commits,
 * and it is the first point at which they have seen the instruments and the
 * condition side by side.
 *
 * `prompt` stays the person's own sentence when there was a prompt box to type it
 * into — the drawer quotes it verbatim, and the assistant's paraphrase is a worse
 * version of it. An alert asked for mid-conversation has no such sentence, so the
 * condition read back is the closest thing to what they asked for.
 */
export const draftFromAlert = (
  setup: WatchlistAlertSetup,
  config: WatchlistDraftConfig,
  prompt?: string,
  now: Date = new Date(),
): Watchlist => {
  const reading = alertReading(setup);
  // An empty prompt box is no prompt: the reading stands in for it.
  const typed = prompt?.trim();
  const own = typed !== undefined && typed.length > 0 ? typed : undefined;
  const draft: Watchlist = {
    id: newWatchlistId(),
    prompt: own ?? reading.summary ?? reading.name,
    status: 'draft',
    notify: true,
    created_at: now.toISOString(),
    ...reading,
  };
  if (config.symbol !== undefined) draft.symbol = config.symbol;
  if (config.timeframe !== undefined) draft.timeframe = config.timeframe;
  if (config.original_query !== undefined)
    draft.original_query = config.original_query;
  if (config.fsm !== undefined) draft.fsm = config.fsm;
  return draft;
};
