import type {IndustryNode, IndustryTree} from '../types/industries.ts';
import type {ScreenRow} from '../types/screen.ts';
import {treemap, type TreemapRect} from './treemap.ts';

// The market map: every stock of a screener universe (or the reader's own list) as one tile,
// grouped by its NSE sector, sized by market cap, turnover or equally, and coloured by its move
// over a period. Ported from web dev's `utils/market/sectorHeatmap.ts` (596de0ec).

export type HeatPeriod = '1d' | '1w' | '1m' | '3m' | '1y';
export type HeatUniverse =
  'nifty50' | 'fno' | 'top500' | 'all' | 'large' | 'mid' | 'small';
export type HeatSizeBy = 'mcap' | 'turnover' | 'equal';

/** A screener universe, or the reader's own list of stocks. */
export type HeatSource = HeatUniverse | 'watchlist' | 'holdings';
export type HeatGroupBy = 'sector' | 'none';
/** `relative` colours a stock by how far it moved from its source's average; the printed figure stays its own move. */
export type HeatColorBy = 'change' | 'relative';

export interface HeatPeriodSpec {
  value: HeatPeriod;
  label: string;
  /** The screener column that carries the period's return, in percent. */
  column: string;
  /** The width of one colour bin, in percent: a day's ±1% is a month's ±5%. */
  step: number;
  /** How the server measures the period (backend handlers/news/screentechnicals.go). */
  basis: string;
}

const DAY_PERIOD: HeatPeriodSpec = {
  value: '1d',
  label: '1D',
  column: 'return_1d',
  step: 1,
  basis: '1-day change',
};

export const HEAT_PERIODS: readonly HeatPeriodSpec[] = [
  DAY_PERIOD,
  {
    value: '1w',
    label: '1W',
    column: 'return_1w',
    step: 2,
    basis: 'change over 5 sessions',
  },
  {
    value: '1m',
    label: '1M',
    column: 'return_1m',
    step: 5,
    basis: 'change over 21 sessions',
  },
  {
    value: '3m',
    label: '3M',
    column: 'return_3m',
    step: 10,
    basis: '3-month change',
  },
  {
    value: '1y',
    label: '1Y',
    column: 'return_1y',
    step: 20,
    basis: '1-year change',
  },
];

/** A period's spec; anything unknown (a stale stored choice) reads as 1D. */
export const periodOf = (period: HeatPeriod): HeatPeriodSpec =>
  HEAT_PERIODS.find(p => p.value === period) ?? DAY_PERIOD;

export interface HeatSourceOption {
  value: HeatSource;
  label: string;
  /** The family the picker files it under, printed as the row's trailing hint. */
  group: string;
}

/**
 * What the map can show. "top500" is the 500 largest by market cap, not the NSE's Nifty 500. The
 * server's `micro` universe (rank 501+) is not offered, as on web.
 */
export const MARKET_SOURCES: readonly HeatSourceOption[] = [
  {value: 'watchlist', label: 'My watchlist', group: 'Mine'},
  {value: 'holdings', label: 'My holdings', group: 'Mine'},
  {value: 'nifty50', label: 'Nifty 50', group: 'Index'},
  {value: 'fno', label: 'F&O stocks', group: 'Segment'},
  {value: 'large', label: 'Large cap', group: 'Size'},
  {value: 'mid', label: 'Mid cap', group: 'Size'},
  {value: 'small', label: 'Small cap', group: 'Size'},
  {value: 'top500', label: 'Top 500', group: 'Size'},
  {value: 'all', label: 'All stocks', group: 'Market'},
];

/** The reader's own lists are read by `symbols`; every other source by `universes`. */
export const isListSource = (
  source: HeatSource,
): source is 'watchlist' | 'holdings' =>
  source === 'watchlist' || source === 'holdings';

export const HEAT_GROUPS: readonly {value: HeatGroupBy; label: string}[] = [
  {value: 'sector', label: 'Sector'},
  {value: 'none', label: 'No group'},
];

