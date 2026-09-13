/**
 * Example asks for the screening assistant.
 *
 * This file used to also carry SCREEN_PRESETS — six "screens with a record",
 * with hardcoded return/hit-rate/drawdown numbers behind a sample badge. Web
 * deleted its copy (frontend 4c993e86): two competing preset concepts on one
 * page is worse than either alone, and the records were placeholder until the
 * screen backtests are wired. The app followed. The prompts below survived
 * because they aren't a second preset system — they seed the assistant sheet,
 * which is where a screen now gets described in words.
 */

/** Example asks, shown so people learn the field takes intent rather than tickers. */
export const SCREEN_EXAMPLES = [
  "Quality midcaps that aren't expensive",
  'Stocks near 52-week highs with rising volume',
  'Something uncorrelated to what I already own',
];
