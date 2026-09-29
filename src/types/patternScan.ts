export interface PatternScanParams {
  symbol: string;
  interval: string;
  from_epoch: number;
  to_epoch: number;
  limit?: number;
  patterns?: string[];
  /** "fno" narrows the peer scan to F&O-tradable underlyings. */
  segment?: string;
}

/** One pattern occurrence inside the drawn box. `from_epoch`/`to_epoch` are the
 *  WHOLE formation, not just its completion candle — a two-candle engulfing
 *  spans both, and banding only the second reads as a claim about that candle. */
export interface PatternScanRangeHit {
  pattern: string;
  label: string;
  direction: string | null;
  /** The bullish/bearish lean. Not the same field as `direction`, which only
   *  the split ids (bullish_pin_bar and friends) carry — colour on this, or a
   *  hammer renders neutral despite being a bullish reversal. */
  sense: string;
  /** "reversal" | "continuation" | "". A reversal is a claim about what
   *  happens next, which is why those are the patterns the scan bands by
   *  default. */
  kind: string;
  /** What the pattern IS, where `kind` is what it claims happens next. A
   *  hammer and a head-and-shoulders are both reversals and differ here. */
  family: PatternFamily;
  bars: number;
  meaning: string;
  from_epoch: number;
  to_epoch: number;
  /** The swing points a chart pattern is drawn through, in time order. Absent
   *  on a candlestick, whose shape IS the candles the span already covers. */
  points?: FormationPoint[];
  /** "breakout" | "breakdown" | absent while price is still inside the shape. */
  state?: string;
}

/** Which of the two things a reader means by "pattern". */
export type PatternFamily = 'candlestick' | 'chart';

/** One swing a formation is drawn through. `kind` distinguishes the head from
 *  the neckline without re-deriving the shape. */
export interface FormationPoint {
  epoch: number;
  price: number;
  kind: 'high' | 'low';
}

/** One pattern the scanner can answer, whether or not it is in any result.
 *  The catalogue a picker offers, as opposed to what a given box contained. */
export interface PatternVocabEntry {
  id: string;
  label: string;
  sense: string;
  kind: string;
  family: PatternFamily;
  bars: number;
  meaning: string;
  aliases: string[];
}

/** GET /market/patterns: the registry compiled into the backend, the same for every symbol. */
export interface PatternVocabResponse {
  patterns: PatternVocabEntry[];
}

export interface PatternScanMatch {
  symbol: string;
  patterns: string[];
  /** Parallel to `patterns`: `senses[i]` is the lean of `patterns[i]`. */
  senses: string[];
  price: number | null;
  change_pct: number | null;
}

export interface PatternScanResponse {
  symbol: string;
  /** The BOX's right edge — it describes `in_range`, not `matches`. */
  as_of: string | null;
  /** The universe bar `matches` were detected on. Null when no scan ran.
   *  Distinct from `as_of` on purpose: a box drawn two months back has an
   *  `as_of` two months old while its matches are from today's bar, and
   *  labelling the results list with `as_of` would date them wrongly. */
  scanned_as_of: string | null;
  in_range: PatternScanRangeHit[];
  matches: PatternScanMatch[];
  scanned_symbols: number;
  /** Which universe `matches` came from — "fno" or "equity". */
  scanned_scope?: string;
  /** Names with no detector. Never render these as "not found" — nothing looked. */
  unknown: string[];
}

/**
 * One candle as the chart drew it, for POST /market/pattern-detect. Short keys because a week of
 * minute bars is thousands of rows. Web calls these the PatternDetect types; here they are named
 * for the view, because core's PatternDetect types are the older /news/pattern-detect below.
 */
export interface ViewPatternBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

/** Patterns detected on the chart's own candles, at its own resolution. */
export interface ViewPatternParams {
  interval: string;
  bars: ViewPatternBar[];
  /** The time range on screen, epoch seconds. */
  view_from: number;
  view_to: number;
  patterns?: string[];
}

/** One pattern found somewhere in the supplied candles. */
export interface ViewPatternSummary {
  pattern: string;
  /** Distinct occurrences on screen: a run of consecutive candles counts once,
   *  and a formation reported at every swing it advanced over counts once. */
  in_view: number;
  total: number;
  /** The nearest occurrence either side of the view. */
  before?: PatternScanRangeHit;
  after?: PatternScanRangeHit;
}

export interface ViewPatternResponse {
  interval: string;
  bars: number;
  from_epoch: number;
  to_epoch: number;
  view_from: number;
  view_to: number;
  /** Every occurrence on screen, with its geometry. `meaning` is blank — the
   *  vocabulary carries it once per pattern. */
  in_view: PatternScanRangeHit[];
  summary: ViewPatternSummary[];
  unknown: string[];
}

/** POST /news/pattern-detect request (web interfaces/patternDetect). */
export interface PatternDetectParams {
  symbol: string;
  interval: string;
  lookback_bars?: number;
  patterns?: string[];
}

export interface PatternDetectHit {
  bars_ago: number;
  direction: string | null;
  canonical: string;
}

/**
 * `absent` means the pattern did not occur; `unknown` means no canonical
 * detector exists for that name. Collapsing them would render a confident
 * "not present" for a pattern nothing ever looked for.
 */
export interface PatternDetectResponse {
  symbol: string;
  as_of: string | null;
  bars: number;
  detected: Record<string, PatternDetectHit>;
  absent: string[];
  unknown: string[];
}