/** `words` is how the footer names the choice. */
export const HEAT_COLORS: readonly {
  value: HeatColorBy;
  label: string;
  words: string;
}[] = [
  {value: 'change', label: 'Change', words: 'the move itself'},
  {
    value: 'relative',
    label: 'vs avg',
    words: "the move against the source's average",
  },
];

/** `words` is how the footer names the choice ("sized by …"). */
export const HEAT_SIZES: readonly {
  value: HeatSizeBy;
  label: string;
  words: string;
}[] = [
  {value: 'mcap', label: 'M-cap', words: 'market cap'},
  {value: 'turnover', label: 'Turnover', words: "the session's traded value"},
  {value: 'equal', label: 'Equal', words: 'equal weight'},
];

/** Every column the map reads: the full read, which waits on the server's daily bars. */
export const HEAT_COLUMNS: readonly string[] = [
  'price',
  'market_cap',
  'volume',
  ...HEAT_PERIODS.map(p => p.column),
];

/**
 * What the default view (1D, sized by market cap or equally) reads off the server's quote frame:
 * no daily bars, so it answers while those are still building.
 */
export const HEAT_FAST_COLUMNS: readonly string[] = [
  'price',
  'market_cap',
  'return_1d',
];

/** The NSE sector names are sentences; a tile has room for a word. Every other sector keeps its name. */
export const SECTOR_SHORT: Readonly<Record<string, string>> = {
  'Financial Services': 'Financials',
  'Oil, Gas & Consumable Fuels': 'Oil & Gas',
  'Information Technology': 'IT',
  'Automobile and Auto Components': 'Auto',
  'Fast Moving Consumer Goods': 'FMCG',
  Telecommunication: 'Telecom',
  'Metals & Mining': 'Metals',
  'Media, Entertainment & Publication': 'Media',
  'Consumer Durables': 'Durables',
  'Consumer Services': 'Cons. Svcs',
  'Construction Materials': 'Materials',
  'Capital Goods': 'Cap Goods',
  'Forest Materials': 'Forest',
};

/** Where a stock whose industry the tree does not know is filed. */
export const UNMAPPED_SECTOR: Readonly<HeatSectorRef> = {
  id: 'other',
  name: 'Other',
};

// The backend's tree levels are 0-based: 0 macro sector, 1 sector, 2 industry, 3 the vendor
// industry a company is filed under (backend handlers/news/industrytaxonomy.go).
const SECTOR_LEVEL = 1;

export interface HeatSectorRef {
  id: string;
  name: string;
}

export interface HeatStock {
  symbol: string;
  name: string;
  industry: string;
  sectorId: string;
  price: number | null;
  /** ₹ crore. */
  mcap: number;
  volume: number | null;
  /** ₹, the session's price × volume; 0 when either is missing. */
  turnover: number;
  /** Percent; null where the server has no figure for the period. */
  returns: Record<HeatPeriod, number | null>;
}

export interface HeatSector {
  id: string;
  name: string;
  /** The name a tile prints when the full one does not fit. */
  short: string;
  /** Largest market cap first. */
  stocks: HeatStock[];
  mcap: number;
  turnover: number;
  /** Market-cap weighted over the members that have the period. */
  returns: Record<HeatPeriod, number | null>;
}

export interface HeatModel {
  /** Largest market cap first. */
  sectors: HeatSector[];
  stockBySymbol: ReadonlyMap<string, HeatStock>;
  sectorById: ReadonlyMap<string, HeatSector>;
  /** `source|sorted symbols`: changes only when the membership does, so a price refresh keeps its layout. */
  signature: string;
}

/** What the model reads off a row: a screener row, or a mover shaped as one. */
export type HeatRow = Pick<
  ScreenRow,
  'symbol' | 'name' | 'industry' | 'values'
>;

