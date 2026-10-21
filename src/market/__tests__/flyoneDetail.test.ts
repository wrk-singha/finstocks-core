import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {FlyoneCurvePayload} from '../../types/flyone.ts';
import {
  densityView,
  densityWidths,
  gexBarsView,
  gexTickEvery,
  isShownExpiry,
  nearestPointIndex,
  normaliseDensity,
  shownDensityWidth,
  timelineIndexAt,
  timelineScoreY,
  timelineTicks,
} from '../flyoneDetail.ts';

const payload = (
  patch: Partial<FlyoneCurvePayload> = {},
): FlyoneCurvePayload => ({
  spot: 25000,
  forward: 25010,
  step: 50,
  sigma_pts: 100,
  density: [
    {
      width: 100,
      body: [24800, 24900, 25000, 25100, 25200],
      density: [1, 2, 4, 2, 1],
    },
    {
      width: 200,
      body: [24600, 24800, 25000, 25200, 25400],
      density: [1, 3, 6, 3, 1],
    },
    {
      width: 400,
      body: [24200, 24600, 25000, 25400, 25800],
      density: [0, 1, 2, 1, 0],
    },
  ],
  strikes: [24700, 24800, 24900, 25000, 25100, 25200, 25300],
  net_gex: [5, -10, 20, 40, -30, 15, 2],
  call_gex: [],
  put_gex: [],
  ...patch,
});

const sum = (points: readonly (readonly [number, number])[]): number =>
  points.reduce((a, [, v]) => a + v, 0);

test('a curve is normalised to its share of the mass, a negative or missing figure counting as none', () => {
  const points = normaliseDensity({
    body: [1, 2, 3, 4],
    density: [2, -1, null, 6],
  });
  assert.deepEqual(points, [
    [1, 0.25],
    [2, 0],
    [3, 0],
    [4, 0.75],
  ]);
  // No mass at all: nothing to share, so it comes back flat rather than divided by zero.
  assert.deepEqual(normaliseDensity({body: [1, 2], density: [0, null]}), [
    [1, 0],
    [2, 0],
  ]);
});

test('the shown width is the one picked while the curve has it, else the middle one', () => {
  const widths = densityWidths(payload());
  assert.deepEqual(widths, [100, 200, 400]);
  assert.equal(shownDensityWidth(widths, null), 200);
  assert.equal(shownDensityWidth(widths, 400), 400);
  // A pick the next minute's curve no longer prices falls back to the middle.
  assert.equal(shownDensityWidth(widths, 50), 200);
  assert.equal(shownDensityWidth([100, 200], null), 200);
  assert.equal(shownDensityWidth([], null), undefined);
});

test('the distribution is drawn over spot ± 3.5σ, both curves normalised at one width', () => {
  const view = densityView(
    payload({sigma_pts: 100}),
    payload({
      density: [
        {
          width: 200,
          body: [24600, 24800, 25000, 25200, 25400],
          density: [2, 2, 2, 2, 2],
        },
      ],
    }),
  );
  assert.ok(view !== null);
  assert.equal(view.width, 200);
  assert.deepEqual(view.widths, [100, 200, 400]);
  // 25000 ± 350: the two outer bodies fall outside.
  assert.equal(view.lo, 24650);
  assert.equal(view.hi, 25350);
  assert.deepEqual(
    view.now.map(([k]) => k),
    [24800, 25000, 25200],
  );
  assert.deepEqual(
    view.before.map(([k]) => k),
    [24800, 25000, 25200],
  );
  // Normalised over the whole curve before it is clipped.
  assert.ok(Math.abs(sum(view.now) - 12 / 14) < 1e-12);
  assert.equal(view.ymax, (6 / 14) * 1.1);
  assert.deepEqual(
    view.ticks,
    [24700, 24800, 24900, 25000, 25100, 25200, 25300],
  );
  assert.equal(view.spot, 25000);
  assert.equal(view.sigma, 100);
});

test('a wide σ is held to the bodies the curve has', () => {
  const view = densityView(payload({sigma_pts: 1000}), null, 100);
  assert.ok(view !== null);
  assert.equal(view.lo, 24800);
  assert.equal(view.hi, 25200);
  assert.deepEqual(view.before, []);
  // Only the ticks inside the bodies are drawn.
  assert.deepEqual(view.ticks, [25000]);
});

test('spot falls back to the forward, then the middle body; σ to a sixth of the span', () => {
  const forward = densityView(
    payload({spot: null, sigma_pts: null}),
    null,
    100,
  );
  assert.ok(forward !== null);
  assert.equal(forward.spot, 25010);
  assert.equal(forward.sigma, 400 / 6);
  const middle = densityView(
    payload({spot: null, forward: null, sigma_pts: null}),
    null,
    100,
  );
  assert.equal(middle?.spot, 25000);
});

