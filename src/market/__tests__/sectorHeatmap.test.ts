import assert from 'node:assert/strict';
import {test} from 'node:test';

import {colorDark, colorLight} from '../../tokens/index.ts';
import type {IndustryNode, IndustryTree} from '../../types/industries.ts';
import type {Mover} from '../../types/market.ts';
import {
  breadthOf,
  buildHeatModel,
  FOLD_PREFIX,
  foldTail,
  HEAT_COLUMNS,
  HEAT_FAST_COLUMNS,
  HEAT_PERIODS,
  heatBin,
  heatBreadth,
  heatPalette,
  heatStep,
  heatThresholdLabels,
  heatThresholds,
  heatWeights,
  isListSource,
  layoutHeat,
  MARKET_SOURCES,
  neighbourTile,
  periodOf,
  SECTOR_SHORT,
  sectorOfIndustry,
  swatchFor,
  UNMAPPED_SECTOR,
  type HeatColorBy,
  type HeatLayoutItem,
  type HeatPeriod,
  type HeatRow,
} from '../sectorHeatmap.ts';

const node = (
  id: string,
  name: string,
  level: number,
  children?: IndustryNode[],
): IndustryNode => ({
  id,
  name,
  level,
  count: 0,
  ...(children ? {children} : {}),
});

// The backend's shape: 0 macro sector, 1 sector, 2 industry, 3 the vendor industry.
const TREE: IndustryTree = {
  total: 0,
  nodes: [
    node('financial-services', 'Financial Services', 0, [
      node('financial-services/financial-services', 'Financial Services', 1, [
        node('financial-services/financial-services/banks', 'Banks', 2, [
          node('fs/banks/private', 'Bank - Private', 3),
          node('fs/banks/public', 'Bank - Public', 3),
        ]),
      ]),
    ]),
    node('information-technology', 'Information Technology', 0, [
      node(
        'information-technology/information-technology',
        'Information Technology',
        1,
        [
          node('it/it/software', 'IT - Software', 2, [
            node(
              'it/it/software/consulting',
              'Computers - Software & Consulting',
              3,
            ),
          ]),
        ],
      ),
    ]),
    node('energy', 'Energy', 0, [
      node(
        'energy/oil-gas-consumable-fuels',
        'Oil, Gas & Consumable Fuels',
        1,
        [
          node('energy/oil/petroleum', 'Petroleum Products', 2, [
            node('energy/oil/petroleum/refineries', 'Refineries', 3),
          ]),
        ],
      ),
    ]),
  ],
};

const FIN = {
  id: 'financial-services/financial-services',
  name: 'Financial Services',
};
const IT = {
  id: 'information-technology/information-technology',
  name: 'Information Technology',
};

const row = (
  symbol: string,
  industry: string,
  values: HeatRow['values'],
): HeatRow => ({symbol, name: `${symbol} Ltd`, industry, values});

const ROWS: HeatRow[] = [
  row('ICICIBANK', 'Bank - Private', {
    market_cap: 900_000,
    price: 1400,
    volume: 2000,
    return_1d: -1,
  }),
  row('HDFCBANK', 'Bank - Private', {
    market_cap: 1_500_000,
    price: 1600,
    volume: 1000,
    return_1d: 1,
    return_1w: 2,
  }),
  row('SBIN', 'Bank - Public', {market_cap: 700_000, price: 800}),
  row('TCS', 'Computers - Software & Consulting', {
    market_cap: 1_200_000,
    return_1d: 0.5,
  }),
  row('MYSTERY', 'Unknown Widgets', {market_cap: 10, return_1d: 3}),
  row('ZEROCAP', 'Bank - Private', {market_cap: 0, return_1d: 9}),
  row('NEGCAP', 'Bank - Private', {market_cap: -5}),
  row('NOCAP', 'Bank - Private', {return_1d: 1}),
  row('NANCAP', 'Bank - Private', {market_cap: Number.NaN}),
  row('HDFCBANK', 'IT - Software', {market_cap: 9_999_999, return_1d: -9}),
];