// The feed spaces some industry names twice ("Diamond  &  Jewellery"); the tree does not.
const industryKey = (name: string): string => name.replace(/\s+/g, ' ').trim();

/**
 * Every industry name under a sector (levels 2 and 3), mapped to that level-1 sector. Names are
 * matched with their runs of whitespace collapsed.
 *
 * A name filed at both level 2 and level 3 maps to the level-3 node's sector, because a screener
 * row carries its vendor (level-3) industry; two nodes of one level keep the first in tree order.
 * Web lets the last node walked win, so its answer for such a name follows the tree's order.
 */
export function sectorOfIndustry(
  tree: IndustryTree,
): ReadonlyMap<string, HeatSectorRef> {
  const out = new Map<string, HeatSectorRef>();
  const levelOf = new Map<string, number>();
  const walk = (node: IndustryNode, sector: HeatSectorRef | null): void => {
    const own =
      node.level === SECTOR_LEVEL ? {id: node.id, name: node.name} : sector;
    if (own && node.level > SECTOR_LEVEL) {
      const key = industryKey(node.name);
      const held = levelOf.get(key);
      if (held === undefined || node.level > held) {
        out.set(key, own);
        levelOf.set(key, node.level);
      }
    }
    node.children?.forEach(child => {
      walk(child, own);
    });
  };
  tree.nodes.forEach(node => {
    walk(node, null);
  });
  return out;
}

