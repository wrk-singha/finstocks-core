/**
 * A custom indicator, from the assistant's card to the saved row.
 *
 * The assistant reads whatever the user brought — plain English, Pine Script, Amibroker AFL, MQL,
 * a formula, JSON — and answers with one `custom_indicator` card carrying a CustomIndicatorDraft.
 * Nothing is saved until the user presses Save on that card; the save posts the draft to
 * `/custom-indicators`, and from then on it lists under the chart picker's Custom tab.
 *
 * `draft_id` is the join between the two. The assistant stamps every revision of one indicator in
 * a thread with the same id ("make it 21 periods" keeps the id; "now build me a different one"
 * mints a new one), so saving a refinement replaces the saved row rather than piling near-copies
 * into the tab.
 */

/** What the user brought. Drives the Custom tab's tag. */
export type CustomIndicatorSourceFormat =
  | 'english'
  | 'pine'
  | 'afl'
  | 'mql'
  | 'thinkscript'
  | 'ninjascript'
  | 'easylanguage'
  | 'python'
  | 'json'
  | 'formula'
  | 'other';

export interface CustomIndicatorInput {
  id: string;
  label: string;
  type: 'integer' | 'float' | 'source' | 'bool';
  default: number | string | boolean;
  min?: number;
  max?: number;
}

export interface CustomIndicatorPlot {
  id: string;
  label: string;
  /** A mark_* plot is a condition: the chart marks the bars where it holds and nothing else. */
  style: 'line' | 'histogram' | 'area' | 'dots' | 'mark_below' | 'mark_above';
  /** Hex. Absent = the chart's palette picks one. */
  color?: string;
}

/** A horizontal reference line in the indicator's pane, like RSI's 70 and 30. */
export interface CustomIndicatorLevel {
  value: number;
  label?: string;
}

/** Something in the source that did not carry over, said plainly. */
export interface CustomIndicatorSkip {
  /** The construct, as the user would recognise it: "alertcondition()". */
  what: string;
  /** One short reason: "Alerts aren't supported on custom indicators yet". */
  why: string;
}

/**
 * Everything needed to draw it, stored verbatim by the backend.
 *
 * `spec` is the executable definition. Its grammar is owned by the chart renderer and the LLM
 * service that writes it; the apps never look inside, and the backend stores it without reading it.
 */
export interface CustomIndicatorDefinition {
  /** "overlay" draws on the price pane; "separate" gets a pane of its own. */
  pane: 'overlay' | 'separate';
  inputs: CustomIndicatorInput[];
  plots: CustomIndicatorPlot[];
  levels?: CustomIndicatorLevel[];
  skipped?: CustomIndicatorSkip[];
  spec: Record<string, unknown>;
}

/** The `custom_indicator` card's payload. */
export interface CustomIndicatorDraft extends CustomIndicatorDefinition {
  draft_id: string;
  /** Chosen by the assistant. The user can rename it after saving. */
  name: string;
  /** One plain-English line: what it computes and how to read it. */
  description: string;
  source_format: CustomIndicatorSourceFormat;
  /** Finer than the format when known: "Pine Script v5", "MQL5". */
  source_label?: string;
  /**
   * ready    — converted in full.
   * partial  — converted, with `skipped` naming what did not carry over.
   * failed   — nothing usable; `error` says why and the card offers a retry.
   */
  status: 'ready' | 'partial' | 'failed';
  error?: string;
}

/** A saved row, as `/custom-indicators` returns it. */
export interface CustomIndicator {
  id: string;
  draft_id: string;
  name: string;
  description: string;
  source_format: CustomIndicatorSourceFormat;
  source_label: string;
  definition: CustomIndicatorDefinition;
  chat_id: string;
  created_at: string;
  updated_at: string;
}

/** A saved row the chart's picker should open on and point at. */
export interface CustomIndicatorFocus {
  id: string;
  /** First save ever: open with the guided highlight. */
  intro: boolean;
}

export interface SaveCustomIndicatorRequest {
  draft_id: string;
  name: string;
  description: string;
  source_format: CustomIndicatorSourceFormat;
  source_label?: string;
  definition: CustomIndicatorDefinition;
  chat_id?: string;
}

export interface RenameCustomIndicatorRequest {
  id: string;
  name: string;
}
