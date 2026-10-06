// What the options direction panel works out before it draws: which implied distribution to show
// and over what range, the gamma bars around spot, and the session timeline's ticks. Web keeps this
// maths inside its DensityChart, GexBars and DirectionTimeline components; here it is pure, in
// chart units (strikes and odds, strikes and gamma, readings), and each app maps it to its pixels.
import type {
  FlyoneCurvePayload,
  FlyoneDetailExpiry,
  FlyoneRow,
} from '../types/flyone.ts';

/** A point on the implied distribution: a strike and its share of the odds. */
export type DensityPoint = readonly [strike: number, odds: number];

type DensitySeries = {
  readonly body: readonly number[];
  readonly density: readonly (number | null)[];
};

/** Fewer bodies than this draw no curve: the distribution waits for more strikes to trade. */
export const MIN_DENSITY_BODIES = 3;

/** How far either side of spot the distribution is drawn, in expected moves (σ). */
export const DENSITY_SIGMAS = 3.5;

/** How far either side of spot the gamma bars reach, in expected moves (σ). */
export const GEX_SIGMAS = 2.5;

/** The wing widths the curve was priced at, in the engine's order. */
export const densityWidths = (
  payload: FlyoneCurvePayload | null | undefined,
): number[] => (payload?.density ?? []).map(d => d.width);

/**
 * The width a chart shows: the one picked while the curve still has it, otherwise the middle one
 * (the wider wings are the steadier readers). Undefined with no widths at all.
 */
export const shownDensityWidth = (
  widths: readonly number[],
  chosen: number | null | undefined,
): number | undefined =>
  chosen != null && widths.includes(chosen)
    ? chosen
    : widths[Math.floor(widths.length / 2)];

/**
 * Area-normalised: each body's share of the positive mass, so a width whose flies sum to more mass
 * doesn't just look taller. A negative or missing figure (the engine writes a non-finite one as
 * null) counts as none; a curve with no mass at all comes back as it was, with nulls as zero.
 */
export function normaliseDensity(series: DensitySeries): DensityPoint[] {
  const mass = series.body.map((_, i) => {
    const v = series.density[i];
    return v != null && Number.isFinite(v) ? Math.max(v, 0) : 0;
  });
  const total = mass.reduce((a, b) => a + b, 0);
  return series.body.map((k, i) => [
    k,
    total > 0 ? (mass[i] ?? 0) / total : (mass[i] ?? 0),
  ]);
}

export type DensityView = {
  /** The width drawn, and every width the curve has (the chart's picker). */
  readonly width: number;
  readonly widths: readonly number[];
  /** The latest curve inside the range, oldest strike first. */
  readonly now: readonly DensityPoint[];
  /** The lookback curve at the same width inside the range; empty when there is none to compare. */
  readonly before: readonly DensityPoint[];
  readonly lo: number;
  readonly hi: number;
  /** Spot, or the forward, or the middle body when the minute had neither. */
  readonly spot: number;
  /** One expected move in points, or a sixth of the bodies' span without one. */
  readonly sigma: number;
  /** The top of the odds axis: the tallest point of either curve, plus a tenth. */
  readonly ymax: number;
  /** The gridlines, 1σ apart from spot, that fall inside the range. */
  readonly ticks: readonly number[];
};

const seriesAt = (
  payload: FlyoneCurvePayload | null | undefined,
  width: number,
): DensitySeries | null =>
  payload?.density.find(d => d.width === width) ?? null;

/**
 * The implied distribution as web's DensityChart draws it: the latest curve and the lookback's at
 * one width, both area-normalised, over spot ± 3.5σ (beyond that the far flies sit on the 0.05 tick
 * and add noise, not shape). Null while the width has too few bodies to draw.
 */
export function densityView(
  now: FlyoneCurvePayload | null | undefined,
  before: FlyoneCurvePayload | null | undefined,
  chosen?: number | null,
): DensityView | null {
  const widths = densityWidths(now);
  const width = shownDensityWidth(widths, chosen);
  if (now == null || width === undefined) return null;
  const a = seriesAt(now, width);
  if (a === null || a.body.length < MIN_DENSITY_BODIES) return null;
  const b = seriesAt(before, width);
  const na = normaliseDensity(a);
  const nb =
    b !== null && b.body.length >= MIN_DENSITY_BODIES
      ? normaliseDensity(b)
      : [];
  const bodies = na.map(([k]) => k);
  const first = bodies[0] ?? 0;
  const last = bodies[bodies.length - 1] ?? 0;
  const spot =
    now.spot ?? now.forward ?? bodies[Math.floor(bodies.length / 2)] ?? 0;
  const sigma = now.sigma_pts ?? (last - first) / 6;
  const lo = Math.max(Math.min(...bodies), spot - DENSITY_SIGMAS * sigma);
  const hi = Math.min(Math.max(...bodies), spot + DENSITY_SIGMAS * sigma);
  const inRange = (points: readonly DensityPoint[]): DensityPoint[] =>
    points.filter(([k]) => k >= lo && k <= hi);
  const pa = inRange(na);
  const pb = inRange(nb);
  const ymax = Math.max(...pa.map(p => p[1]), ...pb.map(p => p[1]), 1e-9) * 1.1;
  const ticks = [-3, -2, -1, 0, 1, 2, 3]
    .map(k => spot + k * sigma)
    .filter(v => v >= lo && v <= hi);
  return {
    width,
    widths,
    now: pa,
    before: pb,
    lo,
    hi,
    spot,
    sigma,
    ymax,
    ticks,
  };
}