const finite = (v: number | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const emptyReturns = (): Record<HeatPeriod, number | null> => ({
  '1d': null,
  '1w': null,
  '1m': null,
  '3m': null,
  '1y': null,
});

/** The market-cap weighted move over the stocks that have the period; null when none has. */
export function weightedReturn(
  stocks: Iterable<HeatStock>,
  period: HeatPeriod,
): number | null {
  let weight = 0;
  let sum = 0;
  for (const s of stocks) {
    const r = s.returns[period];
    if (r == null) continue;
    weight += s.mcap;
    sum += s.mcap * r;
  }
  return weight > 0 ? sum / weight : null;
}

/**
 * The map's model from one screener read and the industry tree. A row without a positive market
 * cap, or a symbol seen before, is dropped; an industry the tree does not know files under
 * "Other". Stocks are largest market cap first inside each sector, and sectors are too.
 */
export function buildHeatModel(
  rows: readonly HeatRow[],
  tree: IndustryTree,
  source: string,
): HeatModel {
  const sectorOf = sectorOfIndustry(tree);
  const sectorById = new Map<string, HeatSector>();
  const stockBySymbol = new Map<string, HeatStock>();

  for (const row of rows) {
    const mcap = finite(row.values.market_cap) ?? 0;
    if (mcap <= 0 || stockBySymbol.has(row.symbol)) continue;
    const sector = sectorOf.get(industryKey(row.industry)) ?? UNMAPPED_SECTOR;
    const price = finite(row.values.price);
    const volume = finite(row.values.volume);
    const returns = emptyReturns();
    for (const p of HEAT_PERIODS)
      returns[p.value] = finite(row.values[p.column]);
    const stock: HeatStock = {
      symbol: row.symbol,
      name: row.name,
      industry: row.industry,
      sectorId: sector.id,
      price,
      mcap,
      volume,
      turnover: price != null && volume != null ? price * volume : 0,
      returns,
    };
    stockBySymbol.set(stock.symbol, stock);
    let group = sectorById.get(sector.id);
    if (!group) {
      group = {
        id: sector.id,
        name: sector.name,
        short: SECTOR_SHORT[sector.name] ?? sector.name,
        stocks: [],
        mcap: 0,
        turnover: 0,
        returns: emptyReturns(),
      };
      sectorById.set(sector.id, group);
    }
    group.stocks.push(stock);
  }

  for (const sector of sectorById.values()) {
    sector.stocks.sort((a, b) => b.mcap - a.mcap);
    for (const s of sector.stocks) {
      sector.mcap += s.mcap;
      sector.turnover += s.turnover;
    }
    for (const p of HEAT_PERIODS) {
      sector.returns[p.value] = weightedReturn(sector.stocks, p.value);
    }
  }

  const sectors = [...sectorById.values()].sort((a, b) => b.mcap - a.mcap);
  const signature = `${source}|${[...stockBySymbol.keys()].sort().join(',')}`;
  return {sectors, stockBySymbol, sectorById, signature};
}

export const stockWeight = (stock: HeatStock, sizeBy: HeatSizeBy): number =>
  sizeBy === 'equal' ? 1 : sizeBy === 'turnover' ? stock.turnover : stock.mcap;

export const sectorWeight = (sector: HeatSector, sizeBy: HeatSizeBy): number =>
  sizeBy === 'equal'
    ? sector.stocks.length
    : sizeBy === 'turnover'
      ? sector.turnover
      : sector.mcap;

/** The tile sizes a layout is packed from. */
export interface HeatWeights {
  /** `signature|sizeBy`: the same key means the same packing. */
  key: string;
  stock: ReadonlyMap<string, number>;
  sector: ReadonlyMap<string, number>;
  /** Each sector's symbols, largest market cap first; sectors in that order too. */
  members: ReadonlyMap<string, readonly string[]>;
}

/**
 * The weights to pack the map with. Pass the weights last used as `previous`: while the
 * membership and the size choice hold, they come back unchanged, so a refresh (turnover moves with
 * every one) repaints colours but never re-packs the map under the reader.
 */
export function heatWeights(
  model: HeatModel,
  sizeBy: HeatSizeBy,
  previous?: HeatWeights | null,
): HeatWeights {
  const key = `${model.signature}|${sizeBy}`;
  if (previous?.key === key) return previous;
  const stock = new Map<string, number>();
  const sector = new Map<string, number>();
  const members = new Map<string, readonly string[]>();
  for (const s of model.sectors) {
    sector.set(s.id, sectorWeight(s, sizeBy));
    members.set(
      s.id,
      s.stocks.map(st => st.symbol),
    );
    for (const st of s.stocks) stock.set(st.symbol, stockWeight(st, sizeBy));
  }
  return {key, stock, sector, members};
}

/** Advancers and decliners in a sector over a period, for its tooltip; unknown moves are skipped. */
export function breadthOf(
  sector: HeatSector,
  period: HeatPeriod,
): {up: number; down: number} {
  let up = 0;
  let down = 0;
  for (const s of sector.stocks) {
    const r = s.returns[period];
    if (r == null) continue;
    if (r > 0) up++;
    else if (r < 0) down++;
  }
  return {up, down};
}

// A move that prints as 0.00% is flat: it takes neither side's colour, and counts as unchanged.
const FLAT_BELOW = 0.005;

export interface HeatBreadth {
  up: number;
  down: number;
  flat: number;
  /** Market-cap weighted over the stocks that have the period. */
  average: number | null;
}

/**
 * The status row's figures over every stock on the map: up at +0.005% or more, down at −0.005%
 * or less, flat between; unknown moves are skipped.
 */
export function heatBreadth(
  stocks: Iterable<HeatStock>,
  period: HeatPeriod,
): HeatBreadth {
  let up = 0;
  let down = 0;
  let flat = 0;
  const all = [...stocks];
  for (const s of all) {
    const r = s.returns[period];
    if (r == null) continue;
    if (r >= FLAT_BELOW) up++;
    else if (r <= -FLAT_BELOW) down++;
    else flat++;
  }
  return {up, down, flat, average: weightedReturn(all, period)};
}

// Six bins, three either side of zero, as the legend prints them: under one step, one to two, beyond two.
export const HEAT_BIN_COUNT = 6;
const HALF = HEAT_BIN_COUNT / 2;

/** The bin width in force: the period's step, halved when colouring by the move against the average. */
export const heatStep = (period: HeatPeriod, colorBy: HeatColorBy): number =>
  colorBy === 'relative' ? periodOf(period).step / 2 : periodOf(period).step;

/** 0..5 from the deepest loss to the strongest gain; null when flat (under 0.005%) or unknown. */
export function heatBin(pct: number | null, step: number): number | null {
  if (pct == null || Number.isNaN(pct) || Math.abs(pct) < FLAT_BELOW) {
    return null;
  }
  const tier = Math.min(HALF - 1, Math.floor(Math.abs(pct) / step));
  return pct > 0 ? HALF + tier : HALF - 1 - tier;
}

/** The thresholds between the bins, in percent: −2s, −s, 0, +s, +2s. */
export const heatThresholds = (step: number): number[] =>
  Array.from({length: HEAT_BIN_COUNT - 1}, (_, i) => (i - (HALF - 1)) * step);

/** The legend's figures under the joins: "−2%" (U+2212), "−1%", "0", "+1%", "+2%". */
export const heatThresholdLabels = (step: number): string[] =>
  heatThresholds(step).map(v =>
    v === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v)}%`,
  );

// How much of the profit/loss token a bin carries over the panel surface, weakest move first.
const BIN_STRENGTH = [0.24, 0.52, 0.86] as const;
const FLAT_STRENGTH = 0.1;

type Rgb = readonly [number, number, number];

// "#rgb", "#rrggbb" or "#rrggbbaa" (the alpha is ignored); anything else reads as black.
const parseHex = (hex: string): Rgb => {
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return [0, 0, 0];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const mix = (over: Rgb, base: Rgb, alpha: number): Rgb => [
  Math.round(over[0] * alpha + base[0] * (1 - alpha)),
  Math.round(over[1] * alpha + base[1] * (1 - alpha)),
  Math.round(over[2] * alpha + base[2] * (1 - alpha)),
];

const toHex = (rgb: Rgb): string =>
  `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;

