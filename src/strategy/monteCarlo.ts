/**
 * Bootstrap Monte Carlo of a backtest (web feat/chart-parity 76f1dfee, 10a0f390): each path
 * redraws the trade P&Ls with replacement and sums them (not compounded). Seeded (mulberry32) so a
 * figure on screen can be reproduced.
 */

export type RuinThreshold =
  {kind: 'pct'; value: number} | {kind: 'amount'; value: number};

export interface MonteCarloInput {
  /** Per-trade P&L in rupees, in the order the backtest traded them. */
  pnls: readonly number[];
  /** Starting balance, or null when the sizing has no capital pool (QTY). */
  capital: number | null;
  paths?: number;
  seed?: number;
  /** Ruin is a drawdown this deep: % of peak equity (needs capital) or rupees. */
  ruin: RuinThreshold;
}

export interface Percentiles {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface Histogram {
  /** Bin edges, one more than counts. */
  edges: number[];
  counts: number[];
}

export type EdgeVerdict = 'likely' | 'uncertain' | 'unsupported' | 'negative';

export interface MonteCarloResult {
  n: number;
  paths: number;
  seed: number;
  /** Trade counts the fan is drawn at (0 … n), thinned for very long runs. */
  steps: number[];
  /** Cumulative P&L (rupees) at each step, per percentile. */
  fan: {[K in keyof Percentiles]: number[]};
  /** The backtest's own order, at the same steps. */
  actual: number[];
  final: Percentiles & {mean: number; histogram: Histogram};
  /** Final return, % of capital; null without capital. */
  finalPct: Percentiles | null;
  maxDrawdown: Percentiles & {histogram: Histogram};
  /** Max drawdown, % of peak equity; null without capital. */
  maxDrawdownPct: (Percentiles & {histogram: Histogram}) | null;
  actualMaxDrawdown: number;
  actualMaxDrawdownPct: number | null;
  /** Share of paths ending below where they started. */
  probLoss: number;
  /** Share of paths whose drawdown reached the ruin threshold. */
  probRuin: number;
  ruin: RuinThreshold;
  /** The backtest's mean trade, and the middle 95% of resampled means. */
  meanTrade: {value: number; low: number; high: number};
  /** Share of the net profit the three best trades made (null when the net is not a profit). */
  top3Share: number | null;
  netWithoutTop3: number;
  verdict: EdgeVerdict;
  /** Every path's max drawdown, ascending (rupees, and % of peak equity with capital), for re-reading ruin at another threshold. */
  drawdowns: number[];
  drawdownPcts: number[] | null;
  /** Milliseconds the simulation took. */
  ms: number;
}

/** Below this many trades the resample says nothing worth reading. */
export const MIN_MONTE_CARLO_TRADES = 20;
export const DEFAULT_PATHS = 1000;
export const DEFAULT_SEED = 20260929;
/** Beyond this many trades the fan is drawn at this many evenly spaced steps. */
const MAX_FAN_STEPS = 400;
const HISTOGRAM_BINS = 24;
/** Below this many trades "likely" is never said, however clean the resample. */
const LIKELY_MIN_TRADES = 30;

/** mulberry32: a small, fast, well-mixed 32-bit PRNG. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Linear-interpolated percentile of an ascending array (numpy's default). */
function percentileSorted(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  const low = sorted[lo] ?? NaN;
  return low + (h - lo) * ((sorted[hi] ?? low) - low);
}

function percentiles(sorted: ArrayLike<number>): Percentiles {
  return {
    p5: percentileSorted(sorted, 0.05),
    p25: percentileSorted(sorted, 0.25),
    p50: percentileSorted(sorted, 0.5),
    p75: percentileSorted(sorted, 0.75),
    p95: percentileSorted(sorted, 0.95),
  };
}

function histogram(sorted: Float64Array, bins = HISTOGRAM_BINS): Histogram {
  const lo = sorted[0] ?? 0;
  const hi = sorted[sorted.length - 1] ?? lo;
  if (!(hi > lo)) return {edges: [lo, lo], counts: [sorted.length]};
  const width = (hi - lo) / bins;
  const edges = Array.from({length: bins + 1}, (_, i) => lo + i * width);
  const counts = new Array<number>(bins).fill(0);
  for (const value of sorted) {
    const bin = Math.min(bins - 1, Math.floor((value - lo) / width));
    counts[bin] = (counts[bin] ?? 0) + 1;
  }
  return {edges, counts};
}

const sortedCopy = (values: Float64Array): Float64Array =>
  Float64Array.from(values).sort();

/** The trade counts the fan is sampled at. */
export function fanSteps(n: number): number[] {
  if (n <= MAX_FAN_STEPS) return Array.from({length: n + 1}, (_, i) => i);
  const out = new Set<number>([0, n]);
  for (let i = 1; i < MAX_FAN_STEPS; i += 1) {
    out.add(Math.round((i * n) / MAX_FAN_STEPS));
  }
  return [...out].sort((a, b) => a - b);
}

/** Drawdown of one ordered path, in rupees and (with capital) % of peak equity. */
function drawdownOf(
  pnls: readonly number[],
  capital: number | null,
): {amount: number; pct: number | null} {
  let cum = 0;
  let peak = 0;
  let amount = 0;
  let pct = 0;
  for (const pnl of pnls) {
    cum += pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > amount) amount = dd;
    if (capital != null) {
      const peakEquity = capital + peak;
      const ddPct = peakEquity > 0 ? (dd / peakEquity) * 100 : 100;
      if (ddPct > pct) pct = ddPct;
    }
  }
  return {amount, pct: capital != null ? pct : null};
}

