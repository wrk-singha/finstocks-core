import {mapSector} from '../market/sectors.ts';
import type {CustomIndicatorFilter, ScreenerStock} from '../types/screener.ts';
import {
  DEFAULT_TIMEFRAME,
  type ScreenerBackendFilters,
  type ScreenerTimeframe,
} from '../types/screenerFilters.ts';
import {
  type IndicatorOption,
  indicatorFilterLabel,
  serializeIndicatorFilters,
} from './screenerIndicators.ts';

// Filter model for the market screener. Universe/near52w/highvol/rsi/trend are applied
// server-side, before the backend's top-N-by-market-cap cutoff (see toBackendFilters) - a
// client-only RSI/trend filter would silently miss matches truncated out of the response before
// they were ever checked. RSI/trend are also re-checked client-side, belt-and-suspenders.
export type Universe = 'all' | 'nifty50' | 'nifty500';
export type MktCap = 'any' | 'mega' | 'large' | 'mid' | 'small';
export type RsiBand = 'any' | 'oversold' | 'neutral' | 'strong';
export type PriceBand = 'any' | 'under500' | 'mid' | 'over2000';
export type FundKey = 'roe15' | 'lowdebt' | 'pe25';
export type TechKey = 'uptrend' | 'near52w' | 'highvol';
export type SortKey = 'score' | 'mktcap' | 'pe' | 'rsi' | 'div' | 'change';

export interface Filters {
  universe: Universe;
  /** "any" or a coarse chip label */
  sector: string;
  mktCap: MktCap;
  rsi: RsiBand;
  price: PriceBand;
  funds: Set<FundKey>;
  techs: Set<TechKey>;
  custom: CustomIndicatorFilter[];
  sort: SortKey;
}

export const DEFAULTS: Filters = {
  universe: 'all',
  sector: 'any',
  mktCap: 'any',
  rsi: 'any',
  price: 'any',
  funds: new Set(),
  techs: new Set(),
  custom: [],
  sort: 'score',
};

/** Universe/near52w/highvol/custom-indicator filters apply server-side - build the query params for them. */
export function toBackendFilters(
  filters: Filters,
  timeframe: ScreenerTimeframe = DEFAULT_TIMEFRAME,
): ScreenerBackendFilters {
  const params: ScreenerBackendFilters = {interval: timeframe};
  if (filters.rsi === 'oversold') {
    params.rsi_min = '0';
    params.rsi_max = '40';
  } else if (filters.rsi === 'neutral') {
    params.rsi_min = '40';
    params.rsi_max = '60';
  } else if (filters.rsi === 'strong') {
    params.rsi_min = '60';
    params.rsi_max = '100';
  }
  if (filters.techs.has('uptrend')) params.trend = 'Uptrend';
  if (filters.techs.has('near52w')) params.near_52w_high = 'true';
  if (filters.techs.has('highvol')) params.high_volume = 'true';
  if (filters.universe === 'nifty50') params.universe = 'NIFTY 50';
  else if (filters.universe === 'nifty500') params.universe = 'NIFTY 500';
  if (filters.custom.length > 0)
    params.ind = serializeIndicatorFilters(filters.custom);
  return params;
}

/** Map a fine-grained data sector to one of the coarse screener chips. */

/** ₹ crore -> Mega / Large / Mid / Small band. */
export function capBand(cr: number | null): MktCap | null {
  if (cr == null) return null;
  if (cr >= 200000) return 'mega';
  if (cr >= 50000) return 'large';
  if (cr >= 15000) return 'mid';
  return 'small';
}

