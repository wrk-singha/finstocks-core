/**
 * The seeded draws and percentile reading every Monte Carlo here shares: the basket backtest's
 * forward band and a backtest's trade resample.
 */

/** mulberry32: a small, fast, well-mixed 32-bit PRNG. The same seed gives the same draws in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear-interpolated percentile of an ascending array (numpy's default); NaN for none. */
export function percentileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  const low = sorted[lo] ?? NaN;
  return low + (h - lo) * ((sorted[hi] ?? low) - low);
}