test('every industry at levels 2 and 3 maps to its level-1 sector; macro and sector names do not', () => {
  const sectors = sectorOfIndustry(TREE);
  assert.deepEqual(sectors.get('Bank - Private'), FIN);
  assert.deepEqual(sectors.get('Bank - Public'), FIN);
  assert.deepEqual(sectors.get('Banks'), FIN);
  assert.deepEqual(sectors.get('IT - Software'), IT);
  assert.deepEqual(sectors.get('Computers - Software & Consulting'), IT);
  assert.equal(sectors.get('Financial Services'), undefined);
  assert.equal(sectors.get('Energy'), undefined);
  assert.equal(sectors.size, 7);

  const model = buildHeatModel(ROWS, TREE, 'top500');
  assert.equal(model.stockBySymbol.get('HDFCBANK')?.sectorId, FIN.id);
  assert.equal(model.stockBySymbol.get('TCS')?.sectorId, IT.id);
  assert.equal(model.sectorById.get(FIN.id)?.name, 'Financial Services');
  assert.equal(model.sectorById.get(FIN.id)?.short, 'Financials');
  assert.equal(model.sectorById.get(IT.id)?.short, 'IT');
});

test('a name filed at both levels 2 and 3 maps to the level-3 sector whichever comes first', () => {
  const capitalGoods = node('industrials', 'Industrials', 0, [
    node('industrials/capital-goods', 'Capital Goods', 1, [
      node('industrials/capital-goods/machinery', 'Industrial Products', 2, [
        node('ind/cg/machinery/others', 'Others', 3),
        node('ind/cg/machinery/trading', 'Trading', 3),
      ]),
    ]),
  ]);
  const diversified = node('diversified', 'Diversified', 0, [
    node('diversified/diversified', 'Diversified', 1, [
      node('diversified/diversified/others', 'Others', 2, [
        node('div/div/others/trading', 'Trading', 3),
      ]),
    ]),
  ]);
  for (const nodes of [
    [capitalGoods, diversified],
    [diversified, capitalGoods],
  ]) {
    const sectors = sectorOfIndustry({total: 0, nodes});
    assert.equal(sectors.get('Others')?.id, 'industrials/capital-goods');
  }
  // Two nodes of one level: the first in tree order holds the name.
  assert.equal(
    sectorOfIndustry({total: 0, nodes: [capitalGoods, diversified]}).get(
      'Trading',
    )?.id,
    'industrials/capital-goods',
  );
  assert.equal(
    sectorOfIndustry({total: 0, nodes: [diversified, capitalGoods]}).get(
      'Trading',
    )?.id,
    'diversified/diversified',
  );
  // The same tree always maps the same way.
  const once = [
    ...sectorOfIndustry({total: 0, nodes: [diversified, capitalGoods]}),
  ];
  const again = [
    ...sectorOfIndustry({total: 0, nodes: [diversified, capitalGoods]}),
  ];
  assert.deepEqual(once, again);
});

test('industry names match with their runs of whitespace collapsed', () => {
  const model = buildHeatModel(
    [row('HDFCBANK', '  Bank  -   Private ', {market_cap: 1})],
    TREE,
    'nifty50',
  );
  assert.equal(model.stockBySymbol.get('HDFCBANK')?.sectorId, FIN.id);
  assert.equal(
    model.stockBySymbol.get('HDFCBANK')?.industry,
    '  Bank  -   Private ',
  );
});

