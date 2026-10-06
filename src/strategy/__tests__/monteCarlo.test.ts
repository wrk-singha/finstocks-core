import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  advanceMonteCarlo,
  createMonteCarloJob,
  fanSteps,
  isMonteCarloDone,
  monteCarloDraws,
  monteCarloProgress,
  monteCarloResult,
  ruinProbability,
  runMonteCarlo,
} from '../monteCarlo.ts';

/** 40 trades: mostly small wins, a few larger losses. */
const pnls = Array.from({length: 40}, (_, i) =>
  i % 5 === 4 ? -300 : 150 + (i % 3) * 20,
);

test('a seed reproduces every figure; another seed gives other paths', () => {
  const input = {
    pnls,
    capital: 100_000,
    paths: 300,
    seed: 42,
    ruin: {kind: 'pct', value: 1} as const,
  };
  const a = runMonteCarlo(input);
  const b = runMonteCarlo(input);
  // Everything but the wall-clock time the run took.
  assert.deepEqual({...a, ms: 0}, {...b, ms: 0});
  assert.notDeepEqual(
    runMonteCarlo({...input, seed: 43}).final.histogram,
    a.final.histogram,
  );
});

test("the fan runs from zero through every step, with the backtest's own order beside it", () => {
  const r = runMonteCarlo({
    pnls,
    capital: 100_000,
    paths: 200,
    seed: 1,
    ruin: {kind: 'pct', value: 20},
  });
  assert.equal(r.n, 40);
  assert.equal(r.steps.length, 41);
  assert.equal(r.fan.p50[0], 0);
  assert.equal(r.actual[0], 0);
  const net = pnls.reduce((s, v) => s + v, 0);
  assert.equal(r.actual.at(-1), net);
  r.steps.forEach((_, i) => {
    assert.ok((r.fan.p5[i] ?? 0) <= (r.fan.p25[i] ?? 0));
    assert.ok((r.fan.p25[i] ?? 0) <= (r.fan.p50[i] ?? 0));
    assert.ok((r.fan.p50[i] ?? 0) <= (r.fan.p75[i] ?? 0));
    assert.ok((r.fan.p75[i] ?? 0) <= (r.fan.p95[i] ?? 0));
  });
  assert.equal(r.meanTrade.value, net / 40);
  assert.equal(
    r.final.histogram.counts.reduce((s, c) => s + c, 0),
    200,
  );
  assert.equal(r.final.histogram.edges.length, 25);
  assert.equal(r.finalPct?.p50, (r.final.p50 / 100_000) * 100);
});

test('moving the ruin threshold re-reads the same paths', () => {
  const r = runMonteCarlo({
    pnls,
    capital: 100_000,
    paths: 500,
    seed: 3,
    ruin: {kind: 'pct', value: 0.5},
  });
  assert.equal(ruinProbability(r, {kind: 'pct', value: 0.5}), r.probRuin);
  assert.equal(ruinProbability(r, {kind: 'pct', value: 0}), 1);
  assert.equal(ruinProbability(r, {kind: 'pct', value: 101}), 0);
  assert.ok(
    ruinProbability(r, {kind: 'pct', value: 1}) <=
      ruinProbability(r, {kind: 'pct', value: 0.5}),
  );
});

test('with no capital pool the figures stay in rupees and a % ruin cannot be met', () => {
  const r = runMonteCarlo({
    pnls,
    capital: null,
    paths: 100,
    seed: 5,
    ruin: {kind: 'pct', value: 20},
  });
  assert.equal(r.finalPct, null);
  assert.equal(r.maxDrawdownPct, null);
  assert.equal(r.actualMaxDrawdownPct, null);
  assert.equal(r.drawdownPcts, null);
  assert.deepEqual(r.ruin, {kind: 'amount', value: Infinity});
  assert.equal(r.probRuin, 0);
  assert.equal(r.actualMaxDrawdown, 300);
});

test('the verdict: a losing mean is no edge; a clean positive one over 30 trades is likely', () => {
  const losing = runMonteCarlo({
    pnls: pnls.map(v => -Math.abs(v)),
    capital: null,
    paths: 100,
    ruin: {kind: 'amount', value: 1000},
  });
  assert.equal(losing.verdict, 'negative');
  assert.equal(losing.top3Share, null);

  const steady = runMonteCarlo({
    pnls: Array.from({length: 40}, (_, i) => 100 + (i % 4) * 10),
    capital: null,
    paths: 200,
    ruin: {kind: 'amount', value: 1000},
  });
  assert.equal(steady.verdict, 'likely');
  assert.equal(steady.probLoss, 0);

  const few = runMonteCarlo({
    pnls: Array.from({length: 20}, (_, i) => 100 + (i % 4) * 10),
    capital: null,
    paths: 200,
    ruin: {kind: 'amount', value: 1000},
  });
  assert.equal(few.verdict, 'uncertain');
});

test('the three best trades are weighed against the net', () => {
  const r = runMonteCarlo({
    pnls: [1000, 800, 600, -100, -100, 50],
    capital: null,
    paths: 10,
    ruin: {kind: 'amount', value: 1},
  });
  assert.equal(r.top3Share, 2400 / 2250);
  assert.equal(r.netWithoutTop3, -150);
});

test('a long run is drawn at no more than 401 steps, both ends kept', () => {
  const steps = fanSteps(2000);
  assert.ok(steps.length <= 401);
  assert.equal(steps[0], 0);
  assert.equal(steps.at(-1), 2000);
  assert.deepEqual(fanSteps(3), [0, 1, 2, 3]);
});

test('a run drawn in slices is the run drawn at once, path for path', () => {
  const input = {
    pnls,
    capital: 100_000,
    paths: 300,
    seed: 11,
    ruin: {kind: 'pct', value: 1} as const,
  };
  const job = createMonteCarloJob(input);
  assert.equal(monteCarloDraws(job), 40 * 300);
  const slices: number[] = [];
  const progress: number[] = [];
  while (!isMonteCarloDone(job)) {
    slices.push(advanceMonteCarlo(job, 1000));
    progress.push(monteCarloProgress(job));
  }
  // 1,000 draws is 25 paths of 40 trades, then 3 of the 41 fan steps (300 paths each).
  assert.deepEqual(slices, [
    ...Array.from({length: 12}, () => 25),
    ...Array.from({length: 13}, () => 3),
    2,
  ]);
  assert.ok(progress.every((p, i) => i === 0 || p > (progress[i - 1] ?? 0)));
  assert.equal(progress.at(-1), 1);
  assert.deepEqual(
    {...monteCarloResult(job), ms: 0},
    {...runMonteCarlo(input), ms: 0},
  );
});

test('a slice always does a path or a step, and a run is read only once it is done', () => {
  const job = createMonteCarloJob({
    pnls,
    capital: null,
    paths: 3,
    ruin: {kind: 'amount', value: 1},
  });
  assert.equal(advanceMonteCarlo(job, 1), 1);
  assert.throws(() => monteCarloResult(job), /left/);
  assert.equal(advanceMonteCarlo(job), 2);
  // Every path drawn; the 41 fan steps are read next.
  assert.throws(() => monteCarloResult(job), /left/);
  assert.equal(advanceMonteCarlo(job, 1), 1);
  assert.equal(advanceMonteCarlo(job), 40);
  assert.equal(advanceMonteCarlo(job), 0);
  assert.equal(monteCarloResult(job).paths, 3);
});
