import type {AlertCondition} from '../market/alertRule.ts';

/** One instrument a watch resolved to, or one that matched it. */
export interface AlertMatch {
  symbol: string;
  name?: string;
  /** Why it matched, in words. */
  note?: string;
  triggered_at?: string | null;
}

/**
 * An alert is a saved prompt.
 *
 * Not a form. Nobody thinks "kind: condition, universe: NIFTY 500, rsi_max: 40"
 * — they think "tell me when a Nifty 100 stock crosses above its 50 EMA". The
 * sentence is the definition of the watch, and the assistant is what turns it
 * into something that can be evaluated and delivered. Everything below `prompt`
 * is the assistant's reading of it, and is absent until it has read it.
 *
 * Not a stock watchlist: "watchlist" names the lists of instruments a person
 * follows, and these are shown to people as Alerts.
 */
export interface SavedAlert {
  id: string;
  /** What the person typed. The watch, in their words. */
  prompt: string;
  /** Short label for the card, derived from the prompt until the assistant
   *  names it properly. */
  name: string;
  /** A draft is a reading the person has seen but not committed to; active is a
   *  live watch. Drafts carry a summary and matches — they are what the pane
   *  shows you before you press Create, not a placeholder. */
  status: 'draft' | 'active';
  notify: boolean;
  created_at: string;
  /** What the assistant understood the prompt to mean, in one line. */
  summary?: string;
  /** What the watch is following, or what matches it right now. */
  matches?: AlertMatch[];
  last_triggered_at?: string | null;
  /** What it watches, as the alert's own rule states it ({var, op, val}
   *  leaves under AND/OR) — read to mark it on the chart once it fires. */
  condition?: unknown;
  /** The assistant's structured reading of the prompt — carried on the draft
   *  so pressing Create can call create-backtest without re-parsing `prompt`. */
  symbol?: string;
  timeframe?: string;
  original_query?: string;
  /** The engine's machine around the alert's condition (`monitorFsm`), carried
   *  to create-backtest unchanged: it refuses an alert without one. */
  fsm?: unknown;
}

/** The wire shape: the endpoint predates the rename and still says watchlists. */
export interface SavedAlertsResponse {
  watchlists: SavedAlert[];
}

/**
 * The assistant's reading of a watch, as the `watchlist_alert` chat card.
 *
 * Emitted by the `submit_watchlist_alert` tool: `rows` is the confirm table the
 * card renders (Stock / Alert / Condition / Timeframe), and `backend_rows` is the
 * same reading keyed the way the strategy engine names things. The card reads
 * `rows` — it is what the person is being shown and asked to confirm.
 * `condition` is the engine's own condition for it, checked against the fields
 * the engine can read before the card was sent — so setting the alert wraps
 * that in the monitor machine, never the sentence.
 */
export interface AlertSetup {
  stage?: 'confirm' | 'confirmed';
  title?: string;
  rows: {k: string; v?: string}[];
  backend_rows?: {k: string; v?: string}[];
  condition?: AlertCondition;
  ask?: string;
}