const channel = (c: number): number => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

// WCAG relative luminance and contrast ratio.
const luminance = (rgb: Rgb): number =>
  0.2126 * channel(rgb[0]) +
  0.7152 * channel(rgb[1]) +
  0.0722 * channel(rgb[2]);

const contrast = (a: Rgb, b: Rgb): number => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

export interface HeatSwatch {
  /** "#rrggbb". */
  fill: string;
  /** Whichever of the theme's two inks reads better on the fill, "#rrggbb". */
  ink: string;
}

export interface HeatPalette {
  /** Deepest loss first, strongest gain last. */
  bins: HeatSwatch[];
  flat: HeatSwatch;
}

/** The theme's tokens the palette is mixed from, all "#rrggbb". */
export interface HeatTheme {
  /** The card the map sits on. */
  surface: string;
  profit: string;
  loss: string;
  /** The theme's primary text ink. */
  ink: string;
  /** Its inverse text ink. */
  inverseInk: string;
  /** Muted text: the flat tile is a whisper of it. */
  neutral: string;
}

/**
 * The bin fills for a theme: the loss and profit tokens laid over the surface at 0.86 / 0.52 /
 * 0.24 strength, and flat as the neutral token at 0.10; each with the ink that contrasts more.
 * Colours are "#rrggbb" (web prints `rgb()`), which every host can parse.
 */
export function heatPalette(theme: HeatTheme): HeatPalette {
  const surface = parseHex(theme.surface);
  const ink = parseHex(theme.ink);
  const inverse = parseHex(theme.inverseInk);
  const swatch = (token: string, strength: number): HeatSwatch => {
    const fill = mix(parseHex(token), surface, strength);
    return {
      fill: toHex(fill),
      ink: toHex(
        contrast(ink, fill) >= contrast(inverse, fill) ? ink : inverse,
      ),
    };
  };
  return {
    bins: [
      ...[...BIN_STRENGTH].reverse().map(s => swatch(theme.loss, s)),
      ...BIN_STRENGTH.map(s => swatch(theme.profit, s)),
    ],
    flat: swatch(theme.neutral, FLAT_STRENGTH),
  };
}