test("a sector's return is market-cap weighted over the members that have the period", () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  const fin = model.sectorById.get(FIN.id);
  assert.ok(fin);
  // SBIN has no 1D figure: (1.5M × 1 + 0.9M × −1) / 2.4M.
  assert.equal(fin.returns['1d'], 0.25);
  // Only HDFCBANK has a week.
  assert.equal(fin.returns['1w'], 2);
  assert.equal(fin.returns['1y'], null);
  assert.equal(fin.mcap, 3_100_000);
  assert.equal(fin.turnover, 1600 * 1000 + 1400 * 2000);
  assert.deepEqual(
    fin.stocks.map(s => s.symbol),
    ['HDFCBANK', 'ICICIBANK', 'SBIN'],
  );
  const sbin = model.stockBySymbol.get('SBIN');
  assert.equal(sbin?.turnover, 0);
  assert.equal(sbin?.volume, null);
  assert.equal(sbin?.price, 800);
  assert.deepEqual(sbin?.returns, {
    '1d': null,
    '1w': null,
    '1m': null,
    '3m': null,
    '1y': null,
  });
});

test('a row without a positive market cap, and a symbol seen before, are dropped', () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  for (const gone of ['ZEROCAP', 'NEGCAP', 'NOCAP', 'NANCAP']) {
    assert.equal(model.stockBySymbol.has(gone), false, gone);
  }
  // The first HDFCBANK stands; the later one (another industry, a bigger cap) is ignored.
  assert.equal(model.stockBySymbol.get('HDFCBANK')?.mcap, 1_500_000);
  assert.equal(model.stockBySymbol.get('HDFCBANK')?.returns['1d'], 1);
  assert.equal(model.stockBySymbol.size, 5);
});

test('an industry the tree does not know files under Other, and a missing tree files everything there', () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  const other = model.sectorById.get('other');
  assert.deepEqual(UNMAPPED_SECTOR, {id: 'other', name: 'Other'});
  assert.equal(other?.name, 'Other');
  assert.equal(other?.short, 'Other');
  assert.deepEqual(
    other?.stocks.map(s => s.symbol),
    ['MYSTERY'],
  );
  assert.deepEqual(
    model.sectors.map(s => s.id),
    [FIN.id, IT.id, 'other'],
  );

  const blind = buildHeatModel(ROWS, {total: 0, nodes: []}, 'top500');
  assert.deepEqual(
    blind.sectors.map(s => s.id),
    ['other'],
  );
  assert.equal(blind.sectors[0]?.stocks.length, 5);
});

test('the signature is the source and the sorted members, and only membership moves it', () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  assert.equal(model.signature, 'top500|HDFCBANK,ICICIBANK,MYSTERY,SBIN,TCS');
  const refreshed = buildHeatModel(
    ROWS.map(r => ({...r, values: {...r.values, return_1d: 4, price: 1}})),
    TREE,
    'top500',
  );
  assert.equal(refreshed.signature, model.signature);
  assert.equal(
    buildHeatModel(ROWS.slice(1), TREE, 'top500').signature,
    'top500|HDFCBANK,MYSTERY,SBIN,TCS',
  );
  assert.equal(
    buildHeatModel(ROWS, TREE, 'nifty50').signature,
    'nifty50|HDFCBANK,ICICIBANK,MYSTERY,SBIN,TCS',
  );
});

test('weights by size choice, and the same weights back while membership and choice hold', () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  const mcap = heatWeights(model, 'mcap');
  assert.equal(mcap.key, `${model.signature}|mcap`);
  assert.equal(mcap.stock.get('HDFCBANK'), 1_500_000);
  assert.equal(mcap.sector.get(FIN.id), 3_100_000);
  assert.deepEqual(mcap.members.get(FIN.id), ['HDFCBANK', 'ICICIBANK', 'SBIN']);
  assert.deepEqual([...mcap.members.keys()], [FIN.id, IT.id, 'other']);

  const turnover = heatWeights(model, 'turnover');
  assert.equal(turnover.stock.get('HDFCBANK'), 1_600_000);
  assert.equal(turnover.stock.get('SBIN'), 0);
  assert.equal(turnover.sector.get(FIN.id), 4_400_000);

  const equal = heatWeights(model, 'equal');
  assert.equal(equal.stock.get('TCS'), 1);
  assert.equal(equal.sector.get(FIN.id), 3);

  const refreshed = buildHeatModel(
    ROWS.map(r => ({...r, values: {...r.values, volume: 1}})),
    TREE,
    'top500',
  );
  assert.equal(heatWeights(refreshed, 'turnover', turnover), turnover);
  assert.notEqual(heatWeights(refreshed, 'mcap', turnover), turnover);
  const smaller = buildHeatModel(ROWS.slice(1), TREE, 'top500');
  assert.notEqual(heatWeights(smaller, 'turnover', turnover), turnover);
});

