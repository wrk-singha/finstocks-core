/** One instrument a watch resolved to, or one that matched it. */
export interface WatchlistMatch {
  symbol: string;
  name?: string;
  /** Why it matched, in words. */
  note?: string;
  triggered_at?: string | null;
}

/**
 * A watchlist is a saved prompt.
 *
 * Not a form. Nobody thinks "kind: condition, universe: NIFTY 500, rsi_max: 40"
 * — they think "tell me when a Nifty 100 stock crosses above its 50 EMA". The
 * sentence is the definition of the watch, and the assistant is what turns it
 * into something that can be evaluated and delivered. Everything below `prompt`
 * is the assistant's reading of it, and is absent until it has read it.
 */
export interface Watchlist {
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
  matches?: WatchlistMatch[];
  last_triggered_at?: string | null;
  /** The assistant's structured reading of the prompt — carried on the draft
   *  so pressing Create can call create-backtest without re-parsing `prompt`. */
  symbol?: string;
  timeframe?: string;
  original_query?: string;
}

export interface WatchlistsResponse {
  watchlists: Watchlist[];
}

/**
 * The assistant's reading of a watch, as the `watchlist_alert` chat card.
 *
 * Emitted by the `submit_watchlist_alert` tool: `rows` is the confirm table the
 * card renders (Stock / Alert / Condition / Timeframe), and `backend_rows` is the
 * same reading keyed the way the strategy engine names things. The card reads
 * `rows` — it is what the person is being shown and asked to confirm.
 */
export interface WatchlistAlertSetup {
  stage?: 'confirm' | 'confirmed';
  title?: string;
  rows: {k: string; v?: string}[];
  backend_rows?: {k: string; v?: string}[];
  ask?: string;
}