export function sortStocks(
  list: ScreenerStock[],
  key: SortKey,
): ScreenerStock[] {
  if (key === 'score') {
    return [...list].sort(
      (a, b) => (b.final_score ?? -Infinity) - (a.final_score ?? -Infinity),
    );
  }
  // P/E ascending (cheaper first); everything else descending.
  const dir = key === 'pe' ? 1 : -1;
  const val = (s: ScreenerStock) =>
    key === 'mktcap'
      ? s.mkt_cap
      : key === 'pe'
        ? s.pe
        : key === 'rsi'
          ? s.rsi
          : key === 'div'
            ? s.div_yield
            : s.change_pct;
  return [...list].sort((a, b) => {
    const av = val(a);
    const bv = val(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir * (av - bv);
  });
}

/** Full filter + sort pipeline over the fetched universe. */
export function applyScreenerFilters(
  stocks: ScreenerStock[],
  filters: Filters,
): ScreenerStock[] {
  const list = stocks.filter(s => {
    if (filters.sector !== 'any' && mapSector(s.sector) !== filters.sector)
      return false;
    if (filters.mktCap !== 'any' && capBand(s.mkt_cap) !== filters.mktCap)
      return false;
    if (filters.rsi !== 'any') {
      if (s.rsi == null) return false;
      if (filters.rsi === 'oversold' && !(s.rsi < 40)) return false;
      if (filters.rsi === 'neutral' && !(s.rsi >= 40 && s.rsi <= 60))
        return false;
      if (filters.rsi === 'strong' && !(s.rsi > 60)) return false;
    }
    if (filters.price !== 'any') {
      if (s.price == null) return false;
      if (filters.price === 'under500' && !(s.price < 500)) return false;
      if (filters.price === 'mid' && !(s.price >= 500 && s.price <= 2000))
        return false;
      if (filters.price === 'over2000' && !(s.price > 2000)) return false;
    }
    if (filters.funds.has('roe15') && !(s.roe != null && s.roe > 15))
      return false;
    if (
      filters.funds.has('lowdebt') &&
      !(s.debt_equity != null && s.debt_equity < 0.5)
    )
      return false;
    if (filters.funds.has('pe25') && !(s.pe != null && s.pe > 0 && s.pe < 25))
      return false;
    if (filters.techs.has('uptrend') && s.trend_status !== 'Uptrend')
      return false;
    return true;
  });
  return sortStocks(list, filters.sort);
}

/**
 * Chat prompt describing the active screen, for the Backtest/Deploy banner and keyboard
 * shortcuts. The web builds this for its desktop banner; the phone layout hides that banner and
 * seeds the assistant with chips instead, so it has no caller there until a wider layout lands.
 */
export function buildScreenMessage(
  filters: Filters,
  filtered: ScreenerStock[],
  verb: 'Backtest' | 'Deploy',
  indicatorOptions: IndicatorOption[] = [],
): string {
  const parts: string[] = [];
  if (filters.sector !== 'any') parts.push(`sector ${filters.sector}`);
  if (filters.mktCap !== 'any') parts.push(`${filters.mktCap}-cap`);
  if (filters.rsi !== 'any') parts.push(`RSI ${filters.rsi}`);
  if (filters.price !== 'any') parts.push(`price ${filters.price}`);
  if (filters.funds.has('roe15')) parts.push('ROE > 15%');
  if (filters.funds.has('lowdebt')) parts.push('low debt');
  if (filters.funds.has('pe25')) parts.push('P/E < 25');
  if (filters.techs.has('uptrend')) parts.push('in an uptrend');
  if (filters.custom.length > 0) {
    const byKey = new Map(indicatorOptions.map(o => [o.key, o]));
    filters.custom.forEach(c =>
      parts.push(indicatorFilterLabel(c, byKey.get(c.key))),
    );
  }
  const criteria = parts.length ? parts.join(', ') : 'the current market';
  return verb === 'Backtest'
    ? `Backtest a rule-based screen of Indian stocks over long-term historical data. Screen rules: ${criteria}. Re-apply the screen across the full history — don't backtest a fixed list of today's candidates.`
    : `Deploy a strategy over Indian stocks filtered by ${criteria}. Candidates: ${filtered
        .slice(0, 15)
        .map(s => s.symbol)
        .join(', ')}.`;
}
