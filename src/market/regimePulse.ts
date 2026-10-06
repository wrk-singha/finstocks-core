// What both apps derive from a regime row beside its chip: the words, the tone, the clock, the
// signed figures, the breadth counts and the watchlist key. Web keeps these in
// utils/market/regimePulse.ts and utils/market/regimeWatch.ts.
import {BSE_INDICES, NSE_INDICES} from '../data/stocksData.ts';
import {formatNumber} from '../format/number.ts';
import type {
  Regime,
  RegimeRow,
  RegimeSentimentRow,
} from '../types/regimePulse.ts';
import {extractUnderlyingSymbol} from './symbols.ts';

export const REGIME_ORDER: readonly Regime[] = [
  'BULLISH',
  'NEUTRAL-TO-BULLISH',
  'RANGEBOUND',
  'NEUTRAL-TO-BEARISH',
  'BEARISH',
];

export const REGIME_SHORT: Readonly<Record<Regime, string>> = {
  BULLISH: 'Bullish',
  'NEUTRAL-TO-BULLISH': 'Nt-bull',
  RANGEBOUND: 'Range',
  'NEUTRAL-TO-BEARISH': 'Nt-bear',
  BEARISH: 'Bearish',
  WARMING_UP: 'Warming up',
};

export const REGIME_LABEL: Readonly<Record<Regime, string>> = {
  BULLISH: 'Bullish',
  'NEUTRAL-TO-BULLISH': 'Neutral to bullish',
  RANGEBOUND: 'Rangebound',
  'NEUTRAL-TO-BEARISH': 'Neutral to bearish',
  BEARISH: 'Bearish',
  WARMING_UP: 'Warming up',
};

export const REGIME_READING: Readonly<Record<Regime, string>> = {
  BULLISH: 'Options are leaning strongly up, and the lean keeps building.',
  'NEUTRAL-TO-BULLISH': 'A mild upward lean in options, not yet a trend.',
  RANGEBOUND: 'Options expect the price to stay in a range.',
  'NEUTRAL-TO-BEARISH': 'A mild downward lean in options, not yet a trend.',
  BEARISH: 'Options are leaning strongly down, and the lean keeps building.',
  WARMING_UP: 'Collecting enough readings since the open to score the session.',
};

/** Which way a regime leans, for its colour; `warming` has no lean yet. */
export type RegimeLean = 'bullish' | 'bearish' | 'neutral' | 'warming';

/**
 * The lean and how firmly it is held: web paints the two strong regimes at full colour and the two
 * neutral-to ones at 45% (dot) / half the chip tint, rangebound grey and warming-up fainter still.
 */
export type RegimeTone = {
  readonly lean: RegimeLean;
  readonly strength: 'strong' | 'mild';
};

const REGIME_TONE: Readonly<Record<Regime, RegimeTone>> = {
  BULLISH: {lean: 'bullish', strength: 'strong'},
  'NEUTRAL-TO-BULLISH': {lean: 'bullish', strength: 'mild'},
  RANGEBOUND: {lean: 'neutral', strength: 'mild'},
  'NEUTRAL-TO-BEARISH': {lean: 'bearish', strength: 'mild'},
  BEARISH: {lean: 'bearish', strength: 'strong'},
  WARMING_UP: {lean: 'warming', strength: 'mild'},
};

export const regimeTone = (regime: Regime): RegimeTone => REGIME_TONE[regime];

export const isBullish = (r: Regime): boolean =>
  r === 'BULLISH' || r === 'NEUTRAL-TO-BULLISH';
export const isBearish = (r: Regime): boolean =>
  r === 'BEARISH' || r === 'NEUTRAL-TO-BEARISH';

/** The regime whose colour a bias figure takes, at web's thresholds. */
export function zBiasRegime(z: number): Regime {
  if (z >= 2) return 'BULLISH';
  if (z >= 0.5) return 'NEUTRAL-TO-BULLISH';
  if (z > -0.5) return 'RANGEBOUND';
  if (z > -2) return 'NEUTRAL-TO-BEARISH';
  return 'BEARISH';
}

/** "14:32" (or "14:32:20") out of "2026-09-28 14:32:20", an ISO timestamp or a bare "14:32:20". */
export const clockOf = (
  ts: string | null | undefined,
  seconds = false,
): string => {
  if (!ts) return '';
  const time = ts.split(/[ T]/)[1] ?? ts;
  return time.slice(0, seconds ? 8 : 5);
};

export const fractionPct = (
  fraction: number | null | undefined,
  digits = 1,
): string =>
  fraction == null || !Number.isFinite(fraction) || fraction === 0
    ? '—'
    : `${(fraction * 100).toFixed(digits)}%`;

