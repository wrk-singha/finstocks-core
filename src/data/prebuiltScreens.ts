import type {ScreenFilter} from '../types/screen.ts';

/**
 * Screens worth starting from.
 *
 * Each one is the filters themselves, not a saved result: opening it fills the
 * bar so the reader can see exactly what it asks and change any of it. The
 * definitions follow the ones these screens are known by — Screener.in's
 * featured queries and Chartink's popular scans — with our own field names and
 * the periods our filings support. Where a definition asks for something we
 * cannot build (a ten-year average, invested capital), the closest honest
 * substitute is used and the blurb says so.
 */
export interface PrebuiltScreen {
  id: string;
  name: string;
  blurb: string;
  universes?: string[];
  filters: ScreenFilter[];
  columns?: string[];
  /** The order the matches open in; a screen without one opens on the default sort. */
  sort?: {key: string; dir: 'asc' | 'desc'};
}

export const PREBUILT_SCREENS: PrebuiltScreen[] = [
  {
    id: 'esf-leaders',
    name: 'ESF leaders',
    blurb: 'Stocks in a rising trend, ranked by the FinStocks Score.',
    filters: [{field: 'esf_rising', flag: true}],
    columns: ['esf_score', 'esf_top_pct', 'esf_checks'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-growth-leaders',
    name: 'Growth leaders (CANSLIM)',
    blurb: "Growth leaders that pass most of O'Neil's CANSLIM tests.",
    filters: [{field: 'esf_canslim_leader', flag: true}],
    columns: ['esf_canslim_letters', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-big-money',
    name: 'Big investors buying',
    blurb: 'Trading volume shows big investors buying.',
    filters: [{field: 'esf_accumulation', flag: true}],
    columns: ['esf_volume_score', 'esf_score'],
    sort: {key: 'esf_volume_score', dir: 'desc'},
  },
  {
    id: 'esf-ready-to-rise',
    name: 'Ready to rise (Stage 1B)',
    blurb: 'Resting and about to rise — the stage before an uptrend.',
    filters: [{field: 'esf_stage_1b', flag: true}],
    columns: ['esf_score', 'esf_checks'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-fair-price',
    name: 'Lynch fair price (PEG)',
    blurb: "Priced fairly for its profit growth: Peter Lynch's PEG under 1.",
    filters: [{field: 'esf_fair_price', flag: true}],
    columns: ['esf_peg', 'esf_score'],
    sort: {key: 'esf_peg', dir: 'asc'},
  },
  {
    id: 'esf-graham',
    name: 'Graham safe picks',
    blurb:
      "Large, steady companies at a modest price, passing most of Graham's defensive-investor tests.",
    filters: [{field: 'esf_graham_value', flag: true}],
    columns: ['esf_graham_criteria', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-strong-health',
    name: 'Strong company health',
    blurb:
      "Eight or nine of Piotroski's nine accounting checks. Lenders are not tested.",
    filters: [{field: 'esf_strong_health', flag: true}],
    columns: ['esf_fscore', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'quarterly-growers',
    name: 'Quarterly growers',
    blurb:
      'Sales up 15% and profit up 20% on the same quarter last year, above ₹300 Cr.',
    filters: [
      {field: 'qtr_sales_var', min: 15},
      {field: 'qtr_profit_var', min: 20},
      {field: 'np_qtr', min: 1},
      // Without a size floor this is a third of the market, most of it too
      // small to act on.
      {field: 'market_cap', min: 300},
    ],
  },
  {
    id: 'quality-compounders',
    name: 'Quality compounders',
    blurb:
      'Five years of 15%+ returns on equity and capital, with growth and little debt.',
    filters: [
      {field: 'avg_roe_5y', min: 15},
      {field: 'roce', min: 15},
      {field: 'sales_growth_3y', min: 10},
      {field: 'debt_to_equity', max: 0.5},
      {field: 'market_cap', min: 1000},
    ],
    columns: ['sales_growth_3y', 'avg_roe_5y'],
  },
  {
    id: 'blue-chips',
    name: 'Bluest of the blue chips',
    blurb:
      'Large, consistently profitable and still growing — priced under a PEG of 1.',
    filters: [
      {field: 'market_cap', min: 30000},
      {field: 'avg_roe_5y', min: 20},
      {field: 'debt_to_equity', max: 1.5},
      {field: 'interest_cover', min: 2},
      {field: 'peg', max: 1},
      {field: 'profit_growth_3y', min: 20},
    ],
  },
  {
    id: 'magic-formula',
    name: 'Magic formula',
    blurb:
      "Greenblatt's pairing of a high return on capital with a high earnings yield, on ROCE.",
    filters: [
      {field: 'roce', min: 25},
      {field: 'earnings_yield', min: 10},
      {field: 'market_cap', min: 500},
    ],
    columns: ['roce', 'earnings_yield'],
  },
  {
    id: 'value',
    name: 'Growth at a fair price',
    blurb:
      'Profits compounding above 20% a year, still under 20 times earnings.',
    filters: [
      {field: 'profit_growth_3y', min: 20},
      {field: 'roe', min: 20},
      {field: 'pe', max: 20},
      {field: 'market_cap', min: 500},
    ],
    columns: ['profit_growth_3y', 'roe', 'pe'],
  },
  {
    id: 'profit-jump',
    name: 'Profit tripled in a year',
    blurb:
      'Trailing-year profit up more than 200%, from a year that was already profitable.',
    filters: [
      {field: 'profit_growth', min: 200},
      {field: 'np_prev_year', min: 0},
      {field: 'pat', min: 0},
    ],
    columns: ['profit_growth', 'pat'],
  },
  {
    id: 'loss-to-profit',
    name: 'Turnarounds',
    blurb: 'Made money last quarter after losing it over the trailing year.',
    filters: [
      {field: 'pat_qtr', min: 0.33},
      {field: 'pat', max: 0},
      {field: 'market_cap', min: 100},
      {field: 'price', min: 5},
    ],
    columns: ['pat_qtr', 'pat'],
  },
  {
    id: 'debt-free',
    name: 'Debt-free growers',
    blurb: 'Effectively no borrowings, with three years of growth behind them.',
    filters: [
      {field: 'debt_to_equity', max: 0.1},
      {field: 'roe', min: 15},
      {field: 'sales_growth_3y', min: 12},
    ],
    columns: ['debt_to_equity', 'sales_growth_3y'],
  },
  {
    id: 'dividend',
    name: 'Dividend payers',
    blurb: 'Yielding over 3% while keeping enough back to keep growing.',
    filters: [
      {field: 'dividend_yield', min: 3},
      {field: 'dividend_payout', max: 80},
      {field: 'market_cap', min: 1000},
    ],
    columns: ['dividend_yield', 'dividend_payout'],
  },
  {
    id: 'piotroski',
    name: 'Piotroski strong',
    blurb:
      "Eight or nine of Piotroski's nine checks, at a modest price to book.",
    filters: [
      {field: 'piotroski', min: 8},
      {field: 'pb', max: 3},
      {field: 'market_cap', min: 300},
    ],
    columns: ['piotroski', 'pb'],
  },
  {
    id: 'promoter-buying',
    name: 'Promoters buying',
    blurb: 'The promoter group added to its stake last quarter.',
    // No pledge filter: the vendor files a pledged percentage for about a
    // sixth of companies and leaves the rest blank, so "nothing pledged"
    // would ask for the one thing the data cannot say.
    filters: [
      {field: 'promoter_change', min: 0.01},
      {field: 'market_cap', min: 300},
    ],
    columns: ['promoter_change', 'promoter_holding'],
  },
  {
    id: 'fii-buying',
    name: 'FIIs buying',
    blurb:
      'Foreign institutions raised their holding by half a percentage point or more.',
    filters: [
      {field: 'fii_change', min: 0.5},
      {field: 'market_cap', min: 500},
    ],
    columns: ['fii_change', 'fii_holding'],
  },

  {
    id: '52w-breakout',
    name: '52-week high breakouts',
    blurb: 'Printed a new one-year high today, on heavier volume than usual.',
    filters: [
      {field: 'new_high_52w', flag: true},
      {field: 'volume_ratio', min: 1.5},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['volume_ratio', 'from_high_52w'],
  },
  {
    id: 'near-high',
    name: 'Nearing a breakout',
    blurb: 'Within 2% of the 52-week high, above the 200-day average.',
    filters: [
      {field: 'from_high_52w', min: -2},
      {field: 'above_sma200', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['from_high_52w'],
  },
  {
    id: 'volume-shockers',
    name: 'Volume shockers',
    blurb: 'Trading at three times their usual volume, and up on the day.',
    filters: [
      {field: 'volume_ratio', min: 3},
      {field: 'return_1d', min: 2},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['volume_ratio'],
  },
  {
    id: 'delivery-spike',
    name: 'Delivery spikes',
    blurb: 'Twice the usual delivered quantity, most of it taken into demat.',
    filters: [
      {field: 'delivery_ratio', min: 2},
      {field: 'delivery_pct', min: 60},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['delivery_pct', 'delivery_ratio'],
  },
  {
    id: 'rsi-oversold',
    name: 'Oversold, but in an uptrend',
    blurb: 'RSI under 35 while the price holds above its 200-day average.',
    universes: ['large', 'mid'],
    filters: [
      {field: 'rsi14', max: 35},
      {field: 'above_sma200', flag: true},
    ],
    columns: ['rsi14', 'dist_sma200'],
  },
  {
    id: 'golden-cross',
    name: 'Golden cross',
    blurb:
      'The 50-day average crossed above the 200-day in the last ten sessions.',
    filters: [
      {field: 'golden_cross', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['dist_sma50', 'dist_sma200'],
  },
  {
    id: 'macd-cross',
    name: 'MACD turned up',
    blurb: 'A bullish MACD crossover with the trend still up.',
    filters: [
      {field: 'macd_cross_up', flag: true},
      {field: 'above_sma200', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['macd_hist', 'rsi14'],
  },
  {
    id: 'momentum',
    name: 'Momentum leaders',
    blurb:
      'Up strongly over three months and a year, still above their averages.',
    filters: [
      {field: 'return_3m', min: 20},
      {field: 'return_1y', min: 50},
      {field: 'dist_sma50', min: 0},
      {field: 'traded_value20', min: 5},
    ],
    columns: ['return_3m', 'return_1y'],
  },
  {
    id: 'bullish-candles',
    name: 'Bullish reversal candles',
    blurb:
      "A bullish engulfing on today's bar, after a fall towards the 200-day average.",
    filters: [
      {field: 'pat.bullish_engulfing', flag: true, max: 0},
      {field: 'rsi14', max: 45},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['pat.bullish_engulfing', 'rsi14'],
  },
  {
    id: 'triangle-breakout',
    name: 'Triangle breakouts',
    blurb: 'An ascending triangle that broke out within the last month.',
    filters: [
      {field: 'pat.ascending_triangle_breakout', flag: true, max: 29},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['pat.ascending_triangle_breakout', 'volume_ratio'],
  },
  {
    id: 'quality-on-sale',
    name: 'Quality near its lows',
    blurb:
      "Profitable, low-debt companies trading within 10% of the year's low.",
    filters: [
      {field: 'from_low_52w', max: 10},
      {field: 'roe', min: 15},
      {field: 'debt_to_equity', max: 1},
      {field: 'market_cap', min: 500},
    ],
    columns: ['from_low_52w', 'roe'],
  },
];
