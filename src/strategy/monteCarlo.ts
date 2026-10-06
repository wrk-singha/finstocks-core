import {mulberry32, percentileSorted} from '../market/sampling.ts';

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

/**
 * A run done a slice at a time: `createMonteCarloJob`, then `advanceMonteCarlo` until
 * `isMonteCarloDone`, then `monteCarloResult`. A slice draws paths and, once they are all drawn,
 * reads the fan's percentiles a few steps at a time (sorting every path's value at a step is most
 * of what is left). One PRNG stream draws the paths in order, so the same seed gives the same
 * result however the run is sliced, and the same as `runMonteCarlo`. A host without a worker hands
 * the thread back between slices.
 */
export interface MonteCarloJob {
  readonly n: number;
  readonly paths: number;
  readonly seed: number;
  readonly capital: number | null;
  readonly ruin: RuinThreshold;
  readonly pnls: readonly number[];
  /** Paths drawn so far. */
  done: number;
  /** Fan steps read so far, once every path is drawn. */
  read: number;
  readonly fan: MonteCarloResult['fan'];
  /** Milliseconds spent drawing and reading so far, not counting the time between slices. */
  ms: number;
  losses: number;
  ruined: number;
  readonly draws: Float64Array;
  readonly rand: () => number;
  readonly steps: number[];
  readonly stepIndex: Int32Array;
  /** Column-major: all paths' values at one step sit together, ready to sort. */
  readonly atStep: Float64Array[];
  readonly finals: Float64Array;
  readonly dds: Float64Array;
  readonly ddPcts: Float64Array;
  readonly means: Float64Array;
}

/** Draws a run makes in all: one per trade per path. */
export const monteCarloDraws = (
  job: Pick<MonteCarloJob, 'n' | 'paths'>,
): number => job.n * job.paths;

export function createMonteCarloJob(input: MonteCarloInput): MonteCarloJob {
  const started = now();
  const pnls = input.pnls.filter(v => Number.isFinite(v));
  const n = pnls.length;
  // A count that is no number would leave a sliced run never done: it takes the default.
  const asked = Math.floor(input.paths ?? DEFAULT_PATHS);
  const paths = Number.isFinite(asked) ? Math.max(1, asked) : DEFAULT_PATHS;
  const capital =
    input.capital != null && input.capital > 0 ? input.capital : null;
  const steps = fanSteps(n);
  const stepIndex = new Int32Array(n + 1).fill(-1);
  steps.forEach((s, i) => (stepIndex[s] = i));
  const job: MonteCarloJob = {
    n,
    paths,
    seed: input.seed ?? DEFAULT_SEED,
    capital,
    ruin:
      capital == null && input.ruin.kind === 'pct'
        ? {kind: 'amount', value: Infinity}
        : input.ruin,
    pnls,
    done: 0,
    read: 0,
    fan: {p5: [], p25: [], p50: [], p75: [], p95: []},
    ms: 0,
    losses: 0,
    ruined: 0,
    draws: Float64Array.from(pnls),
    rand: mulberry32(input.seed ?? DEFAULT_SEED),
    steps,
    stepIndex,
    atStep: steps.map(() => new Float64Array(paths)),
    finals: new Float64Array(paths),
    dds: new Float64Array(paths),
    ddPcts: new Float64Array(paths),
    means: new Float64Array(paths),
  };
  job.ms = now() - started;
  return job;
}

export const isMonteCarloDone = (job: MonteCarloJob): boolean =>
  job.done >= job.paths && job.read >= job.atStep.length;

/** How far through a run is, 0–1: its paths drawn and its fan steps read. */
export const monteCarloProgress = (job: MonteCarloJob): number =>
  (job.done + job.read) / (job.paths + job.atStep.length);

/**
 * One slice of a run: whole paths, as many as fit in `maxDraws` draws and always at least one; once
 * every path is drawn, fan steps, as many whose sort fits the same budget (a step sorts one value a
 * path) and always at least one. Returns the paths and steps this call did.
 */