test("a sector's breadth counts any move off zero; the map's counts a move that prints as one", () => {
  const model = buildHeatModel(ROWS, TREE, 'top500');
  const fin = model.sectorById.get(FIN.id);
  assert.ok(fin);
  assert.deepEqual(breadthOf(fin, '1d'), {up: 1, down: 1});
  assert.deepEqual(breadthOf(fin, '1y'), {up: 0, down: 0});

  const stocks = [0.005, 0.0049, -0.0049, -0.005, null, 2].map((r, i) => ({
    ...(model.stockBySymbol.get('TCS') ?? assert.fail('TCS')),
    symbol: `S${i}`,
    mcap: 100,
    returns: {'1d': r, '1w': null, '1m': null, '3m': null, '1y': null},
  }));
  const breadth = heatBreadth(stocks, '1d');
  assert.equal(breadth.up, 2);
  assert.equal(breadth.down, 1);
  assert.equal(breadth.flat, 2);
  // Equal caps: the plain mean of the five known moves.
  assert.ok(Math.abs((breadth.average ?? NaN) - 0.4) < 1e-12);
  assert.deepEqual(heatBreadth(stocks, '1y'), {
    up: 0,
    down: 0,
    flat: 0,
    average: null,
  });
});

// §2.5 of the market map spec: the legend's figures for every period, by change and against the average.
const LEGEND: Record<HeatPeriod, Record<HeatColorBy, string>> = {
  '1d': {change: '−2% −1% 0 +1% +2%', relative: '−1% −0.5% 0 +0.5% +1%'},
  '1w': {change: '−4% −2% 0 +2% +4%', relative: '−2% −1% 0 +1% +2%'},
  '1m': {change: '−10% −5% 0 +5% +10%', relative: '−5% −2.5% 0 +2.5% +5%'},
  '3m': {change: '−20% −10% 0 +10% +20%', relative: '−10% −5% 0 +5% +10%'},
  '1y': {change: '−40% −20% 0 +20% +40%', relative: '−20% −10% 0 +10% +20%'},
};

test('the legend prints the spec figures for every period and colour mode', () => {
  assert.deepEqual(
    HEAT_PERIODS.map(p => [p.value, p.step]),
    [
      ['1d', 1],
      ['1w', 2],
      ['1m', 5],
      ['3m', 10],
      ['1y', 20],
    ],
  );
  for (const p of HEAT_PERIODS) {
    for (const mode of ['change', 'relative'] as const) {
      assert.equal(
        heatThresholdLabels(heatStep(p.value, mode)).join(' '),
        LEGEND[p.value][mode],
        `${p.value} ${mode}`,
      );
    }
  }
  // The minus is U+2212, not a hyphen.
  assert.equal(heatThresholdLabels(1)[0]?.codePointAt(0), 0x2212);
  assert.deepEqual(heatThresholds(1), [-2, -1, 0, 1, 2]);
});

