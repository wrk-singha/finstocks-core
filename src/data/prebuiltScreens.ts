import type {ScreenFilter} from '../types/screen.ts';

/** Where the Markets page files a screen; the screener lists them all in one row. */
export type PrebuiltGroup = 'score' | 'fundamentals' | 'technicals' | 'fno';

/**
 * What kind of screen it is inside its group, named for what its filters ask —
 * never for who it suits or how well it does, which nothing here can source.
 * Each one holds two screens or more, so a theme chip never opens on a lone card.
 */
export type PrebuiltTheme =
  | 'Growth'
  | 'Quality'
  | 'Value'
  | 'Turnarounds'
  | 'Ownership'
  | 'Size & price'
  | 'Breakouts'
  | 'Near 52-week high / low'
  | 'Momentum'
  | 'Trend'
  | 'Crossovers'
  | 'Pullbacks'
  | 'Reversals'
  | 'Overbought / oversold'
  | 'Volume'
  | 'Futures buildup'
  | 'Volatility'
  | 'Option activity'
  | 'Options regime';

/** The themes of a group, in the order the screener home offers them. A group missing here has none. */
export const PREBUILT_THEMES: Partial<
  Record<PrebuiltGroup, readonly PrebuiltTheme[]>
> = {
  fundamentals: [
    'Growth',
    'Quality',
    'Value',
    'Turnarounds',
    'Ownership',
    'Size & price',
  ],
  technicals: [
    'Breakouts',
    'Near 52-week high / low',
    'Momentum',
    'Trend',
    'Crossovers',
    'Pullbacks',
    'Reversals',
    'Overbought / oversold',
    'Volume',
  ],
  fno: ['Futures buildup', 'Volatility', 'Option activity', 'Options regime'],
};

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
  group?: PrebuiltGroup;
  /** One of its group's PREBUILT_THEMES, where the group has them. */
  theme?: PrebuiltTheme;
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
    group: 'score',
    name: 'ESF leaders',
    blurb:
      'Weinstein stage 1B, 2A or 2B: a late base or an uptrend not yet stretched. Ranked by the FinStocks Score.',
    filters: [{field: 'esf_rising', flag: true}],
    columns: ['esf_score', 'esf_top_pct', 'esf_checks'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-growth-leaders',
    group: 'score',
    name: 'Growth leaders (CANSLIM)',
    blurb:
      "Five or more of O'Neil's seven CANSLIM tests, including quarterly EPS and sales up 25%+ and a market in a confirmed uptrend.",
    filters: [{field: 'esf_canslim_leader', flag: true}],
    columns: ['esf_canslim_letters', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-big-money',
    group: 'score',
    name: 'Volume accumulation',
    blurb:
      'A volume accumulation score of 65 or more out of 100, built from up/down volume, OBV, money flow and other volume patterns; often read as big investors buying.',
    filters: [{field: 'esf_accumulation', flag: true}],
    columns: ['esf_volume_score', 'esf_score'],
    sort: {key: 'esf_volume_score', dir: 'desc'},
  },
  {
    id: 'esf-ready-to-rise',
    group: 'score',
    name: 'Late-stage base (Stage 1B)',
    blurb:
      'Weinstein stage 1B: a base of 10 weeks or more with the price back above its 30-week average.',
    filters: [{field: 'esf_stage_1b', flag: true}],
    columns: ['esf_score', 'esf_checks'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-fair-price',
    group: 'score',
    name: 'Lynch fair price (PEG)',
    blurb:
      "Lynch's PEG under 1: trailing P/E below 3-year EPS growth (dividend counted), with growth of 5% to 50% a year.",
    filters: [{field: 'esf_fair_price', flag: true}],
    columns: ['esf_peg', 'esf_score'],
    sort: {key: 'esf_peg', dir: 'asc'},
  },
  {
    id: 'esf-graham',
    group: 'score',
    name: 'Graham value picks',
    blurb:
      "Five or more of Graham's seven defensive-investor tests, always including his balance-sheet test and a profit in every year on file, up to ten.",
    filters: [{field: 'esf_graham_value', flag: true}],
    columns: ['esf_graham_criteria', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'esf-strong-health',
    group: 'score',
    name: 'Strong company health',
    blurb:
      "Eight or nine of Piotroski's nine accounting checks. Banks, NBFCs and insurers are not scored.",
    filters: [{field: 'esf_strong_health', flag: true}],
    columns: ['esf_fscore', 'esf_score'],
    sort: {key: 'esf_score', dir: 'desc'},
  },
  {
    id: 'quarterly-growers',
    group: 'fundamentals',
    theme: 'Growth',
    name: 'Quarterly growers',
    blurb:
      "Latest quarter's sales up 15%+ and profit up 20%+ on a year ago, with ₹1 Cr+ profit and a ₹300 Cr+ market cap.",
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
    group: 'fundamentals',
    theme: 'Quality',
    name: 'Quality compounders',
    blurb:
      'Five-year average ROE and latest ROCE both 15%+, sales up 10%+ a year over three years, debt-to-equity 0.5 or less.',
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
    group: 'fundamentals',
    theme: 'Quality',
    name: 'Bluest of the blue chips',
    blurb:
      '₹30,000 Cr+ companies with five-year average ROE of 20%+, profit up 20%+ a year over three years, a PEG of 1 or less, debt-to-equity of 1.5 or less and interest cover of 2 or more.',
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
    group: 'fundamentals',
    theme: 'Value',
    name: 'Magic formula',
    blurb:
      "Greenblatt's two measures as cut-offs, not his ranking: ROCE of 25%+ and an earnings yield of 10%+, ₹500 Cr+.",
    filters: [
      {field: 'roce', min: 25},
      {field: 'earnings_yield', min: 10},
      {field: 'market_cap', min: 500},
    ],
    columns: ['roce', 'earnings_yield'],
  },
  {
    id: 'value',
    group: 'fundamentals',
    theme: 'Value',
    name: 'Growth at a fair price',
    blurb:
      'Profit up 20%+ a year over three years and ROE of 20%+, at a P/E of 20 or less, ₹500 Cr+.',
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
    group: 'fundamentals',
    theme: 'Growth',
    name: 'Profit tripled in a year',
    blurb:
      "The last four quarters' profit up 200%+ on the four before, with no loss in the financial year before last.",
    filters: [
      {field: 'profit_growth', min: 200},
      {field: 'np_prev_year', min: 0},
      {field: 'pat', min: 0},
    ],
    columns: ['profit_growth', 'pat'],
  },
  {
    id: 'loss-to-profit',
    group: 'fundamentals',
    theme: 'Turnarounds',
    name: 'Turnarounds',
    blurb:
      'A profit of ₹0.33 Cr+ in the latest quarter while the last four quarters together still show none.',
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
    group: 'fundamentals',
    theme: 'Quality',
    name: 'Nearly debt-free growers',
    blurb:
      'Debt-to-equity of 0.1 or less, ROE of 15%+ and sales up 12%+ a year over three years.',
    filters: [
      {field: 'debt_to_equity', max: 0.1},
      {field: 'roe', min: 15},
      {field: 'sales_growth_3y', min: 12},
    ],
    columns: ['debt_to_equity', 'sales_growth_3y'],
  },
  {
    id: 'dividend',
    group: 'fundamentals',
    theme: 'Value',
    name: 'Dividend payers',
    blurb:
      'A dividend yield of 3%+ with no more than 80% of profit paid out, ₹1,000 Cr+.',
    filters: [
      {field: 'dividend_yield', min: 3},
      {field: 'dividend_payout', max: 80},
      {field: 'market_cap', min: 1000},
    ],
    columns: ['dividend_yield', 'dividend_payout'],
  },
  {
    id: 'piotroski',
    group: 'fundamentals',
    theme: 'Quality',
    name: 'Piotroski strong',
    blurb:
      'A Piotroski score of 8 or 9 at a price to book of 3 or less, ₹300 Cr+.',
    filters: [
      {field: 'piotroski', min: 8},
      {field: 'pb', max: 3},
      {field: 'market_cap', min: 300},
    ],
    columns: ['piotroski', 'pb'],
  },
  {
    id: 'promoter-buying',
    group: 'fundamentals',
    theme: 'Ownership',
    name: 'Promoter stake up',
    blurb:
      "The promoter group holds more than at the previous quarter's filing, ₹300 Cr+.",
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
    group: 'fundamentals',
    theme: 'Ownership',
    name: 'FII stake up',
    blurb:
      "Foreign investors' stake up half a percentage point or more on the previous quarter, ₹500 Cr+.",
    filters: [
      {field: 'fii_change', min: 0.5},
      {field: 'market_cap', min: 500},
    ],
    columns: ['fii_change', 'fii_holding'],
  },
  // Upstox's ready-made screens we did not already have, rebuilt from the fields
  // its pages list (thresholds there are not public, so these are ours).
  {
    id: 'qtr-profit-50',
    group: 'fundamentals',
    theme: 'Growth',
    name: 'Quarterly profit up 50%+',
    blurb:
      "Latest quarter's net profit up 50%+ on the same quarter a year ago, with ₹1 Cr+ net profit and ₹1 Cr+ operating profit in that quarter, ₹300 Cr+.",
    filters: [
      {field: 'qtr_profit_var', min: 50},
      // A tiny base doubles on a rounding error.
      {field: 'np_qtr', min: 1},
      {field: 'ebitda_qtr', min: 1},
      {field: 'market_cap', min: 300},
    ],
    columns: ['qtr_profit_var', 'qtr_sales_var'],
  },
  {
    id: 'qtr-loss-to-profit',
    group: 'fundamentals',
    theme: 'Turnarounds',
    name: 'Quarterly loss to profit',
    blurb:
      '₹1 Cr+ net profit in the latest quarter after a net loss of ₹0.01 Cr or more in the quarter before, ₹100 Cr+ companies.',
    // The year-ago quarter's profit is not a screen field, so only the quarter before is checked.
    // Bounds are inclusive; a hair under zero keeps a nil quarter, which is no loss, out.
    filters: [
      {field: 'np_qtr', min: 1},
      {field: 'np_prev_qtr', max: -0.01},
      {field: 'market_cap', min: 100},
    ],
    columns: ['np_qtr', 'np_prev_qtr'],
  },
  {
    id: 'small-cap-growers',
    group: 'fundamentals',
    theme: 'Size & price',
    name: 'Fast-growing small and micro caps',
    blurb:
      "Small and micro caps (ranked 251st or below by market cap) of ₹300 Cr+, with the last four quarters' sales and profit both up 25%+, the latest quarter's profit up 20%+ on a year ago, ₹1 Cr+ profit last financial year, ROCE of 15%+, debt-to-equity of 1 or less and promoters holding 40%+.",
    // The app's own size bands (ranks by market cap), so the name agrees with the Size picker.
    universes: ['small', 'micro'],
    filters: [
      {field: 'market_cap', min: 300},
      {field: 'sales_growth', min: 25},
      {field: 'profit_growth', min: 25},
      {field: 'qtr_profit_var', min: 20},
      {field: 'np_last_year', min: 1},
      {field: 'roce', min: 15},
      {field: 'debt_to_equity', max: 1},
      {field: 'promoter_holding', min: 40},
    ],
    columns: ['sales_growth', 'profit_growth'],
  },
  {
    id: 'profit-compounders',
    group: 'fundamentals',
    theme: 'Growth',
    name: 'Profit compounding at 20%+',
    blurb:
      'Profit up 20%+ a year over both five and three years and 20%+ over the last four quarters, with five-year average ROE of 15%+ and sales up 10%+ a year over five years.',
    filters: [
      {field: 'profit_growth_5y', min: 20},
      {field: 'profit_growth_3y', min: 20},
      {field: 'profit_growth', min: 20},
      {field: 'avg_roe_5y', min: 15},
      {field: 'sales_growth_5y', min: 10},
    ],
    columns: ['profit_growth_5y', 'profit_growth_3y'],
  },
  {
    id: 'high-roe-modest-pe',
    group: 'fundamentals',
    theme: 'Value',
    name: 'High ROE at a modest P/E',
    blurb:
      'ROE of 20%+ and a five-year average of 15%+, at a P/E of 20 or less with debt-to-equity of 0.5 or less, ₹500 Cr+.',
    filters: [
      {field: 'roe', min: 20},
      {field: 'avg_roe_5y', min: 15},
      {field: 'pe', max: 20},
      {field: 'debt_to_equity', max: 0.5},
      {field: 'market_cap', min: 500},
    ],
    columns: ['roe', 'pe'],
  },
  {
    id: 'smid-high-roce',
    group: 'fundamentals',
    theme: 'Size & price',
    name: 'Mid and small caps, high ROCE',
    blurb:
      'Mid and small caps (ranked 101st to 500th by market cap) with ROCE of 20%+ in the latest year (not a five-year average, which we do not hold), sales and profit up 15%+ a year over five years, debt-to-equity of 0.5 or less, promoters holding 50%+ and a P/E of 40 or less.',
    universes: ['mid', 'small'],
    filters: [
      {field: 'roce', min: 20},
      {field: 'sales_growth_5y', min: 15},
      {field: 'profit_growth_5y', min: 15},
      {field: 'debt_to_equity', max: 0.5},
      {field: 'promoter_holding', min: 50},
      {field: 'pe', max: 40},
    ],
    columns: ['roce', 'profit_growth_5y'],
  },
  {
    id: 'cash-rich',
    group: 'fundamentals',
    theme: 'Value',
    name: 'Cash over a fifth of market cap',
    blurb:
      "Cash and bank balances at the last annual filing above a fifth of today's market cap, with ROCE of 15%+ and ₹1 Cr+ free cash flow last year.",
    filters: [
      {field: 'cash_and_bank', op: 'gt', ref: 'market_cap', factor: 0.2},
      {field: 'roce', min: 15},
      {field: 'free_cash_flow', min: 1},
    ],
    columns: ['cash_and_bank', 'free_cash_flow'],
  },
  {
    id: 'under-50-profitable',
    group: 'fundamentals',
    theme: 'Size & price',
    name: '₹50 or less, profitable',
    blurb:
      'A share price of ₹50 or less, with ₹1 Cr+ net profit in the latest quarter and over the last four quarters, ₹100 Cr+.',
    filters: [
      {field: 'price', max: 50},
      {field: 'np_qtr', min: 1},
      {field: 'pat', min: 1},
      {field: 'market_cap', min: 100},
    ],
    columns: ['np_qtr', 'pat'],
  },
  {
    id: 'dii-buying',
    group: 'fundamentals',
    theme: 'Ownership',
    name: 'DII stake up, low debt',
    blurb:
      "Domestic institutions' stake up half a percentage point or more on the previous quarter and at 5%+, with ROCE of 15%+ and debt-to-equity of 0.5 or less, ₹500 Cr+.",
    filters: [
      {field: 'dii_change', min: 0.5},
      {field: 'dii_holding', min: 5},
      {field: 'roce', min: 15},
      {field: 'debt_to_equity', max: 0.5},
      {field: 'market_cap', min: 500},
    ],
    columns: ['dii_change', 'dii_holding'],
  },
  {
    id: 'promoter-heavy-low-debt',
    group: 'fundamentals',
    theme: 'Ownership',
    name: 'High promoter stake, low debt',
    blurb:
      'Promoters holding 60%+, debt-to-equity of 0.3 or less, ROE of 15%+ and profit up 10%+ a year over three years, ₹500 Cr+.',
    // No pledge filter, as in "Promoter stake up": the figure is filed for about a sixth of companies.
    filters: [
      {field: 'promoter_holding', min: 60},
      {field: 'debt_to_equity', max: 0.3},
      {field: 'roe', min: 15},
      {field: 'profit_growth_3y', min: 10},
      {field: 'market_cap', min: 500},
    ],
    columns: ['promoter_holding', 'debt_to_equity'],
  },
  {
    id: 'capacity-build',
    group: 'fundamentals',
    theme: 'Growth',
    name: 'Capacity being built (CWIP)',
    blurb:
      'Capital work in progress above half the net block at the last annual filing, read as capacity being added, with ₹1 Cr+ profit over the last four quarters and debt-to-equity of 1 or less, ₹500 Cr+.',
    filters: [
      {field: 'lib.cwip.A', op: 'gt', ref: 'lib.net_block.A', factor: 0.5},
      {field: 'pat', min: 1},
      {field: 'debt_to_equity', max: 1},
      {field: 'market_cap', min: 500},
    ],
    columns: ['lib.net_block.A'],
  },

  {
    id: '52w-breakout',
    group: 'technicals',
    theme: 'Breakouts',
    name: '52-week high breakouts',
    blurb:
      'A new 52-week high in the latest session, on volume 1.5× or more its 20-session average.',
    filters: [
      {field: 'new_high_52w', flag: true},
      {field: 'volume_ratio', min: 1.5},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['volume_ratio', 'from_high_52w'],
  },
  {
    id: 'near-high',
    group: 'technicals',
    theme: 'Near 52-week high / low',
    name: 'Near the 52-week high',
    blurb: 'Within 2% of the 52-week high and above the 200-day average.',
    filters: [
      {field: 'from_high_52w', min: -2},
      {field: 'above_sma200', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['from_high_52w'],
  },
  {
    id: 'volume-shockers',
    group: 'technicals',
    theme: 'Volume',
    name: 'Volume shockers',
    blurb:
      'Volume 3× or more its 20-session average, and up 2% or more in the latest session.',
    filters: [
      {field: 'volume_ratio', min: 3},
      {field: 'return_1d', min: 2},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['volume_ratio'],
  },
  {
    id: 'delivery-spike',
    group: 'technicals',
    theme: 'Volume',
    name: 'Delivery spikes',
    blurb:
      'Delivered quantity 2× or more its 20-session average, with 60%+ of the traded quantity delivered.',
    filters: [
      {field: 'delivery_ratio', min: 2},
      {field: 'delivery_pct', min: 60},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['delivery_pct', 'delivery_ratio'],
  },
  {
    id: 'rsi-oversold',
    group: 'technicals',
    theme: 'Pullbacks',
    name: 'RSI dip above the 200-day',
    blurb:
      'RSI (14) of 35 or less while the price stays above its 200-day average.',
    universes: ['large', 'mid'],
    filters: [
      {field: 'rsi14', max: 35},
      {field: 'above_sma200', flag: true},
    ],
    columns: ['rsi14', 'dist_sma200'],
  },
  {
    id: 'golden-cross',
    group: 'technicals',
    theme: 'Crossovers',
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
    group: 'technicals',
    theme: 'Crossovers',
    name: 'MACD turned up',
    blurb:
      'MACD crossed above its signal line in the last 3 sessions, with the price above its 200-day average.',
    filters: [
      {field: 'macd_cross_up', flag: true},
      {field: 'above_sma200', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['macd_hist', 'rsi14'],
  },
  {
    id: 'momentum',
    group: 'technicals',
    theme: 'Momentum',
    name: 'Momentum leaders',
    blurb:
      'Up 20%+ over three months and 50%+ over a year, at or above the 50-day average.',
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
    group: 'technicals',
    theme: 'Reversals',
    name: 'Bullish reversal candles',
    blurb:
      'A bullish engulfing candle on the latest daily bar, with RSI (14) at 45 or less.',
    filters: [
      {field: 'pat.bullish_engulfing', flag: true, max: 0},
      {field: 'rsi14', max: 45},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['pat.bullish_engulfing', 'rsi14'],
  },
  {
    id: 'triangle-breakout',
    group: 'technicals',
    theme: 'Breakouts',
    name: 'Triangle breakouts',
    blurb: 'An ascending triangle that broke out in the last 30 sessions.',
    filters: [
      {field: 'pat.ascending_triangle_breakout', flag: true, max: 29},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['pat.ascending_triangle_breakout', 'volume_ratio'],
  },
  {
    id: 'near-52w-low-profitable',
    group: 'technicals',
    theme: 'Near 52-week high / low',
    name: 'Near the 52-week low, profitable',
    blurb:
      'Within 10% of the 52-week low, with ₹1 Cr+ net profit over the last four quarters and ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'from_low_52w', max: 10},
      {field: 'pat', min: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['from_low_52w', 'rsi14'],
  },
  {
    id: 'squeeze-breakout',
    group: 'technicals',
    theme: 'Breakouts',
    name: 'Squeeze breakout',
    blurb:
      'A daily close at or above the upper Bollinger band (20, 2) while the bands are 8% wide or less, on volume 1.5× or more its 20-session average, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'bb_pctb', min: 100},
      {field: 'bb_width', max: 8},
      {field: 'volume_ratio', min: 1.5},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['bb_width', 'volume_ratio'],
  },
  {
    id: 'near-high-delivery',
    group: 'technicals',
    theme: 'Near 52-week high / low',
    name: 'Near the high, high delivery',
    blurb:
      "Within 5% of the 52-week high and above the 50-day average, with 50%+ of the latest session's traded quantity delivered, ₹1 Cr+ traded a day on average.",
    filters: [
      {field: 'from_high_52w', min: -5},
      {field: 'above_sma50', flag: true},
      {field: 'delivery_pct', min: 50},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['from_high_52w', 'delivery_pct'],
  },
  {
    id: 'rsi-under-30',
    group: 'technicals',
    theme: 'Overbought / oversold',
    name: 'RSI 30 or less, profitable',
    blurb:
      'Daily RSI (14) of 30 or less, with ₹1 Cr+ net profit over the last four quarters and ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'rsi14', max: 30},
      {field: 'pat', min: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['rsi14'],
  },
  {
    id: 'below-lower-band',
    group: 'technicals',
    theme: 'Overbought / oversold',
    name: 'At or below the lower Bollinger band',
    blurb:
      'A daily close at or below the lower Bollinger band (20, 2), with ₹1 Cr+ net profit over the last four quarters and ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'bb_pctb', max: 0},
      {field: 'pat', min: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['bb_pctb', 'rsi14'],
  },
  {
    id: 'ema20-pullback',
    group: 'technicals',
    theme: 'Pullbacks',
    name: 'Resting on the 20-day EMA',
    blurb:
      'A close 0–2% above the 20-day EMA while the 20-day EMA is above the 50-day, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'dist_ema20', min: 0, max: 2},
      {field: 'ema20', op: 'gt', ref: 'ema50', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['ema50'],
  },
  {
    id: 'at-200dma',
    group: 'technicals',
    theme: 'Pullbacks',
    name: 'At the 200-day average',
    blurb:
      'A close 0–3% above the 200-day average while the 50-day is above the 200-day, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'dist_sma200', min: 0, max: 3},
      {field: 'sma50', op: 'gt', ref: 'sma200', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['sma200'],
  },
  {
    id: 'at-50dma',
    group: 'technicals',
    theme: 'Pullbacks',
    name: 'At the 50-day average',
    blurb:
      'A close 0–2% above the 50-day average while the 50-day is above the 200-day, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'dist_sma50', min: 0, max: 2},
      {field: 'sma50', op: 'gt', ref: 'sma200', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['sma200'],
  },
  {
    id: 'stoch-oversold-turn',
    group: 'technicals',
    theme: 'Reversals',
    name: 'Stochastic %K over %D, oversold',
    blurb:
      'Daily stochastic %K (14) of 20 or less and above its %D (3), ₹1 Cr+ traded a day on average.',
    // Two filters on %K: a range and a comparison are separate conditions.
    filters: [
      {field: 'stoch_k', max: 20},
      {field: 'stoch_k', op: 'gt', ref: 'ind.stochastic_d_3', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['ind.stochastic_d_3'],
  },
  {
    id: 'monthly-momentum',
    group: 'technicals',
    theme: 'Momentum',
    name: 'One-month momentum, trending',
    blurb:
      'Up 10%+ over the last month, above the 50-day average, ADX (14) of 25 or more and within 10% of the 52-week high, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'return_1m', min: 10},
      {field: 'above_sma50', flag: true},
      {field: 'adx14', min: 25},
      {field: 'from_high_52w', min: -10},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['return_1m', 'adx14'],
  },
  {
    id: 'rsi-80',
    group: 'technicals',
    theme: 'Overbought / oversold',
    name: 'RSI 80 or more',
    blurb: 'Daily RSI (14) of 80 or more, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'rsi14', min: 80},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['rsi14', 'return_1m'],
  },
  {
    id: 'adx-uptrend',
    group: 'technicals',
    theme: 'Trend',
    name: 'Trending up (ADX 25+)',
    blurb:
      'ADX (14) of 25 or more with +DI above −DI, and a close above the 50-day average, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'adx14', min: 25},
      {field: 'di_plus', op: 'gt', ref: 'di_minus', factor: 1},
      {field: 'above_sma50', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['adx14', 'di_minus'],
  },
  {
    id: 'ema-stack-up',
    group: 'technicals',
    theme: 'Trend',
    name: 'EMAs stacked up (20 > 50 > 200)',
    blurb:
      'The close above the 20-day EMA, the 20-day above the 50-day and the 50-day above the 200-day, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'close', op: 'gt', ref: 'ema20', factor: 1},
      {field: 'ema20', op: 'gt', ref: 'ema50', factor: 1},
      {field: 'ema50', op: 'gt', ref: 'ema200', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['ema200'],
  },
  {
    id: 'aroon-uptrend',
    group: 'technicals',
    theme: 'Trend',
    name: 'Aroon uptrend',
    blurb:
      'Daily Aroon up (14) of 70 or more and Aroon down of 30 or less, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'ind.aroon_up', min: 70},
      {field: 'ind.aroon_down', max: 30},
      {field: 'traded_value20', min: 1},
    ],
  },
  {
    id: 'death-cross',
    group: 'technicals',
    theme: 'Crossovers',
    name: 'Death cross',
    blurb:
      'The 50-day average crossed below the 200-day in the last ten sessions, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'death_cross', flag: true},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['dist_sma50', 'dist_sma200'],
  },
  {
    id: 'ema-stack-down',
    group: 'technicals',
    theme: 'Trend',
    name: 'EMAs stacked down (20 < 50 < 200)',
    blurb:
      'The close below the 20-day EMA, the 20-day below the 50-day and the 50-day below the 200-day, ₹1 Cr+ traded a day on average.',
    filters: [
      {field: 'close', op: 'lt', ref: 'ema20', factor: 1},
      {field: 'ema20', op: 'lt', ref: 'ema50', factor: 1},
      {field: 'ema50', op: 'lt', ref: 'ema200', factor: 1},
      {field: 'traded_value20', min: 1},
    ],
    columns: ['ema200'],
  },
  {
    id: 'quality-on-sale',
    group: 'fundamentals',
    theme: 'Quality',
    name: 'Quality near its lows',
    blurb:
      'ROE of 15%+ and debt-to-equity of 1 or less, within 10% of the 52-week low, ₹500 Cr+.',
    filters: [
      {field: 'from_low_52w', max: 10},
      {field: 'roe', min: 15},
      {field: 'debt_to_equity', max: 1},
      {field: 'market_cap', min: 500},
    ],
    columns: ['from_low_52w', 'roe'],
  },
  {
    id: 'opt-long-buildup',
    group: 'fno',
    theme: 'Futures buildup',
    name: 'Long buildup (F&O)',
    blurb:
      'The most-traded future up on the day with open interest up 3%+, conventionally read as new longs.',
    universes: ['fno'],
    filters: [
      {field: 'long_buildup', flag: true},
      {field: 'fut_oi_chg_pct', min: 3},
    ],
    columns: ['fut_oi_chg_pct', 'fut_price_chg_pct'],
    sort: {key: 'fut_oi_chg_pct', dir: 'desc'},
  },
  {
    id: 'opt-short-buildup',
    group: 'fno',
    theme: 'Futures buildup',
    name: 'Short buildup (F&O)',
    blurb:
      'The most-traded future down on the day with open interest up 3%+, conventionally read as new shorts.',
    universes: ['fno'],
    filters: [
      {field: 'short_buildup', flag: true},
      {field: 'fut_oi_chg_pct', min: 3},
    ],
    columns: ['fut_oi_chg_pct', 'fut_price_chg_pct'],
    sort: {key: 'fut_oi_chg_pct', dir: 'desc'},
  },
  {
    id: 'opt-rich-iv',
    group: 'fno',
    theme: 'Volatility',
    name: 'Rich options (high IV rank)',
    blurb:
      'IV rank of 70+ (near the top of its range, up to a year kept), IV at or above 20-day realised volatility, and an ATM spread of 5% or less.',
    universes: ['fno'],
    filters: [
      {field: 'iv_rank', min: 70},
      {field: 'iv_hv_spread', min: 0},
      {field: 'atm_spread_pct', max: 5},
    ],
    columns: ['atm_iv', 'iv_rank', 'iv_hv_spread'],
    sort: {key: 'iv_rank', dir: 'desc'},
  },
  {
    id: 'opt-cheap-iv',
    group: 'fno',
    theme: 'Volatility',
    name: 'Cheap options (low IV rank)',
    blurb:
      'IV rank of 25 or less (near the bottom of its range, up to a year kept), and an ATM spread of 5% or less.',
    universes: ['fno'],
    filters: [
      {field: 'iv_rank', max: 25},
      {field: 'atm_spread_pct', max: 5},
    ],
    columns: ['atm_iv', 'iv_rank', 'expected_move_pct'],
    sort: {key: 'iv_rank', dir: 'asc'},
  },
  {
    id: 'opt-unusual',
    group: 'fno',
    theme: 'Option activity',
    name: 'Unusual option activity',
    blurb:
      'At least one nearest-expiry contract trading five times its open interest or more, on 500+ lots.',
    universes: ['fno'],
    filters: [{field: 'unusual_contracts', min: 1}],
    columns: ['unusual_contracts', 'max_vol_oi', 'pcr_volume'],
    sort: {key: 'unusual_contracts', dir: 'desc'},
  },
  {
    id: 'opt-put-heavy',
    group: 'fno',
    theme: 'Option activity',
    name: 'Put-heavy (PCR 1.2+)',
    blurb:
      'Nearest-expiry put open interest at least 1.2× call open interest, read as hedging, bearish bets or support.',
    universes: ['fno'],
    filters: [{field: 'pcr_oi', min: 1.2}],
    columns: ['pcr_oi', 'put_wall_dist_pct', 'max_pain_dist_pct'],
    sort: {key: 'pcr_oi', dir: 'desc'},
  },
  {
    id: 'opt-big-move',
    group: 'fno',
    theme: 'Volatility',
    name: 'Big move priced in',
    blurb:
      "The nearest expiry's at-the-money straddle costs 5%+ of the price: the move options price in by expiry.",
    universes: ['fno'],
    filters: [{field: 'expected_move_pct', min: 5}],
    columns: ['expected_move_pct', 'atm_iv', 'dte'],
    sort: {key: 'expected_move_pct', dir: 'desc'},
  },
  // RegimePulse: options-regime screens on the "Options regime" fields (L4)
  {
    id: 'regime-leaning-up',
    group: 'fno',
    theme: 'Options regime',
    name: 'Options leaning up',
    blurb: 'The options regime reads bullish or neutral-to-bullish.',
    filters: [{field: 'regime_bullish', flag: true}],
    columns: ['regime_z_bias', 'regime_straddle_chg_pct'],
  },
  {
    id: 'regime-leaning-down',
    group: 'fno',
    theme: 'Options regime',
    name: 'Options leaning down',
    blurb: 'The options regime reads bearish or neutral-to-bearish.',
    filters: [{field: 'regime_bearish', flag: true}],
    columns: ['regime_z_bias', 'regime_straddle_chg_pct'],
  },
  {
    id: 'regime-rangebound-melting',
    group: 'fno',
    theme: 'Options regime',
    name: 'Rangebound, premium melting',
    blurb:
      "The options regime reads rangebound, the ATM straddle is down 15% or more since the open, and its IV is below yesterday's close.",
    filters: [
      {field: 'regime_rangebound', flag: true},
      {field: 'regime_straddle_chg_pct', max: -15},
      // Bounds are inclusive; a hair under zero keeps "IV unchanged" out on either unit scale.
      {field: 'regime_straddle_iv_chg', max: -0.0001},
    ],
    columns: ['regime_straddle_chg_pct', 'regime_straddle_iv_chg'],
  },
];
