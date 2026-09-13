/**
 * SVG path math for the Monte-Carlo portfolio card.
 *
 * Distinct from a sparkline's `buildLinePath`, which auto-scales each series to
 * its own min/max — the portfolio charts plot several series (portfolio / FD /
 * gold / NIFTY, or nested percentile bands) that must share ONE y-domain to be
 * comparable, so these helpers take an explicit domain and return a scaler.
 */

export type Scale = (value: number) => number;

// Shared vertical scale: data domain [min,max] → pixel y (inverted for SVG).
export const scaleY = (
  min: number,
  max: number,
  h: number,
  padTop: number,
  padBottom: number,
): Scale => {
  const range = max - min || 1;
  const usable = h - padTop - padBottom;
  return v => padTop + usable * (1 - (v - min) / range);
};

// Even horizontal step across n samples.
export const scaleX =
  (n: number, w: number): Scale =>
  i =>
    n <= 1 ? w / 2 : (i / (n - 1)) * w;

export const linePath = (values: number[], sx: Scale, sy: Scale): string =>
  values
    .map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`)
    .join(' ');

// Closed area between an upper and a lower series (upper left→right, lower
// right→left) — used to fill percentile bands.
export const bandPath = (
  upper: number[],
  lower: number[],
  sx: Scale,
  sy: Scale,
): string => {
  if (upper.length < 2 || lower.length < 2) return '';
  const up = upper
    .map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`)
    .join(' ');
  const down = lower
    .map((v, i) => [sx(i), sy(v)] as const)
    .reverse()
    .map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  return `${up} ${down} Z`;
};

// Donut segment path between two radii and two angles (radians, clockwise).
export const donutArc = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
): string => {
  const pt = (r: number, a: number): readonly [number, number] =>
    [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = pt(rOuter, a0);
  const [ox1, oy1] = pt(rOuter, a1);
  const [ix1, iy1] = pt(rInner, a1);
  const [ix0, iy0] = pt(rInner, a0);
  return [
    `M${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A${rOuter} ${rOuter} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A${rInner} ${rInner} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ');
};

// The combined min/max across several series (for a shared domain).
export const domainOf = (...series: number[][]): [number, number] => {
  const flat = series.flat().filter(v => Number.isFinite(v));
  if (!flat.length) return [0, 1];
  return [Math.min(...flat), Math.max(...flat)];
};

// "Now / 1y / … / Ny" tick labels for a forward projection over `years`.
export const yearLabels = (years: number): string[] => {
  const out = ['Now'];
  for (let y = 1; y <= years; y += 1) out.push(`${y}y`);
  return out;
};

// Evenly-spaced value ticks across a domain (inclusive of both ends).
export const valueTicks = (min: number, max: number, count = 4): number[] => {
  if (count < 2) return [max];
  return Array.from(
    {length: count},
    (_, i) => min + ((max - min) * i) / (count - 1),
  );
};