/** The swatch a move paints with at a bin width. */
export const swatchFor = (
  palette: HeatPalette,
  pct: number | null,
  step: number,
): HeatSwatch => {
  const bin = heatBin(pct, step);
  return (bin == null ? undefined : palette.bins[bin]) ?? palette.flat;
};

export interface HeatLayoutItem {
  id: string;
  weight: number;
  /** Nested layouts only: the frame the tile sits in. */
  group?: string | undefined;
}

export interface HeatTileRect extends TreemapRect {
  id: string;
}

export interface HeatFrameRect extends HeatTileRect {
  /** The header strip's height inside the frame; 0 when the frame has no room for one. */
  headerHeight: number;
}

export interface HeatLayout {
  tiles: HeatTileRect[];
  /** Nested layouts only: one frame per group. */
  frames: HeatFrameRect[];
}

const FRAME_HEADER = 15;
const FRAME_GAP = 1;
const FRAME_HEADER_MIN = {w: 46, h: 34};

/**
 * One squarified treemap over `width` × `height`; or, when any item names a group, a treemap of
 * the groups with each group's own treemap inside its frame (a 15-unit header strip when the frame
 * is at least 46 × 34, and a 1-unit gap at its sides and foot).
 */
export function layoutHeat(
  items: readonly HeatLayoutItem[],
  width: number,
  height: number,
): HeatLayout {
  const bounds = {x: 0, y: 0, w: width, h: height};
  if (!items.some(it => it.group)) {
    return {
      tiles: treemap(
        items.map(it => ({value: it.weight, data: it.id})),
        bounds,
      ).map(({data, ...r}) => ({...r, id: data})),
      frames: [],
    };
  }
  const groups = new Map<string, HeatLayoutItem[]>();
  for (const it of items) {
    const key = it.group ?? '';
    const list = groups.get(key);
    if (list) list.push(it);
    else groups.set(key, [it]);
  }
  const outer = treemap(
    [...groups.entries()].map(([id, members]) => ({
      value: members.reduce((a, m) => a + Math.max(0, m.weight), 0),
      data: {id, members},
    })),
    bounds,
  );
  const layout: HeatLayout = {tiles: [], frames: []};
  for (const g of outer) {
    const headerHeight =
      g.w >= FRAME_HEADER_MIN.w && g.h >= FRAME_HEADER_MIN.h ? FRAME_HEADER : 0;
    layout.frames.push({
      id: g.data.id,
      x: g.x,
      y: g.y,
      w: g.w,
      h: g.h,
      headerHeight,
    });
    const inner = treemap(
      g.data.members.map(m => ({value: m.weight, data: m.id})),
      {
        x: g.x + FRAME_GAP,
        y: g.y + headerHeight,
        w: g.w - 2 * FRAME_GAP,
        h: g.h - headerHeight - FRAME_GAP,
      },
    );
    for (const {data, ...r} of inner) layout.tiles.push({...r, id: data});
  }
  return layout;
}

/** Id prefix of the tile that stands in for a group's stocks too small to print: `__more:{groupId}`. */
export const FOLD_PREFIX = '__more:';

/** A stock whose tile would come out smaller than this, in px², folds into its group's "+N" tile. */
export const HEAT_MIN_TILE_AREA = 900;

export interface FoldedItems {
  items: HeatLayoutItem[];
  /** Each stand-in tile's id, to the ids it holds, largest first. */
  folded: Map<string, string[]>;
}

// A group always keeps its largest stocks, however small the map: a sector never collapses to one block.
const FOLD_KEEP = 2;
// The stand-in is a bucket, not a stock: it never takes more than this share of its group's area.
const FOLD_MAX_SHARE = 0.2;

