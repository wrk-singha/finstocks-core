// What both apps derive from an option-levels row: the words for the dealer regime and the engine's
// call, the level formatting, how far a level is from spot, the reading written under the rail and
// the wall nearer the price. Web keeps these in utils/market/flyone.ts and its screen card.
import {formatNumber} from '../format/number.ts';
import type {
  FlyoneDirection,
  FlyonePattern,
  FlyoneRow,
  GexRegime,
  OiSource,
} from '../types/flyone.ts';
import type {Regime} from '../types/regimePulse.ts';
import {isBearish, isBullish, signed} from './regimePulse.ts';

export const DIRECTION_ORDER: readonly FlyoneDirection[] = [
  'BULLISH',
  'LEAN_BULLISH',
  'NEUTRAL',
  'LEAN_BEARISH',
  'BEARISH',
];

export const DIRECTION_LABEL: Readonly<Record<FlyoneDirection, string>> = {
  BULLISH: 'Bullish',
  LEAN_BULLISH: 'Leaning bullish',
  NEUTRAL: 'Neutral',
  LEAN_BEARISH: 'Leaning bearish',
  BEARISH: 'Bearish',
};

export const DIRECTION_SHORT: Readonly<Record<FlyoneDirection, string>> = {
  BULLISH: 'Bull',
  LEAN_BULLISH: 'Lean bull',
  NEUTRAL: 'Neutral',
  LEAN_BEARISH: 'Lean bear',
  BEARISH: 'Bear',
};

export const directionSide = (d: string): 1 | -1 | 0 =>
  d.includes('BULL') ? 1 : d.includes('BEAR') ? -1 : 0;

export const PATTERN_LABEL: Readonly<
  Record<Exclude<FlyonePattern, ''>, string>
> = {
  BULL_CONFIRM: 'Rally confirmed',
  BEAR_CONFIRM: 'Fall confirmed',
  BEAR_DIVERGENCE: 'Rally doubted',
  BULL_EXHAUSTION: 'Selling fading',
  BULL_LEAN: 'Fear easing',
  BEAR_LEAN: 'Fear building',
  UP_UNCONFIRMED: 'Up, unconfirmed',
  DOWN_UNCONFIRMED: 'Down, unconfirmed',
  QUIET: 'Quiet',
  INSUFFICIENT_DATA: 'Thin chain',
};

export const PATTERN_READING: Readonly<
  Record<Exclude<FlyonePattern, ''>, string>
> = {
  BULL_CONFIRM:
    'Price is rising while downside protection gets cheaper. Hedgers are unwinding, which backs the rally.',
  BEAR_CONFIRM:
    'Price is falling while downside protection gets more expensive. Hedgers are chasing the fall, which backs the move down.',
  BEAR_DIVERGENCE:
    "Price is rising, but traders are buying more downside protection into the rally. They don't trust the move up.",
  BULL_EXHAUSTION:
    'Price is falling, but downside protection is getting cheaper. Sellers are taking profit and the drop is fading.',
  BULL_LEAN:
    "Price is flat while fear eases. A mild upward lean that hasn't shown up in price yet.",
  BEAR_LEAN:
    "Price is flat while fear builds. A mild downward lean that hasn't shown up in price yet.",
  UP_UNCONFIRMED:
    "Price ticked up, but the options market hasn't reacted either way. No call yet.",
  DOWN_UNCONFIRMED:
    "Price ticked down, but the options market hasn't reacted either way. No call yet.",
  QUIET:
    'Price and fear have both held still over the last 15 minutes. No call.',
  INSUFFICIENT_DATA:
    "Too few strikes traded to read the options market's shape. No call.",
};

export const GEX_REGIME_LABEL: Readonly<
  Record<Exclude<GexRegime, ''>, string>
> = {
  STRONG_POS: 'Calm+',
  POS: 'Calm',
  NEUTRAL: 'Balanced',
  NEG: 'Fast',
  STRONG_NEG: 'Fast+',
};

export const GEX_REGIME_READING: Readonly<
  Record<Exclude<GexRegime, ''>, string>
> = {
  STRONG_POS:
    'Dealers are strongly long gamma: they sell rallies and buy dips, so moves tend to get absorbed.',
  POS: 'Dealers are long gamma: moves tend to get absorbed and price sticks near big strikes.',
  NEUTRAL:
    'Dealer hedging is roughly balanced: neither damping nor pushing moves.',
  NEG: 'Dealers are short gamma: they chase moves, so breaks can run further than usual.',
  STRONG_NEG:
    'Dealers are strongly short gamma: expect moves to accelerate once they start.',
};

export type GexTone = 'calm' | 'fast' | 'balanced';

export const gexTone = (r: GexRegime): GexTone =>
  r === 'POS' || r === 'STRONG_POS'
    ? 'calm'
    : r === 'NEG' || r === 'STRONG_NEG'
      ? 'fast'
      : 'balanced';

export const OI_NOTE: Readonly<Record<OiSource, string>> = {
  today: '',
  mixed: "Some strikes' open interest is from the previous session.",
  previous:
    "Open interest is from the previous session; today's feed has none yet.",
  none: "No open interest yet, so dealer levels can't be drawn.",
};

/**
 * The latest raw reading when it differs from the confirmed call. The engine switches the call
 * only after two identical raw readings in a row, so a +2 score can sit beside a "Lean bear" call
 * for a minute; this names where it is heading.
 */