/** A value that rounds to zero at `digits` carries no sign. */
export const signed = (v: number | null | undefined, digits = 2): string => {
  if (v == null || !Number.isFinite(v)) return '—';
  const text = formatNumber(Math.abs(v), digits);
  const sign = Math.sign(Number(v.toFixed(digits)));
  return sign > 0 ? `+${text}` : sign < 0 ? `−${text}` : text;
};

/** Unlike `signed`: no digit grouping, and zero keeps its "+". */
export const signedFixed = (v: number, digits: number): string =>
  `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`;

export const ivPointsOf = (
  fractionPoints: number | null | undefined,
): string => (fractionPoints ? `${signed(fractionPoints * 100)} pts` : '—');

export const breadthCounts = (
  b: RegimeSentimentRow | null | undefined,
): Readonly<Record<Regime, number>> | null =>
  b
    ? {
        BULLISH: b.bullish,
        'NEUTRAL-TO-BULLISH': b.nt_bullish,
        RANGEBOUND: b.rangebound,
        'NEUTRAL-TO-BEARISH': b.nt_bearish,
        BEARISH: b.bearish,
        WARMING_UP: 0,
      }
    : null;

export function regimeDistribution(
  rows: readonly {regime: Regime}[],
): {regime: Regime; count: number; pct: number}[] {
  const total = rows.length || 1;
  return REGIME_ORDER.map(regime => {
    const count = rows.filter(r => r.regime === regime).length;
    return {regime, count, pct: Math.round((count / total) * 100)};
  });
}

/** A row that has scored the session; a warming-up row has no regime to show yet. */
export const hasRegime = (row: RegimeRow | undefined): row is RegimeRow =>
  !!row && row.regime !== 'WARMING_UP';

/** The snapshot's rows keyed by underlying, the shape every chip reads. */
export const regimeMap = (
  rows: readonly RegimeRow[] | undefined,
): Readonly<Record<string, RegimeRow>> =>
  Object.fromEntries((rows ?? []).map(r => [r.underlying, r]));

// Watchlists carry broker spellings and index display names; the engine keys by F&O underlying.
// Web's index listings carry these aliases (data/stocks/indices.ts); core's lists do not yet.
const INDEX_ALIASES: readonly (readonly [alias: string, symbol: string])[] = [
  ['NIFTY50', 'NIFTY'],
  ['NIFTYMIDSELECT', 'MIDCPNIFTY'],
  ['NIFTY MID SELECT', 'MIDCPNIFTY'],
  ['NIFTYFINANCE', 'FINNIFTY'],
  ['NIFTY FIN SERVICE', 'FINNIFTY'],
];

const INDEX_BY_NAME = new Map<string, string>([
  ...[...NSE_INDICES, ...BSE_INDICES].map(
    index => [index.name.toUpperCase(), index.symbol] as const,
  ),
  ...INDEX_ALIASES,
]);

/** The engine's key for a watchlist symbol: "NSE:NIFTY 50", "NIFTY50" and "NIFTY BANK" → NIFTY / NIFTY / BANKNIFTY. */
export const regimeKey = (symbol: string): string => {
  const bare = (symbol.split(':').pop() ?? '').trim().toUpperCase();
  return INDEX_BY_NAME.get(bare) ?? extractUnderlyingSymbol(bare);
};

/** The live regime row for a watchlist symbol, or undefined when it has no F&O regime yet. */
export const regimeRowFor = (
  map: Readonly<Record<string, RegimeRow>>,
  symbol: string,
): RegimeRow | undefined => {
  const row = map[regimeKey(symbol)];
  return hasRegime(row) ? row : undefined;
};

/**
 * Which reading a card shows (web 993b2ca1): the live one while the market is open on the row's
 * own trading day, else the day's close.
 */
export type RegimeStamp =
  | {readonly kind: 'live'; readonly at: string}
  | {readonly kind: 'close'; readonly date: string; readonly at: string};

export const regimeStamp = (
  row: Pick<RegimeRow, 'ts' | 'trade_date'>,
  isMarketOpen: boolean,
  today: string,
): RegimeStamp =>
  isMarketOpen && row.trade_date === today
    ? {kind: 'live', at: clockOf(row.ts)}
    : {kind: 'close', date: row.trade_date, at: clockOf(row.ts)};

/**
 * The regime an answer was written against, when the live row has since moved off it; undefined
 * while they agree or when the answer named no regime the chip knows.
 */
export const regimeChangedSince = (
  answered: string | undefined,
  row: Pick<RegimeRow, 'regime'>,
): Regime | undefined =>
  answered !== undefined &&
  answered !== row.regime &&
  Object.hasOwn(REGIME_LABEL, answered)
    ? (answered as Regime)
    : undefined;