/**
 * Items whose tile would come out under `minArea` (estimated from the weights over `width` ×
 * `height`) fold into one "+N" tile per group, so the map has no unreadable dust. Each group keeps
 * its 2 largest; ids in `keep` (a searched stock) never fold; a group with fewer than 2 to fold
 * folds nothing. The stand-in's weight is capped at 20% of its group's, so it is not to scale.
 */
export function foldTail(
  items: readonly HeatLayoutItem[],
  width: number,
  height: number,
  minArea: number,
  keep?: ReadonlySet<string>,
): FoldedItems {
  const total = items.reduce((a, it) => a + Math.max(0, it.weight), 0);
  if (total <= 0 || width <= 0 || height <= 0) {
    return {items: [...items], folded: new Map()};
  }
  const perWeight = (width * height) / total;
  const groups = new Map<string, HeatLayoutItem[]>();
  for (const it of items) {
    const key = it.group ?? '';
    const list = groups.get(key);
    if (list) list.push(it);
    else groups.set(key, [it]);
  }
  const out: HeatLayoutItem[] = [];
  const folded = new Map<string, string[]>();
  for (const [key, members] of groups) {
    const ranked = [...members].sort((a, b) => b.weight - a.weight);
    const shown: HeatLayoutItem[] = [];
    const tail: HeatLayoutItem[] = [];
    ranked.forEach((it, i) => {
      const stays =
        i < FOLD_KEEP ||
        it.weight * perWeight >= minArea ||
        keep?.has(it.id) === true;
      (stays ? shown : tail).push(it);
    });
    if (tail.length < 2) {
      out.push(...ranked);
      continue;
    }
    const id = `${FOLD_PREFIX}${key}`;
    const groupWeight = members.reduce(
      (a, it) => a + Math.max(0, it.weight),
      0,
    );
    const weight = Math.min(
      tail.reduce((a, it) => a + it.weight, 0),
      groupWeight * FOLD_MAX_SHARE,
    );
    out.push(...shown, {id, weight, group: key || undefined});
    folded.set(
      id,
      tail.map(it => it.id),
    );
  }
  return {items: out, folded};
}

export type HeatDirection = 'left' | 'right' | 'up' | 'down';

/** The tile an arrow key lands on: the nearest one that side which overlaps the current tile's span. */
export function neighbourTile(
  tiles: readonly HeatTileRect[],
  from: number,
  direction: HeatDirection,
): number {
  const cur = tiles[from];
  if (!cur) return tiles.length ? 0 : -1;
  const horizontal = direction === 'left' || direction === 'right';
  const forward = direction === 'right' || direction === 'down';
  const EDGE = 0.5;
  let best = -1;
  let bestGap = Infinity;
  let bestOverlap = -Infinity;
  tiles.forEach((t, i) => {
    if (i === from) return;
    const gap = horizontal
      ? forward
        ? t.x - (cur.x + cur.w)
        : cur.x - (t.x + t.w)
      : forward
        ? t.y - (cur.y + cur.h)
        : cur.y - (t.y + t.h);
    if (gap < -EDGE) return;
    const overlap = horizontal
      ? Math.min(cur.y + cur.h, t.y + t.h) - Math.max(cur.y, t.y)
      : Math.min(cur.x + cur.w, t.x + t.w) - Math.max(cur.x, t.x);
    if (overlap <= EDGE) return;
    if (
      gap < bestGap - EDGE ||
      (Math.abs(gap - bestGap) <= EDGE && overlap > bestOverlap)
    ) {
      best = i;
      bestGap = gap;
      bestOverlap = overlap;
    }
  });
  return best === -1 ? from : best;
}

/** Placeholder weights with a market's shape (one dominant block, a middle, a tail), for the loading skeleton. */
export const HEAT_SKELETON_WEIGHTS: readonly number[] = [
  27, 12, 10, 8, 7, 7, 6, 6, 5, 4, 4, 2, 2,
];