test('bins split at 0.005, one step and two steps, either side, for every period and mode', () => {
  for (const p of HEAT_PERIODS) {
    for (const mode of ['change', 'relative'] as const) {
      const step = heatStep(p.value, mode);
      const at = `${p.value} ${mode}`;
      assert.equal(heatBin(0.0049, step), null, at);
      assert.equal(heatBin(-0.0049, step), null, at);
      assert.equal(heatBin(0, step), null, at);
      assert.equal(heatBin(0.005, step), 3, at);
      assert.equal(heatBin(-0.005, step), 2, at);
      assert.equal(heatBin(step * 0.999, step), 3, at);
      assert.equal(heatBin(-step * 0.999, step), 2, at);
      assert.equal(heatBin(step, step), 4, at);
      assert.equal(heatBin(-step, step), 1, at);
      assert.equal(heatBin(2 * step * 0.999, step), 4, at);
      assert.equal(heatBin(2 * step, step), 5, at);
      assert.equal(heatBin(-2 * step, step), 0, at);
      assert.equal(heatBin(100 * step, step), 5, at);
      assert.equal(heatBin(-100 * step, step), 0, at);
    }
  }
  assert.equal(heatBin(null, 1), null);
  assert.equal(heatBin(Number.NaN, 1), null);
});

const themeOf = (c: typeof colorLight | typeof colorDark) => ({
  surface: c.surface.card,
  profit: c.pl.profit,
  loss: c.pl.loss,
  ink: c.ink.primary,
  inverseInk: c.ink.inverse,
  neutral: c.ink.muted,
});

test("the palette mixes the theme's tokens and picks the ink that contrasts more", () => {
  // The spec's table (§2.5), computed from web's tokens, which core's tokens equal.
  const light = heatPalette(themeOf(colorLight));
  assert.deepEqual(
    light.bins.map(b => `${b.fill}/${b.ink}`),
    [
      '#bd4f45/#ffffff',
      '#d7948f/#000000',
      '#edcecb/#000000',
      '#c7ddd3/#000000',
      '#86b59f/#000000',
      '#378461/#000000',
    ],
  );
  assert.deepEqual(light.flat, {fill: '#ededed', ink: '#000000'});

  const dark = heatPalette(themeOf(colorDark));
  assert.deepEqual(
    dark.bins.map(b => `${b.fill}/${b.ink}`),
    [
      '#d27a73/#0a0b0d',
      '#86504d/#f0f1f2',
      '#462e2e/#f0f1f2',
      '#194034/#f0f1f2',
      '#237659/#f0f1f2',
      '#2fb886/#0a0b0d',
    ],
  );
  assert.deepEqual(dark.flat, {fill: '#1c1e21', ink: '#f0f1f2'});

  // Shorthand hex reads like the long form, and the ink follows the fill, not the theme.
  const plain = heatPalette({
    surface: '#fff',
    profit: '#000',
    loss: '#000',
    ink: '#000',
    inverseInk: '#fff',
    neutral: '#000',
  });
  assert.equal(plain.bins[0]?.fill, '#242424');
  assert.equal(plain.bins[0]?.ink, '#ffffff');
  assert.equal(plain.bins[2]?.fill, '#c2c2c2');
  assert.equal(plain.bins[2]?.ink, '#000000');
});

test('a move paints with its bin, and a flat or unknown one with the flat swatch', () => {
  const palette = heatPalette(themeOf(colorLight));
  assert.equal(swatchFor(palette, 2.5, 1), palette.bins[5]);
  assert.equal(swatchFor(palette, -0.4, 1), palette.bins[2]);
  assert.equal(swatchFor(palette, 0.001, 1), palette.flat);
  assert.equal(swatchFor(palette, null, 1), palette.flat);
});

const tiny = (n: number, group?: string): HeatLayoutItem[] =>
  Array.from({length: n}, (_, i) => ({
    id: `${group ?? 'x'}${i}`,
    weight: n - i,
    ...(group ? {group} : {}),
  }));