/** The point nearest a strike, for a readout under a finger; -1 for no points. */
export function nearestPointIndex(
  points: readonly (readonly [number, ...unknown[]])[],
  strike: number,
): number {
  let best = -1;
  let bestGap = Infinity;
  points.forEach(([k], i) => {
    const gap = Math.abs(k - strike);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

export type GexBarsView =
  /** No open interest to draw from: the chart says so. */
  | {readonly kind: 'empty'}
  /** Open interest, but no strike within reach of spot: web draws nothing. */
  | {readonly kind: 'none'}
  | {
      readonly kind: 'bars';
      /** The strikes within ±2.5σ of spot, ascending as the engine lists them. */
      readonly strikes: readonly number[];
      /** Net gamma at each strike, a missing figure as 0; positive damps moves, negative speeds them. */
      readonly values: readonly number[];
      /** The bars' half-height: the largest magnitude (at least 1), plus 8%. */
      readonly vmax: number;
      readonly lo: number;
      readonly hi: number;
      readonly spot: number;
      /** The gamma flip when it falls within the bars, else null. */
      readonly flip: number | null;
    };

/**
 * Net gamma exposure by strike around spot only, as web's GexBars draws it: far strikes carry
 * almost no gamma and would squash the bars that matter.
 */
export function gexBarsView(
  payload: FlyoneCurvePayload | null | undefined,
  row: Pick<FlyoneRow, 'spot' | 'sigma_pts' | 'gamma_flip'>,
): GexBarsView {
  const strikes = payload?.strikes ?? [];
  const spot = row.spot ?? payload?.spot ?? null;
  const net = payload?.net_gex ?? [];
  if (
    payload == null ||
    strikes.length === 0 ||
    spot === null ||
    net.every(v => !v)
  )
    return {kind: 'empty'};
  const first = strikes[0] ?? 0;
  const last = strikes[strikes.length - 1] ?? 0;
  const sigma = row.sigma_pts ?? payload.sigma_pts ?? (last - first) / 6;
  const near = strikes.flatMap((k, i) =>
    Math.abs(k - spot) <= GEX_SIGMAS * sigma ? [i] : [],
  );
  if (near.length === 0) return {kind: 'none'};
  const ks = near.map(i => strikes[i] ?? 0);
  const vs = near.map(i => {
    const v = net[i];
    return v != null && Number.isFinite(v) ? v : 0;
  });
  const lo = ks[0] ?? 0;
  const hi = ks[ks.length - 1] ?? 0;
  const flip = row.gamma_flip;
  return {
    kind: 'bars',
    strikes: ks,
    values: vs,
    vmax: Math.max(...vs.map(Math.abs), 1) * 1.08,
    lo,
    hi,
    spot,
    flip: flip !== null && flip >= lo && flip <= hi ? flip : null,
  };
}

/** Every how-many bars carries a strike label, so labels about 90 points apart fit the width. */
export const gexTickEvery = (count: number, width: number): number =>
  Math.max(1, Math.ceil(count / Math.max(3, Math.floor(width / 90))));

/**
 * The session timeline's clock labels: the first reading, a third and two thirds through, and the
 * last. A short session puts two on one reading, which is labelled once.
 */
export const timelineTicks = (count: number): number[] =>
  count < 1
    ? []
    : [
        ...new Set([
          0,
          Math.floor((count - 1) / 3),
          Math.floor(((count - 1) * 2) / 3),
          count - 1,
        ]),
      ];

/** The reading under a finger `fraction` of the way across the plot (0 to 1), clamped to the session. */
export const timelineIndexAt = (fraction: number, count: number): number =>
  count < 1
    ? -1
    : Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));

/** Where a score (−2 to +2) sits down the plot, 0 at +2 and 1 at −2; a score past either end is held at it. */
export const timelineScoreY = (score: number): number =>
  (2 - Math.max(-2, Math.min(2, score))) / 4;

/**
 * Whether an expiry chip is the one showing: the panel holds what was asked for, which is a rank
 * (`near`, `next`) or the expiry itself.
 */
export const isShownExpiry = (
  entry: FlyoneDetailExpiry,
  shown: string,
): boolean => entry.expiry === shown || entry.expiry_rank === shown;