export const pendingDirection = (
  row: Pick<FlyoneRow, 'direction' | 'direction_raw'>,
): FlyoneDirection | null =>
  row.direction_raw !== '' &&
  row.direction_raw !== 'WARMUP' &&
  row.direction_raw !== row.direction
    ? row.direction_raw
    : null;

/**
 * Stock chains are often too thin for the wider wings: on 28 Sep 2026, 148 of 207 stock chains
 * had two or fewer usable widths. A call from one or two wings is weaker than one from five.
 */
export const THIN_WIDTHS = 2;
export const isThin = (
  row: Pick<FlyoneRow, 'n_valid_widths' | 'direction_raw'>,
): boolean =>
  row.direction_raw !== 'WARMUP' && row.n_valid_widths <= THIN_WIDTHS;

export const isWarmingUp = (row: Pick<FlyoneRow, 'direction_raw'>): boolean =>
  row.direction_raw === 'WARMUP';

/** Decimals a level needs: none for strikes 10 apart or more, one for 2.5-step stocks. */
export const levelOf = (
  value: number | null | undefined,
  step?: number | null,
): string =>
  value == null ? '—' : formatNumber(value, step != null && step < 5 ? 1 : 0);

/** How far `to` sits from `from`, in percent of `from`; null without both. */
export const pctAway = (
  from: number | null | undefined,
  to: number | null | undefined,
): number | null => (from && to ? ((to - from) / from) * 100 : null);

/** "50:+1|100:-2" → [{ width: 50, score: 1 }, { width: 100, score: -2 }]. */
export const parseWidthVotes = (
  raw: string,
): {width: number; score: number}[] =>
  raw
    ? raw.split('|').flatMap(part => {
        const [w, s] = part.split(':');
        const width = Number(w);
        const score = Number(s);
        return Number.isFinite(width) && Number.isFinite(score)
          ? [{width, score}]
          : [];
      })
    : [];

/** The sentence under the rail: where spot sits against the walls and the gamma flip. */
export function levelsReading(row: FlyoneRow): string {
  const {spot, put_wall: pw, call_wall: cw, gamma_flip: flip, step} = row;
  if (spot == null || (pw == null && cw == null))
    return (
      OI_NOTE[row.oi_source] ||
      'Dealer levels appear once options have open interest.'
    );
  const parts: string[] = [];
  if (pw != null && pw === cw) {
    parts.push(
      `Both walls sit at ${levelOf(cw, step)}, so price is likely to be pinned near it.`,
    );
  } else if (pw != null && cw != null && pw < spot && spot < cw) {
    parts.push(
      `Spot ${levelOf(spot, step)} sits between support at ${levelOf(pw, step)} and resistance at ${levelOf(cw, step)}.`,
    );
  } else if (cw != null && spot >= cw) {
    parts.push(
      `Spot ${levelOf(spot, step)} is at or above the call wall (${levelOf(cw, step)}), the level dealers usually defend.`,
    );
  } else if (pw != null && spot <= pw) {
    parts.push(
      `Spot ${levelOf(spot, step)} is at or below the put wall (${levelOf(pw, step)}), the usual support.`,
    );
  }
  if (flip != null) {
    parts.push(
      spot > flip
        ? `Above the gamma flip (${levelOf(flip, step)}), dealer hedging damps moves.`
        : `Below the gamma flip (${levelOf(flip, step)}), dealer hedging can speed moves up.`,
    );
  }
  return parts.join(' ');
}

/**
 * Which side of spot a wall is on, which is what it is called (web c338cfa2): a call wall above
 * spot is resistance and a put wall below it support; one on the wrong side keeps its own name.
 */
export type WallSide = 'resistance' | 'support' | 'wall';

export const callWallSide = (
  spot: number | null | undefined,
  callWall: number | null | undefined,
): WallSide => {
  const away = pctAway(spot, callWall);
  return away != null && away > 0 ? 'resistance' : 'wall';
};

export const putWallSide = (
  spot: number | null | undefined,
  putWall: number | null | undefined,
): WallSide => {
  const away = pctAway(spot, putWall);
  return away != null && away < 0 ? 'support' : 'wall';
};

/** The wall nearer the price and how far it is, or null when neither wall is drawn. */
export const nearestWall = (
  row: Pick<FlyoneRow, 'spot' | 'put_wall' | 'call_wall'>,
): {wall: 'put' | 'call'; pct: number} | null => {
  const walls = [
    {wall: 'put' as const, pct: pctAway(row.spot, row.put_wall)},
    {wall: 'call' as const, pct: pctAway(row.spot, row.call_wall)},
  ].filter((w): w is {wall: 'put' | 'call'; pct: number} => w.pct != null);
  if (walls.length === 0) return null;
  return walls.reduce((a, b) => (Math.abs(b.pct) < Math.abs(a.pct) ? b : a));
};

/** Web's row text for the nearest wall: "put −0.4%", or "—" with no wall. */
export const nearestWallText = (
  row: Pick<FlyoneRow, 'spot' | 'put_wall' | 'call_wall'>,
): string => {
  const near = nearestWall(row);
  return near === null ? '—' : `${near.wall} ${signed(near.pct, 1)}%`;
};

/** The regime wins where the two disagree; this only flags it. */
export const disagreesWithRegime = (
  direction: FlyoneDirection,
  regime: Regime | undefined,
): boolean => {
  if (regime === undefined) return false;
  const side = directionSide(direction);
  return (side > 0 && isBearish(regime)) || (side < 0 && isBullish(regime));
};