test('foldTail keeps the 2 largest of a group, folds the rest, and caps the stand-in at 20%', () => {
  // 10..1 over a 10 × 10 box: every tile is far under 900 px².
  const {items, folded} = foldTail(tiny(10), 10, 10, 900);
  assert.deepEqual(
    items.map(it => it.id),
    ['x0', 'x1', FOLD_PREFIX],
  );
  // The tail weighs 36 of 55; the stand-in is held to a fifth of the group.
  assert.equal(items[2]?.weight, 11);
  assert.equal(items[2]?.group, undefined);
  assert.deepEqual(folded.get(FOLD_PREFIX), [
    'x2',
    'x3',
    'x4',
    'x5',
    'x6',
    'x7',
    'x8',
    'x9',
  ]);
});

test('foldTail folds per group, keeps tiles big enough to print, and does not cap a light tail', () => {
  const items: HeatLayoutItem[] = [
    {id: 'A', weight: 1000, group: 'fin'},
    {id: 'B', weight: 900, group: 'fin'},
    {id: 'C', weight: 800, group: 'fin'},
    {id: 'D', weight: 1, group: 'fin'},
    {id: 'E', weight: 2, group: 'fin'},
    {id: 'F', weight: 500, group: 'it'},
  ];
  // 3203 weight over 400 × 400: C prints (≈ 40,000 px²), D and E do not.
  const out = foldTail(items, 400, 400, 900);
  assert.deepEqual(
    out.items.map(it => `${it.id}:${it.weight}:${it.group ?? ''}`),
    ['A:1000:fin', 'B:900:fin', 'C:800:fin', '__more:fin:3:fin', 'F:500:it'],
  );
  assert.deepEqual(out.folded.get('__more:fin'), ['E', 'D']);
  assert.equal(out.folded.size, 1);
});

test('foldTail never folds a kept id, and folds nothing when fewer than 2 would go', () => {
  const kept = foldTail(tiny(10), 10, 10, 900, new Set(['x9', 'x4']));
  assert.deepEqual(
    kept.items.map(it => it.id),
    ['x0', 'x1', 'x4', 'x9', FOLD_PREFIX],
  );
  assert.deepEqual(kept.folded.get(FOLD_PREFIX), [
    'x2',
    'x3',
    'x5',
    'x6',
    'x7',
    'x8',
  ]);

  // Keeping all but one of the tail leaves a single tile to fold: nothing folds.
  const single = foldTail(tiny(4), 10, 10, 900, new Set(['x2']));
  assert.deepEqual(
    single.items.map(it => it.id),
    ['x0', 'x1', 'x2', 'x3'],
  );
  assert.equal(single.folded.size, 0);

  // Three stocks: the 2 largest always stay, so one at most could fold.
  const three = foldTail(tiny(3), 10, 10, 900);
  assert.equal(three.folded.size, 0);
  assert.equal(three.items.length, 3);

  // No area to estimate from: the items come back as given.
  assert.deepEqual(foldTail(tiny(5), 0, 10, 900).items, tiny(5));
  assert.equal(foldTail(tiny(5), 0, 10, 900).folded.size, 0);
});

test('layoutHeat packs one treemap, or a frame per group with a header when it fits', () => {
  const flat = layoutHeat(
    [
      {id: 'a', weight: 3},
      {id: 'b', weight: 1},
      {id: 'zero', weight: 0},
    ],
    40,
    10,
  );
  assert.deepEqual(flat.frames, []);
  assert.deepEqual(
    flat.tiles.map(t => [t.id, t.w * t.h]),
    [
      ['a', 300],
      ['b', 100],
    ],
  );

  const nested = layoutHeat(
    [
      {id: 'big1', weight: 60, group: 'fin'},
      {id: 'big2', weight: 30, group: 'fin'},
      {id: 'small', weight: 1, group: 'it'},
    ],
    300,
    200,
  );
  const fin = nested.frames.find(f => f.id === 'fin');
  const it = nested.frames.find(f => f.id === 'it');
  assert.ok(fin && it);
  assert.equal(fin.headerHeight, 15);
  // 1/91 of 300 × 200 is a sliver too thin for a header.
  assert.equal(it.headerHeight, 0);
  for (const tile of nested.tiles) {
    const frame = tile.id === 'small' ? it : fin;
    assert.ok(tile.x >= frame.x + 1 - 1e-9);
    assert.ok(tile.x + tile.w <= frame.x + frame.w - 1 + 1e-9);
    assert.ok(tile.y >= frame.y + frame.headerHeight - 1e-9);
    assert.ok(tile.y + tile.h <= frame.y + frame.h - 1 + 1e-9);
  }
  const area = (id: string) => {
    const t = nested.tiles.find(x => x.id === id);
    return t ? t.w * t.h : NaN;
  };
  assert.ok(Math.abs(area('big1') / area('big2') - 2) < 1e-9);
});

