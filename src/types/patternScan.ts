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
  bars: number;
  meaning: string;
  from_epoch: number;
  to_epoch: number;
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
