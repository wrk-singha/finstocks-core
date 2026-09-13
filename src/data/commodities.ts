export type CommodityGroup =
  | 'crudeoil'
  | 'naturalgas'
  | 'gold'
  | 'silver'
  | 'copper'
  | 'aluminium'
  | 'zinc'
  | 'nickel';

export interface Commodity {
  /** MCX trading symbol, the same dialect the chart pipeline takes. */
  symbol: string;
  name: string;
  group: CommodityGroup;
  exchange: 'MCX';
  /** Quantity one contract controls. */
  lot: string;
  /** What the quoted price is per — MCX quotes gold per 10g but trades it per kg. */
  quotedPer: string;
}

export const COMMODITY_GROUPS: {key: CommodityGroup; label: string}[] = [
  {key: 'crudeoil', label: 'Crude Oil'},
  {key: 'naturalgas', label: 'Natural Gas'},
  {key: 'gold', label: 'Gold'},
  {key: 'silver', label: 'Silver'},
  {key: 'copper', label: 'Copper'},
  {key: 'aluminium', label: 'Aluminium'},
  {key: 'zinc', label: 'Zinc'},
  {key: 'nickel', label: 'Nickel'},
];

/**
 * Each commodity's own colour as a bare `r g b` triple, so a mark can compose it
 * at several opacities rather than needing one token per step. Mid-tone on
 * purpose: the same value has to stay legible on a white card and on the
 * near-black surface, which rules out both true metal greys and the saturated
 * brights.
 */
export const COMMODITY_TINT: Record<CommodityGroup, string> = {
  crudeoil: '176 118 47',
  naturalgas: '62 143 214',
  gold: '210 160 42',
  silver: '148 163 180',
  copper: '194 103 60',
  aluminium: '111 138 160',
  zinc: '110 118 192',
  nickel: '79 163 130',
};

/** Non-agri MCX runs an evening session; agri closes at 5pm, and none is listed here. */
export const MCX_TRADING_HOURS = '9:00 AM – 11:30 PM';

/**
 * The MCX commodity futures universe we list, ordered by group so the "All"
 * preview opens on the two energy contracts and the two metals people actually
 * search for rather than on whatever sorts first alphabetically.
 *
 * Mini/micro variants are separate rows rather than a size toggle on one row:
 * they are separate contracts with their own price, and the smaller lot is the
 * whole reason a retail account trades the commodity at all.
 */
export const COMMODITIES: readonly Commodity[] = [
  {
    symbol: 'CRUDEOIL',
    name: 'Crude Oil',
    group: 'crudeoil',
    exchange: 'MCX',
    lot: '100 barrels',
    quotedPer: '1 barrel',
  },
  {
    symbol: 'CRUDEOILM',
    name: 'Crude Oil Mini',
    group: 'crudeoil',
    exchange: 'MCX',
    lot: '10 barrels',
    quotedPer: '1 barrel',
  },
  {
    symbol: 'NATURALGAS',
    name: 'Natural Gas',
    group: 'naturalgas',
    exchange: 'MCX',
    lot: '1,250 mmBtu',
    quotedPer: '1 mmBtu',
  },
  {
    symbol: 'NATGASMINI',
    name: 'Natural Gas Mini',
    group: 'naturalgas',
    exchange: 'MCX',
    lot: '250 mmBtu',
    quotedPer: '1 mmBtu',
  },
  {
    symbol: 'GOLD',
    name: 'Gold',
    group: 'gold',
    exchange: 'MCX',
    lot: '1 kg',
    quotedPer: '10 grams',
  },
  {
    symbol: 'GOLDM',
    name: 'Gold Mini',
    group: 'gold',
    exchange: 'MCX',
    lot: '100 grams',
    quotedPer: '10 grams',
  },
  {
    symbol: 'GOLDGUINEA',
    name: 'Gold Guinea',
    group: 'gold',
    exchange: 'MCX',
    lot: '8 grams',
    quotedPer: '8 grams',
  },
  {
    symbol: 'GOLDPETAL',
    name: 'Gold Petal',
    group: 'gold',
    exchange: 'MCX',
    lot: '1 gram',
    quotedPer: '1 gram',
  },
  {
    symbol: 'SILVER',
    name: 'Silver',
    group: 'silver',
    exchange: 'MCX',
    lot: '30 kg',
    quotedPer: '1 kg',
  },
  {
    symbol: 'SILVERM',
    name: 'Silver Mini',
    group: 'silver',
    exchange: 'MCX',
    lot: '5 kg',
    quotedPer: '1 kg',
  },
  {
    symbol: 'SILVERMIC',
    name: 'Silver Micro',
    group: 'silver',
    exchange: 'MCX',
    lot: '1 kg',
    quotedPer: '1 kg',
  },
  {
    symbol: 'COPPER',
    name: 'Copper',
    group: 'copper',
    exchange: 'MCX',
    lot: '2,500 kg',
    quotedPer: '1 kg',
  },
  {
    symbol: 'ALUMINIUM',
    name: 'Aluminium',
    group: 'aluminium',
    exchange: 'MCX',
    lot: '5 tonnes',
    quotedPer: '1 kg',
  },
  {
    symbol: 'ALUMINI',
    name: 'Aluminium Mini',
    group: 'aluminium',
    exchange: 'MCX',
    lot: '1 tonne',
    quotedPer: '1 kg',
  },
  {
    symbol: 'ZINC',
    name: 'Zinc',
    group: 'zinc',
    exchange: 'MCX',
    lot: '5 tonnes',
    quotedPer: '1 kg',
  },
  {
    symbol: 'ZINCMINI',
    name: 'Zinc Mini',
    group: 'zinc',
    exchange: 'MCX',
    lot: '1 tonne',
    quotedPer: '1 kg',
  },
  {
    symbol: 'NICKEL',
    name: 'Nickel',
    group: 'nickel',
    exchange: 'MCX',
    lot: '1,500 kg',
    quotedPer: '1 kg',
  },
];

const COMMODITY_BY_SYMBOL: Record<string, Commodity> = Object.fromEntries(
  COMMODITIES.map(c => [c.symbol, c]),
);

export const commodityOf = (symbol: string): Commodity | undefined =>
  COMMODITY_BY_SYMBOL[symbol.trim().toUpperCase()];

export const isCommoditySymbol = (symbol: string): boolean =>
  Boolean(commodityOf(symbol));

export const commoditiesInGroup = (
  group: CommodityGroup | 'all',
): Commodity[] =>
  group === 'all'
    ? [...COMMODITIES]
    : COMMODITIES.filter(c => c.group === group);