export function advanceMonteCarlo(
  job: MonteCarloJob,
  maxDraws = Infinity,
): number {
  const started = now();
  if (job.done < job.paths) {
    const drawn = drawPaths(job, maxDraws);
    job.ms += now() - started;
    return drawn;
  }
  const fit = Math.max(1, Math.floor(maxDraws / job.paths));
  const end = Math.min(job.atStep.length, job.read + fit);
  const from = job.read;
  for (let s = from; s < end; s += 1) {
    const q = percentiles(job.atStep[s]?.sort() ?? []);
    job.fan.p5.push(q.p5);
    job.fan.p25.push(q.p25);
    job.fan.p50.push(q.p50);
    job.fan.p75.push(q.p75);
    job.fan.p95.push(q.p95);
  }
  job.read = end;
  job.ms += now() - started;
  return end - from;
}

function drawPaths(job: MonteCarloJob, maxDraws: number): number {
  const {n, capital, ruin, draws, rand, stepIndex, atStep} = job;
  const fit = n === 0 ? job.paths : Math.max(1, Math.floor(maxDraws / n));
  const end = Math.min(job.paths, job.done + fit);
  const from = job.done;
  for (let p = from; p < end; p += 1) {
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
    job.finals[p] = cum;
    job.dds[p] = dd;
    job.ddPcts[p] = ddPct;
    job.means[p] = n ? cum / n : 0;
    if (cum < 0) job.losses += 1;
    if (ruin.kind === 'pct' ? ddPct >= ruin.value : dd >= ruin.value) {
      job.ruined += 1;
    }
  }
  job.done = end;
  return end - from;
}

/** The figures of a finished run. Throws on one with paths or fan steps still to do. */
export function monteCarloResult(job: MonteCarloJob): MonteCarloResult {
  if (!isMonteCarloDone(job)) {
    throw new Error('monteCarloResult: the run has paths or steps left');
  }
  const started = now();
  const {n, paths, capital, pnls, steps, fan} = job;

  const cumActual: number[] = [0];
  let running = 0;
  for (const pnl of pnls) {
    running += pnl;
    cumActual.push(running);
  }
  const actual = steps.map(s => cumActual[s] ?? 0);
  const actualDd = drawdownOf(pnls, capital);

  const finalSorted = sortedCopy(job.finals);
  const ddSorted = sortedCopy(job.dds);
  const meanSorted = sortedCopy(job.means);
  const finalQ = percentiles(finalSorted);
  let finalMean = 0;
  for (const value of job.finals) finalMean += value;
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
  const probLoss = job.losses / paths;

  let verdict: EdgeVerdict;
  if (meanTradeValue <= 0) verdict = 'negative';
  else if (meanLow > 0 && n >= LIKELY_MIN_TRADES) verdict = 'likely';
  else if (1 - probLoss >= 0.6) verdict = 'uncertain';
  else verdict = 'unsupported';

  const ddPctSorted = capital != null ? sortedCopy(job.ddPcts) : null;
  const ofCapital = (value: number, base: number): number =>
    (value / base) * 100;
  const drawdownPcts = ddPctSorted ? Array.from(ddPctSorted) : null;
  const ms = job.ms + (now() - started);
  return {
    n,
    paths,
    seed: job.seed,
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
    probRuin: job.ruined / paths,
    ruin: job.ruin,
    meanTrade: {value: meanTradeValue, low: meanLow, high: meanHigh},
    top3Share: net > 0 ? top3 / net : null,
    netWithoutTop3: net - top3,
    verdict,
    drawdowns: Array.from(ddSorted),
    drawdownPcts,
    ms,
  };
}

/** The whole run at once: web's `runMonteCarlo`. */
export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const job = createMonteCarloJob(input);
  while (!isMonteCarloDone(job)) advanceMonteCarlo(job);
  return monteCarloResult(job);
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
