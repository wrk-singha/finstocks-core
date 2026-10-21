// What both apps derive from a regime row beside its chip: the words, the tone, the clock, the
// signed figures, the breadth counts and the watchlist key. Web keeps these in
// utils/market/regimePulse.ts and utils/market/regimeWatch.ts.
import {BSE_INDICES, NSE_INDICES} from '../data/stocksData.ts';
import {formatNumber} from '../format/number.ts';
import type {
  Regime,
  RegimeDecayRow,
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

/** A figure at the bar it was set on, as the session tiles print it. */
export type SessionMark = {readonly value: number; readonly at: string};

/** The session's open, high, low and last spot with when each was set, and the net change. */
export type SessionOverview = {
  readonly open: SessionMark;
  readonly high: SessionMark;
  readonly low: SessionMark;
  readonly close: SessionMark;
  readonly change: number;
  readonly changePct: number;
};

/** Web's sessionOverview: the first bar to set a high or a low keeps it; null with no bars. */
export function sessionOverview(
  rows: readonly {ts: string; spot: number}[],
): SessionOverview | null {
  const open = rows[0];
  const close = rows.at(-1);
  if (open === undefined || close === undefined) return null;
  let high = open;
  let low = open;
  for (const r of rows) {
    if (r.spot > high.spot) high = r;
    if (r.spot < low.spot) low = r;
  }
  const change = close.spot - open.spot;
  return {
    open: {value: open.spot, at: clockOf(open.ts)},
    high: {value: high.spot, at: clockOf(high.ts)},
    low: {value: low.spot, at: clockOf(low.ts)},
    close: {value: close.spot, at: clockOf(close.ts)},
    change,
    changePct: open.spot ? (change / open.spot) * 100 : 0,
  };
}

const MIN_CHART_POINTS = 2;

/** A session draws its charts and tiles from two bars on; one bar is a point, not a line. */
export const canChart = (rows: readonly unknown[]): boolean =>
  rows.length >= MIN_CHART_POINTS;

/**
 * The tracked contracts at the newest engine cycle, as the decay-gap table lists them: calls
 * before puts, each by strike.
 */
export function latestDecay(rows: readonly RegimeDecayRow[]): RegimeDecayRow[] {
  const ts = rows.at(-1)?.ts;
  if (ts === undefined) return [];
  return rows
    .filter(r => r.ts === ts)
    .sort((a, b) =>
      a.option_type === b.option_type
        ? a.strike - b.strike
        : a.option_type === 'CE'
          ? -1
          : 1,
    );
}

/** A chart's vertical extent. */
export type ChartExtent = {readonly min: number; readonly max: number};

// Web's chartFrame: the extent is widened by this share of its span at each end.
const CHART_PAD = 0.06;

/**
 * Web's makeScale extent: the finite values with any `include` (a zero line) in them, a flat run
 * opened to ±1, then widened 6% each way. No values reads as 0–1.
 */
export function chartExtent(
  values: readonly number[],
  include: readonly number[] = [],
): ChartExtent {
  const pool = [...values.filter(Number.isFinite), ...include];
  let min = pool.length ? Math.min(...pool) : 0;
  let max = pool.length ? Math.max(...pool) : 1;
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * CHART_PAD;
  return {min: min - pad, max: max + pad};
}

/** Where web's frame labels its value axis: a tenth in from each end, and the middle. */
export const chartTicks = ({min, max}: ChartExtent): number[] => [
  min + (max - min) * 0.1,
  (min + max) / 2,
  max - (max - min) * 0.1,
];

/**
 * The bars web's frame names under the plot: the first, the quarters and the last, each once — a
 * short session puts two quarters on one bar.
 */
export const chartXTicks = (n: number): number[] =>
  n > 1
    ? [
        ...new Set([
          0,
          Math.floor((n - 1) / 4),
          Math.floor((n - 1) / 2),
          Math.floor(((n - 1) * 3) / 4),
          n - 1,
        ]),
      ]
    : [0];

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
