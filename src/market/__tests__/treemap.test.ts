import assert from 'node:assert/strict';
import {test} from 'node:test';

import {mulberry32} from '../sampling.ts';
import {treemap, type TreemapRect} from '../treemap.ts';

// The app's treemap before this port (finstocks-mobile src/shared/charts/utils/treemap.ts at main
// 9be68e10), kept verbatim as the reference: it copies the row and rescans it for its sum, max and
// min at every step, which is quadratic in a long row. The one-pass version must lay out the same.
const oldTotal = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0);

const oldWorstRatio = (row: readonly number[], side: number): number => {
  const sum = oldTotal(row);
  const max = Math.max(...row);
  const min = Math.min(...row);
  return Math.max(
    (side * side * max) / (sum * sum),
    (sum * sum) / (side * side * min),
  );
};

const oldLayoutRow = (
  row: readonly number[],
  bounds: TreemapRect,
): {readonly rects: TreemapRect[]; readonly remaining: TreemapRect} => {
  const sum = oldTotal(row);
  const rects: TreemapRect[] = [];
  if (bounds.w >= bounds.h) {
    const colWidth = sum / bounds.h;
    let offsetY = bounds.y;
    for (const value of row) {
      const h = (value / sum) * bounds.h;
      rects.push({x: bounds.x, y: offsetY, w: colWidth, h});
      offsetY += h;
    }
    return {
      rects,
      remaining: {
        x: bounds.x + colWidth,
        y: bounds.y,
        w: bounds.w - colWidth,
        h: bounds.h,
      },
    };
  }
  const rowHeight = sum / bounds.w;
  let offsetX = bounds.x;
  for (const value of row) {
    const w = (value / sum) * bounds.w;
    rects.push({x: offsetX, y: bounds.y, w, h: rowHeight});
    offsetX += w;
  }
  return {
    rects,
    remaining: {
      x: bounds.x,
      y: bounds.y + rowHeight,
      w: bounds.w,
      h: bounds.h - rowHeight,
    },
  };
};

const oldSquarify = (
  values: readonly number[],
  bounds: TreemapRect,
): TreemapRect[] => {
  const result: TreemapRect[] = [];
  let remaining = bounds;
  let row: number[] = [];
  let index = 0;
  while (index < values.length) {
    const next = values[index] ?? 0;
    const side = Math.min(remaining.w, remaining.h);
    const candidate = [...row, next];
    if (
      row.length === 0 ||
      oldWorstRatio(row, side) >= oldWorstRatio(candidate, side)
    ) {
      row = candidate;
      index += 1;
      continue;
    }
    const laid = oldLayoutRow(row, remaining);
    result.push(...laid.rects);
    remaining = laid.remaining;
    row = [];
  }
  if (row.length > 0) result.push(...oldLayoutRow(row, remaining).rects);
  return result;
};

function oldTreemap<T>(
  items: readonly {readonly value: number; readonly data: T}[],
  bounds: TreemapRect,
): (TreemapRect & {readonly data: T})[] {
  const positive = items.filter(item => item.value > 0);
  const sum = positive.reduce((acc, item) => acc + item.value, 0);
  if (sum <= 0 || bounds.w <= 0 || bounds.h <= 0) return [];
  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const area = bounds.w * bounds.h;
  const rects = oldSquarify(
    sorted.map(item => (item.value / sum) * area),
    bounds,
  );
  return rects.flatMap((rect, i) => {
    const item = sorted[i];
    return item === undefined ? [] : [{...rect, data: item.data}];
  });
}

const items = (values: readonly number[]) =>
  values.map((value, i) => ({value, data: `s${i}`}));

