/** The stock screener: what it can filter on, and what a run returns. */

export type ScreenUnit =
  | 'crore'
  | 'rupees'
  | 'pct'
  | 'x'
  | 'days'
  | 'count'
  | 'score'
  | 'shares'
  | 'ratio'
  | 'bars'
  | '';

/** number: a range. flag: yes/no. pattern: how many bars ago it last formed. */
export type ScreenFieldKind = 'number' | 'flag' | 'pattern';

export interface ScreenPreset {
  label: string;
  min?: number;
  max?: number;
}

export interface ScreenField {
  id: string;
  label: string;
  header: string;
  unit: ScreenUnit;
  kind: ScreenFieldKind;
  category: string;
  /** Fields measuring one thing over different periods share this. */
  family?: string;
  family_label?: string;
  /** A pattern's claim: reversal or continuation. */
  tag?: string;
  period?: string;
  /** Which way is favourable: 1 higher, -1 lower, 0 neither. */
  better: -1 | 0 | 1;
  popular?: boolean;
  /** Reads bars, so it carries a timeframe. */
  technical?: boolean;
  /** The timeframes it can be read at, when it cannot be read at all of them —
   *  a 200-period figure has no weekly reading on the history we hold. */
  timeframes?: string[];
  description?: string;
  aliases?: string[];
  presets?: ScreenPreset[];
}

export interface ScreenCatalog {
  categories: {id: string; label: string}[];
  fields: ScreenField[];
  universes: ScreenUniverse[];
  timeframes: string[];
}

export interface ScreenUniverse {
  id: string;
  label: string;
  group: string;
  description?: string;
  count: number;
}

/**
 * One condition. The bounds may be `undefined` rather than absent: an editor
 * clears a bound by setting it so, and the wire (JSON) drops it either way.
 */
export interface ScreenFilter {
  /** A field id, with a timeframe for technicals: `rsi14@15m`. */
  field: string;
  min?: number | undefined;
  max?: number | undefined;
  flag?: boolean | undefined;
  op?: 'gt' | 'lt' | undefined;
  /** Another field to compare against, instead of a number. */
  ref?: string | undefined;
  factor?: number | undefined;
}

export interface ScreenRequest {
  universes?: string[];
  symbols?: string[];
  industries?: string[];
  filters?: ScreenFilter[];
  columns?: string[];
}

export interface ScreenRow {
  symbol: string;
  ticker: string;
  name: string;
  industry: string;
  /** Keyed by column id; a figure the company has no value for is absent. */
  values: Record<string, number | undefined>;
}

export interface ScreenResult {
  total: number;
  /** Companies the filters were run over. */
  scanned: number;
  rows: ScreenRow[];
  columns: string[];
  as_of?: string;
  /** A source that could not be read; its fields are missing, not zero. */
  warnings?: string[];
}
