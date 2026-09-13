/**
 * Convert a #rrggbb / #rgb hex to an `rgba(r,g,b,a)` string.
 * Non-hex inputs (already rgba/named) are returned unchanged.
 */
export function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4))
    return hex;
  let h = hex.slice(1);
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Darken a #rrggbb / #rgb hex toward black by `amount` (0-1), returned as hex.
 *
 * Kept opaque rather than an alpha overlay: these are used as solid fills that
 * animate between states, and an animated interpolation of two opaque colours
 * is clean where an rgba pair would also cross-fade whatever sits behind them.
 * Non-hex inputs (already rgba/named) are returned unchanged.
 */
export function shade(hex: string, amount: number): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4))
    return hex;
  let h = hex.slice(1);
  if (h.length === 3)
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  const n = parseInt(h, 16);
  const k = 1 - Math.min(Math.max(amount, 0), 1);
  const channel = (shift: number): string =>
    Math.round(((n >> shift) & 255) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * The P&L colour role a value maps to. Core cannot resolve a colour — the web
 * reads `--pl-profit`/`--pl-loss` CSS vars, mobile reads the theme's `pl.*` hex —
 * so it names the role and each app maps it: `hexToRgba(colors.pl[tone], alpha)`
 * on mobile, `rgb(var(--pl-${tone}) / alpha)` on the web.
 */
export type PlTone = 'profit' | 'loss' | 'neutral';

export const plTone = (value: number | boolean | null | undefined): PlTone => {
  if (typeof value === 'boolean') return value ? 'profit' : 'loss';
  if (value == null || !Number.isFinite(value) || value === 0) return 'neutral';
  return value > 0 ? 'profit' : 'loss';
};