test('the distribution waits for three bodies, and a short lookback is left out', () => {
  const thin = payload({
    density: [{width: 100, body: [24900, 25000], density: [1, 1]}],
  });
  assert.equal(densityView(thin, null), null);
  assert.equal(densityView(null, null), null);
  assert.equal(densityView(payload({density: []}), null), null);
  const view = densityView(payload(), thin, 100);
  assert.deepEqual(view?.before, []);
});

test('a readout finds the point nearest the finger', () => {
  const points = [
    [100, 0.1],
    [200, 0.5],
    [300, 0.2],
  ] as const;
  assert.equal(nearestPointIndex(points, 90), 0);
  assert.equal(nearestPointIndex(points, 240), 1);
  assert.equal(nearestPointIndex(points, 900), 2);
  assert.equal(nearestPointIndex([], 100), -1);
});

const levels = {spot: 25000, sigma_pts: 100, gamma_flip: 24950};

test('gamma bars reach 2.5σ either side of spot, a missing figure drawn as none', () => {
  const view = gexBarsView(
    payload({net_gex: [5, -10, null, 40, -30, 15, 2]}),
    levels,
  );
  assert.equal(view.kind, 'bars');
  if (view.kind !== 'bars') return;
  assert.deepEqual(view.strikes, [24800, 24900, 25000, 25100, 25200]);
  assert.deepEqual(view.values, [-10, 0, 40, -30, 15]);
  assert.equal(view.vmax, 40 * 1.08);
  assert.equal(view.lo, 24800);
  assert.equal(view.hi, 25200);
  assert.equal(view.spot, 25000);
  assert.equal(view.flip, 24950);
});

test('a flip outside the bars is not drawn, and tiny exposure still scales to at least 1', () => {
  const view = gexBarsView(payload({net_gex: [0, 0.2, -0.1, 0.3, 0, 0, 0]}), {
    ...levels,
    gamma_flip: 26000,
  });
  assert.equal(view.kind, 'bars');
  if (view.kind !== 'bars') return;
  assert.equal(view.flip, null);
  assert.equal(view.vmax, 1.08);
});

test("spot and σ fall back to the curve's own when the row has none", () => {
  const view = gexBarsView(payload({spot: 25100, sigma_pts: 40}), {
    spot: null,
    sigma_pts: null,
    gamma_flip: null,
  });
  assert.equal(view.kind, 'bars');
  if (view.kind !== 'bars') return;
  // 2.5 × 40 either side of 25100.
  assert.deepEqual(view.strikes, [25000, 25100, 25200]);
  assert.equal(view.spot, 25100);
});

test('no open interest means no bars; open interest far from spot means nothing drawn', () => {
  assert.deepEqual(gexBarsView(null, levels), {kind: 'empty'});
  assert.deepEqual(gexBarsView(payload({strikes: []}), levels), {
    kind: 'empty',
  });
  assert.deepEqual(
    gexBarsView(payload({net_gex: [0, null, 0, 0, 0, 0, 0]}), levels),
    {kind: 'empty'},
  );
  assert.deepEqual(
    gexBarsView(payload({spot: null}), {...levels, spot: null}),
    {kind: 'empty'},
  );
  assert.deepEqual(gexBarsView(payload({strikes: [30000, 30100]}), levels), {
    kind: 'none',
  });
});

test('strike labels thin out to about one per 90 points of width', () => {
  assert.equal(gexTickEvery(11, 360), 3);
  assert.equal(gexTickEvery(11, 900), 2);
  assert.equal(gexTickEvery(3, 360), 1);
  // A width not yet measured still labels at least every third.
  assert.equal(gexTickEvery(9, 0), 3);
});

test('the timeline labels its first, third, two-thirds and last readings once each', () => {
  assert.deepEqual(timelineTicks(10), [0, 3, 6, 9]);
  assert.deepEqual(timelineTicks(2), [0, 1]);
  assert.deepEqual(timelineTicks(1), [0]);
  assert.deepEqual(timelineTicks(0), []);
});

test('a finger on the timeline reads the nearest minute, held to the session', () => {
  assert.equal(timelineIndexAt(0.5, 11), 5);
  assert.equal(timelineIndexAt(0.04, 11), 0);
  assert.equal(timelineIndexAt(-0.3, 11), 0);
  assert.equal(timelineIndexAt(1.4, 11), 10);
  assert.equal(timelineIndexAt(0.5, 0), -1);
});

test('a score sits down the plot from +2 at the top to −2 at the foot', () => {
  assert.equal(timelineScoreY(2), 0);
  assert.equal(timelineScoreY(0), 0.5);
  assert.equal(timelineScoreY(-2), 1);
  assert.equal(timelineScoreY(-3), 1);
});

test('an expiry chip is on for its rank or its date', () => {
  const near = {expiry: '2026-10-07', expiry_rank: 'near' as const};
  assert.equal(isShownExpiry(near, 'near'), true);
  assert.equal(isShownExpiry(near, '2026-10-07'), true);
  assert.equal(isShownExpiry(near, 'next'), false);
  assert.equal(isShownExpiry(near, '2026-10-14'), false);
});
