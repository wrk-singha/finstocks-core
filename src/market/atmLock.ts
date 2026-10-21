// ATM lock's maths for the terminal's Call and Put panes, as the web has them
// (web feat/chart-parity src/utils/market/atmLock.ts). Pure, no React.

/**
 * The ATM strike ATM lock should point at: the listed strike nearest spot, but
 * only moving off `current` once spot has crossed the midpoint to a neighbour
 * by `hysteresis` of the gap, so a price sitting on the midpoint doesn't flip
 * the panes back and forth. Returns `current` when nothing should move.
 */
export function atmLockTarget(
  spot: number,
  strikes: readonly number[],
  current: number,
  hysteresis = 0.1,
): number {
  if (!(spot > 0) || strikes.length === 0) return current;
  const asc = [...strikes].sort((a, b) => a - b);
  let nearest = asc[0] ?? current;
  for (const k of asc)
    if (Math.abs(k - spot) < Math.abs(nearest - spot)) nearest = k;
  // A strike the list no longer carries (another expiry's) snaps straight to the money.
  if (!asc.includes(current)) return nearest;
  if (nearest === current) return current;
  // Spot is past a midpoint: move only once it is clear of it by the margin.
  const i = asc.indexOf(current);
  const next = spot > current ? asc[i + 1] : asc[i - 1];
  if (next == null) return current;
  const mid = (current + next) / 2;
  const margin = Math.abs(next - current) * hysteresis;
  const clear = spot > current ? spot >= mid + margin : spot <= mid - margin;
  return clear ? nearest : current;
}

/** The midpoint spot crossed to move from `from` to `to` (for the toast). */
export const crossedMidpoint = (
  from: number,
  to: number,
  strikes: readonly number[],
): number => {
  const asc = [...strikes].sort((a, b) => a - b);
  const i = asc.indexOf(from);
  const next = to > from ? asc[i + 1] : asc[i - 1];
  return next != null ? (from + next) / 2 : (from + to) / 2;
};
