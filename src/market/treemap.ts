/** A box in the treemap's own units: the bounds it was given, or one tile of them. */
export interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Values arrive largest first, so a row's largest is its first and its smallest its last.
const worstRatio = (
  sum: number,
  max: number,
  min: number,
  side: number,
): number =>
  Math.max(
    (side * side * max) / (sum * sum),
    (sum * sum) / (side * side * min),
  );

const layoutRow = (
  values: readonly number[],
  from: number,
  to: number,
  sum: number,
  bounds: TreemapRect,
  out: TreemapRect[],
): TreemapRect => {
  if (bounds.w >= bounds.h) {
    const colWidth = sum / bounds.h;
    let offsetY = bounds.y;
    for (let i = from; i < to; i++) {
      const h = ((values[i] ?? 0) / sum) * bounds.h;
      out.push({x: bounds.x, y: offsetY, w: colWidth, h});
      offsetY += h;
    }
    return {
      x: bounds.x + colWidth,
      y: bounds.y,
      w: bounds.w - colWidth,
      h: bounds.h,
    };
  }
  const rowHeight = sum / bounds.w;
  let offsetX = bounds.x;
  for (let i = from; i < to; i++) {
    const w = ((values[i] ?? 0) / sum) * bounds.w;
    out.push({x: offsetX, y: bounds.y, w, h: rowHeight});
    offsetX += w;
  }
  return {
    x: bounds.x,
    y: bounds.y + rowHeight,
    w: bounds.w,
    h: bounds.h - rowHeight,
  };
};

/**
 * Squarified treemap (Bruls/Huizing/van Wijk) over pre-scaled values, largest first, whose sum is
 * the bounds' area. One pass with a running row sum: a row is never copied or rescanned, so a
 * 2,000-stock map lays out in linear time. It adds a row's values in the same order a fresh sum
 * would, so its rects are the same, to the bit, as the copy-and-rescan version's.
 */
const squarify = (
  values: readonly number[],
  bounds: TreemapRect,
): TreemapRect[] => {
  const result: TreemapRect[] = [];
  let remaining = bounds;
  let from = 0;
  let sum = 0;
  for (let i = 0; i < values.length;) {
    const side = Math.min(remaining.w, remaining.h);
    const v = values[i] ?? 0;
    if (
      i === from ||
      worstRatio(sum, values[from] ?? 0, values[i - 1] ?? 0, side) >=
        worstRatio(sum + v, values[from] ?? 0, v, side)
    ) {
      sum += v;
      i++;
      continue;
    }
    remaining = layoutRow(values, from, i, sum, remaining, result);
    from = i;
    sum = 0;
  }
  if (from < values.length) {
    layoutRow(values, from, values.length, sum, remaining, result);
  }
  return result;
};

/**
 * Lays `items` out as a squarified treemap that fills `bounds` exactly, each tile's area in
 * proportion to its `value`, largest first (ties keep their input order). A value that is not a
 * positive finite number gets no tile; an empty or all-zero input, or empty bounds, gives [].
 */
export function treemap<T>(
  items: readonly {readonly value: number; readonly data: T}[],
  bounds: TreemapRect,
): (TreemapRect & {data: T})[] {
  const positive = items.filter(
    it => Number.isFinite(it.value) && it.value > 0,
  );
  const total = positive.reduce((a, it) => a + it.value, 0);
  if (!(total > 0) || !(bounds.w > 0) || !(bounds.h > 0)) return [];
  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const area = bounds.w * bounds.h;
  const rects = squarify(
    sorted.map(it => (it.value / total) * area),
    bounds,
  );
  return rects.flatMap((r, i) => {
    const item = sorted[i];
    return item === undefined ? [] : [{...r, data: item.data}];
  });
}