const random = mulberry32(20261021);
// A market's shape: a few giants, a long tail spanning four orders of magnitude.
const marketLike = Array.from({length: 500}, () => 10 ** (random() * 4 + 1));
const FIXTURES: Record<string, readonly number[]> = {
  'the skeleton weights': [27, 12, 10, 8, 7, 7, 6, 6, 5, 4, 4, 2, 2],
  'a market of 500': marketLike,
  'ties and equal weights': Array.from({length: 64}, (_, i) => (i % 3) + 1),
  'one stock': [42],
  'zero and negative weights': [5, 0, -3, 2, 0, 1],
  'a single dominant stock': [1000, 1, 1, 1, 1, 1, 1],
  'equal weights only': Array.from({length: 2000}, () => 1),
};
const BOUNDS: Record<string, TreemapRect> = {
  phone: {x: 0, y: 0, w: 368, h: 543},
  wide: {x: 10, y: 5, w: 1200, h: 300},
  square: {x: 0, y: 0, w: 100, h: 100},
};

test('the one-pass treemap lays out exactly what the old copy-and-rescan algorithm did', () => {
  for (const [fixture, values] of Object.entries(FIXTURES)) {
    for (const [box, bounds] of Object.entries(BOUNDS)) {
      assert.deepEqual(
        treemap(items(values), bounds),
        oldTreemap(items(values), bounds),
        `${fixture} in the ${box} box`,
      );
    }
  }
});

test('tile areas are in proportion to the weights and fill the bounds exactly', () => {
  for (const [fixture, values] of Object.entries(FIXTURES)) {
    for (const [box, bounds] of Object.entries(BOUNDS)) {
      const rects = treemap(items(values), bounds);
      const positive = values.filter(v => v > 0);
      const total = positive.reduce((a, v) => a + v, 0);
      const area = bounds.w * bounds.h;
      assert.equal(rects.length, positive.length, `${fixture}/${box} count`);
      for (const r of rects) {
        const weight = values[Number(r.data.slice(1))] ?? 0;
        const share = (r.w * r.h) / area;
        assert.ok(
          Math.abs(share - weight / total) < 1e-9,
          `${fixture}/${box} ${r.data} area`,
        );
        assert.ok(r.x >= bounds.x - 1e-6 && r.y >= bounds.y - 1e-6);
        assert.ok(r.x + r.w <= bounds.x + bounds.w + 1e-6);
        assert.ok(r.y + r.h <= bounds.y + bounds.h + 1e-6);
      }
      const covered = rects.reduce((a, r) => a + r.w * r.h, 0);
      assert.ok(Math.abs(covered - area) < area * 1e-9, `${fixture}/${box}`);
    }
  }
});

test('tiles never overlap', () => {
  const rects = treemap(items(FIXTURES['the skeleton weights'] ?? []), {
    x: 0,
    y: 0,
    w: 368,
    h: 543,
  });
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      if (!a || !b) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(ox <= 1e-6 || oy <= 1e-6, `${a.data} overlaps ${b.data}`);
    }
  }
});

test('largest first, ties in input order, and nothing but positive finite weights get a tile', () => {
  const rects = treemap(
    [
      {value: 1, data: 'small'},
      {value: 3, data: 'large'},
      {value: 3, data: 'large-too'},
      {value: 0, data: 'zero'},
      {value: -1, data: 'negative'},
      {value: Number.NaN, data: 'nan'},
      {value: Number.POSITIVE_INFINITY, data: 'infinite'},
    ],
    {x: 0, y: 0, w: 40, h: 10},
  );
  assert.deepEqual(
    rects.map(r => r.data),
    ['large', 'large-too', 'small'],
  );
});

test('an empty, all-zero or boxless input lays out nothing', () => {
  const box = {x: 0, y: 0, w: 10, h: 10};
  assert.deepEqual(treemap([], box), []);
  assert.deepEqual(treemap(items([0, 0]), box), []);
  assert.deepEqual(treemap(items([1, 2]), {x: 0, y: 0, w: 0, h: 10}), []);
  assert.deepEqual(treemap(items([1, 2]), {x: 0, y: 0, w: 10, h: -1}), []);
});