// Read off globalThis: the mobile app typechecks this file against React Native's globals, which
// declare no `performance`.
const clock = (globalThis as {readonly performance?: {now: () => number}})
  .performance;
const now = (): number => clock?.now() ?? Date.now();

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const started = now();
  const pnls = input.pnls.filter(v => Number.isFinite(v));
  const n = pnls.length;
  const paths = Math.max(1, Math.floor(input.paths ?? DEFAULT_PATHS));
  const seed = input.seed ?? DEFAULT_SEED;
  const capital =
    input.capital != null && input.capital > 0 ? input.capital : null;
  const ruin: RuinThreshold =
    capital == null && input.ruin.kind === 'pct'
      ? {kind: 'amount', value: Infinity}
      : input.ruin;
  const rand = mulberry32(seed);
  const draws = Float64Array.from(pnls);

  const steps = fanSteps(n);
  const stepIndex = new Int32Array(n + 1).fill(-1);
  steps.forEach((s, i) => (stepIndex[s] = i));
  // Column-major: all paths' values at one step sit together, ready to sort.
  const atStep = steps.map(() => new Float64Array(paths));
  const finals = new Float64Array(paths);
  const dds = new Float64Array(paths);
  const ddPcts = new Float64Array(paths);
  const means = new Float64Array(paths);
  let losses = 0;
  let ruined = 0;

  for (let p = 0; p < paths; p += 1) {
    let cum = 0;
    let peak = 0;
    let dd = 0;
    let ddPct = 0;
    for (let k = 1; k <= n; k += 1) {
      cum += draws[Math.floor(rand() * n)] ?? 0;
      if (cum > peak) peak = cum;
      const down = peak - cum;
      if (down > dd) dd = down;
      if (capital != null) {
        const peakEquity = capital + peak;
        const pct = peakEquity > 0 ? (down / peakEquity) * 100 : 100;
        if (pct > ddPct) ddPct = pct;
      }
      const column = atStep[stepIndex[k] ?? -1];
      if (column !== undefined) column[p] = cum;
    }
    finals[p] = cum;
    dds[p] = dd;
    ddPcts[p] = ddPct;
    means[p] = n ? cum / n : 0;
    if (cum < 0) losses += 1;
    if (ruin.kind === 'pct' ? ddPct >= ruin.value : dd >= ruin.value) {
      ruined += 1;
    }
  }

  const fan: MonteCarloResult['fan'] = {
    p5: [],
    p25: [],
    p50: [],
    p75: [],
    p95: [],
  };
  for (const column of atStep) {
    const q = percentiles(column.sort());
    fan.p5.push(q.p5);
    fan.p25.push(q.p25);
    fan.p50.push(q.p50);
    fan.p75.push(q.p75);
    fan.p95.push(q.p95);
  }

  const cumActual: number[] = [0];
  let running = 0;
  for (const pnl of pnls) {
    running += pnl;
    cumActual.push(running);
  }
  const actual = steps.map(s => cumActual[s] ?? 0);
  const actualDd = drawdownOf(pnls, capital);

  const finalSorted = sortedCopy(finals);
  const ddSorted = sortedCopy(dds);
  const meanSorted = sortedCopy(means);
  const finalQ = percentiles(finalSorted);
  let finalMean = 0;
  for (const value of finals) finalMean += value;
  finalMean /= paths;

  const net = running;
  const meanTradeValue = n ? net / n : 0;
  const meanLow = percentileSorted(meanSorted, 0.025);
  const meanHigh = percentileSorted(meanSorted, 0.975);
  const top3 = [...pnls]
    .sort((a, b) => b - a)
    .slice(0, 3)
    .filter(v => v > 0)
    .reduce((s, v) => s + v, 0);
  const probLoss = losses / paths;

  let verdict: EdgeVerdict;
  if (meanTradeValue <= 0) verdict = 'negative';
  else if (meanLow > 0 && n >= LIKELY_MIN_TRADES) verdict = 'likely';
  else if (1 - probLoss >= 0.6) verdict = 'uncertain';
  else verdict = 'unsupported';

  const ddPctSorted = capital != null ? sortedCopy(ddPcts) : null;
  const ofCapital = (value: number, base: number): number =>
    (value / base) * 100;
  return {
    n,
    paths,
    seed,
    steps,
    fan,
    actual,
    final: {...finalQ, mean: finalMean, histogram: histogram(finalSorted)},
    finalPct:
      capital != null
        ? {
            p5: ofCapital(finalQ.p5, capital),
            p25: ofCapital(finalQ.p25, capital),
            p50: ofCapital(finalQ.p50, capital),
            p75: ofCapital(finalQ.p75, capital),
            p95: ofCapital(finalQ.p95, capital),
          }
        : null,
    maxDrawdown: {...percentiles(ddSorted), histogram: histogram(ddSorted)},
    maxDrawdownPct: ddPctSorted
      ? {...percentiles(ddPctSorted), histogram: histogram(ddPctSorted)}
      : null,
    actualMaxDrawdown: actualDd.amount,
    actualMaxDrawdownPct: actualDd.pct,
    probLoss,
    probRuin: ruined / paths,
    ruin,
    meanTrade: {value: meanTradeValue, low: meanLow, high: meanHigh},
    top3Share: net > 0 ? top3 / net : null,
    netWithoutTop3: net - top3,
    verdict,
    drawdowns: Array.from(ddSorted),
    drawdownPcts: ddPctSorted ? Array.from(ddPctSorted) : null,
    ms: now() - started,
  };
}

/**
 * The ruin probability at another threshold, read from the same paths' drawdowns — so moving the
 * threshold never reruns the simulation.
 */
export function ruinProbability(
  result: MonteCarloResult,
  ruin: RuinThreshold,
): number {
  const sorted = ruin.kind === 'pct' ? result.drawdownPcts : result.drawdowns;
  if (!sorted || sorted.length === 0 || !Number.isFinite(ruin.value)) return 0;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((sorted[mid] ?? 0) < ruin.value) lo = mid + 1;
    else hi = mid;
  }
  return (sorted.length - lo) / sorted.length;
}