test('an arrow key moves to the nearest overlapping tile that side, and stays at the edge', () => {
  const tiles = [
    {id: 'tl', x: 0, y: 0, w: 10, h: 10},
    {id: 'tr', x: 10, y: 0, w: 10, h: 10},
    {id: 'bl', x: 0, y: 10, w: 10, h: 10},
    {id: 'br', x: 10, y: 10, w: 10, h: 10},
  ];
  assert.equal(neighbourTile(tiles, 0, 'right'), 1);
  assert.equal(neighbourTile(tiles, 0, 'down'), 2);
  assert.equal(neighbourTile(tiles, 3, 'up'), 1);
  assert.equal(neighbourTile(tiles, 3, 'left'), 2);
  assert.equal(neighbourTile(tiles, 0, 'left'), 0);
  assert.equal(neighbourTile(tiles, 9, 'left'), 0);
  assert.equal(neighbourTile([], 0, 'left'), -1);
});

test("the choices are web's: sources without micro, period fallback, columns", () => {
  assert.deepEqual(
    MARKET_SOURCES.map(s => s.value),
    [
      'watchlist',
      'holdings',
      'nifty50',
      'fno',
      'large',
      'mid',
      'small',
      'top500',
      'all',
    ],
  );
  assert.equal(isListSource('watchlist'), true);
  assert.equal(isListSource('holdings'), true);
  assert.equal(isListSource('top500'), false);
  assert.equal(periodOf('1m').basis, 'change over 21 sessions');
  assert.equal(periodOf('5y' as HeatPeriod).value, '1d');
  assert.deepEqual(HEAT_COLUMNS, [
    'price',
    'market_cap',
    'volume',
    'return_1d',
    'return_1w',
    'return_1m',
    'return_3m',
    'return_1y',
  ]);
  assert.deepEqual(HEAT_FAST_COLUMNS, ['price', 'market_cap', 'return_1d']);
  assert.equal(SECTOR_SHORT['Oil, Gas & Consumable Fuels'], 'Oil & Gas');
  assert.equal(Object.keys(SECTOR_SHORT).length, 13);
});

test('a mover with its sector and market cap maps like a screener row', () => {
  const movers: Mover[] = [
    {
      symbol: 'HDFCBANK',
      last: 1600,
      change_pct: 1,
      sector: 'Bank  -  Private',
      market_cap: 1_500_000,
    },
    {symbol: 'OLD', last: 1, change_pct: 0},
    {symbol: 'NULLS', last: 1, change_pct: 0, sector: null, market_cap: null},
  ];
  const model = buildHeatModel(
    movers.map(m => ({
      symbol: m.symbol,
      name: m.symbol,
      industry: m.sector ?? '',
      values: {market_cap: m.market_cap ?? undefined, return_1d: m.change_pct},
    })),
    TREE,
    'nifty50',
  );
  assert.deepEqual([...model.stockBySymbol.keys()], ['HDFCBANK']);
  assert.equal(model.sectors[0]?.short, 'Financials');
});
