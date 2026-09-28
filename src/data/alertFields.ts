/**
 * Everything an alert can watch, as the person picking it would name it.
 *
 * `id` is the engine column the condition compiles to — every technical here is
 * in Sentinel's RESOLVABLE_FIELDS (llm/graph/nodes/strategy/alpha/sentinel_fields.py)
 * or its capability manifest, the fundamentals are the compiler's whitelist names
 * (the same list STRATEGY_INDICATOR_OPTIONS offers the rule editor), and the F&O
 * fields are FNO_INDICATOR_MAP's. A field the engine can't read has no business
 * in a list that promises to alert on it, so this is curated rather than
 * derived from the chart's catalog, whose ids are TradingView study names.
 *
 * `kind` decides the sentence the field makes:
 *   price       a rupee level      "Price rises above ₹2,500"
 *   line        a rupee line       "Price crosses above EMA 50" (picked, it becomes the target)
 *   bounded     an oscillator      "RSI (14) falls below 30"
 *   number      anything else      "PE ratio is below 20"
 *   pattern     a yes/no signal    "Bullish engulfing appears"
 *   daymove     the derived day's % change against yesterday's close
 *
 * Labels, hints and sections are English data, as the indicator catalogue's
 * are; the tabs and the expiry choices are few enough for an app to word itself.
 */
export type AlertTab =
  'popular' | 'price' | 'technical' | 'fundamental' | 'fno';
export type AlertFieldKind =
  'price' | 'line' | 'bounded' | 'number' | 'pattern' | 'daymove';

export interface AlertField {
  id: string;
  label: string;
  tab: Exclude<AlertTab, 'popular'>;
  section: string;
  kind: AlertFieldKind;
  unit?: '₹' | '%' | 'x' | '₹ Cr' | undefined;
  /** Levels worth one tap — the band people actually alert on. */
  presets?: number[] | undefined;
  /** One line, in plain words, under the field in the picker. */
  hint?: string | undefined;
  keywords?: string[] | undefined;
  /** Published once a day; an alert using one is checked on the daily close. */
  daily?: boolean | undefined;
  /** Reads a specific option contract, so the alert needs one chosen. */
  contract?: boolean | undefined;
}

export const ALERT_TABS: readonly {id: AlertTab; label: string}[] = [
  {id: 'popular', label: 'Popular'},
  {id: 'price', label: 'Price & volume'},
  {id: 'technical', label: 'Technicals'},
  {id: 'fundamental', label: 'Fundamentals'},
  {id: 'fno', label: 'F&O'},
];

const price = (
  id: string,
  label: string,
  section: string,
  hint?: string,
  keywords?: string[],
): AlertField => ({
  id,
  label,
  tab: 'price',
  section,
  kind: 'price',
  unit: '₹',
  hint,
  keywords,
});

const line = (
  id: string,
  label: string,
  section: string,
  hint?: string,
  keywords?: string[],
): AlertField => ({
  id,
  label,
  tab: 'technical',
  section,
  kind: 'line',
  unit: '₹',
  hint,
  keywords,
});

const bounded = (
  id: string,
  label: string,
  section: string,
  presets: number[],
  hint?: string,
  keywords?: string[],
): AlertField => ({
  id,
  label,
  tab: 'technical',
  section,
  kind: 'bounded',
  presets,
  hint,
  keywords,
});

const pattern = (
  id: string,
  label: string,
  section: string,
  keywords?: string[],
): AlertField => ({
  id,
  label,
  tab: 'technical',
  section,
  kind: 'pattern',
  keywords,
});

const fundamental = (
  id: string,
  label: string,
  section: string,
  unit?: AlertField['unit'],
  hint?: string,
  keywords?: string[],
): AlertField => ({
  id,
  label,
  tab: 'fundamental',
  section,
  kind: 'number',
  unit,
  hint,
  keywords,
  daily: true,
});

// Named, because it is also what an unknown id reads as.
const PRICE_FIELD = price(
  'close_price',
  'Price',
  'Price',
  'The last traded price',
  ['ltp', 'close', 'last'],
);

export const ALERT_FIELDS: readonly AlertField[] = [
  PRICE_FIELD,
  {
    id: '__day_move',
    label: "Day's % change",
    tab: 'price',
    section: 'Price',
    kind: 'daymove',
    unit: '%',
    presets: [2, 3, 5],
    hint: "How far it has moved since yesterday's close",
    daily: true,
    keywords: ['percent', 'move', 'gain', 'fall', 'change'],
  },
  {
    id: 'gap_pct',
    label: 'Gap at open',
    tab: 'price',
    section: 'Price',
    kind: 'number',
    unit: '%',
    presets: [1, 2],
    hint: "Today's open against yesterday's close",
    keywords: ['gap up', 'gap down'],
  },
  price('open_price', 'Candle open', 'Price'),
  price('high_price', 'Candle high', 'Price'),
  price('low_price', 'Candle low', 'Price'),
  {
    id: 'pct_from_52w_high',
    label: 'Distance from 52-week high',
    tab: 'price',
    section: '52-week range',
    kind: 'number',
    unit: '%',
    presets: [-5, -2, 0],
    hint: '0% is at the high; -5% is 5% below it',
    keywords: ['52 week', 'yearly high', 'breakout'],
  },
  {
    id: 'pct_from_52w_low',
    label: 'Distance from 52-week low',
    tab: 'price',
    section: '52-week range',
    kind: 'number',
    unit: '%',
    presets: [0, 2, 5],
    hint: '0% is at the low; 5% is 5% above it',
    keywords: ['52 week', 'yearly low'],
  },
  {
    id: 'volume',
    label: 'Volume',
    tab: 'price',
    section: 'Volume',
    kind: 'number',
    hint: 'Shares traded in the candle',
  },
  {
    id: 'rvol',
    label: 'Relative volume',
    tab: 'price',
    section: 'Volume',
    kind: 'number',
    unit: 'x',
    presets: [2, 3],
    hint: 'Volume against its usual — 2x is twice normal',
    keywords: ['volume spike', 'unusual'],
  },
  {
    id: 'volume_ma10',
    label: 'Average volume (10)',
    tab: 'price',
    section: 'Volume',
    kind: 'number',
  },
  {
    id: 'vwap',
    label: 'VWAP',
    tab: 'price',
    section: 'Volume',
    kind: 'line',
    unit: '₹',
    hint: 'Volume-weighted average price for the day',
    keywords: ['volume weighted'],
  },

  line('ema9', 'EMA 9', 'Moving averages'),
  line('ema21', 'EMA 21', 'Moving averages'),
  line(
    'ema50',
    'EMA 50',
    'Moving averages',
    'The 50-period exponential average',
    ['exponential'],
  ),
  line('ema100', 'EMA 100', 'Moving averages'),
  line('ema200', 'EMA 200', 'Moving averages', 'The long-term trend line', [
    'exponential',
  ]),
  line('sma20', 'SMA 20', 'Moving averages', undefined, ['simple']),
  line('sma50', 'SMA 50', 'Moving averages', undefined, ['simple']),
  line('sma100', 'SMA 100', 'Moving averages', undefined, ['simple']),
  line(
    'sma200',
    'SMA 200',
    'Moving averages',
    'Price above it is the classic long-term uptrend',
    ['simple'],
  ),
  line('wma20', 'WMA 20', 'Moving averages', undefined, ['weighted']),
  line('hma20', 'Hull MA 20', 'Moving averages', undefined, ['hull']),
  line(
    'supertrend_10_3',
    'Supertrend (10, 3)',
    'Moving averages',
    'Flips when price crosses it',
    ['trend'],
  ),
  line('parabolic_sar', 'Parabolic SAR', 'Moving averages', undefined, [
    'sar',
    'stop',
  ]),

  bounded(
    'rsi14',
    'RSI (14)',
    'Momentum',
    [30, 70],
    'Under 30 reads oversold, over 70 overbought',
    ['relative strength'],
  ),
  bounded('rsi9', 'RSI (9)', 'Momentum', [30, 70]),
  bounded('rsi7', 'RSI (7)', 'Momentum', [20, 80]),
  bounded(
    'stochastic_k_14',
    'Stochastic %K (14)',
    'Momentum',
    [20, 80],
    'Under 20 oversold, over 80 overbought',
    ['stoch'],
  ),
  bounded('stoch_rsi_k', 'Stochastic RSI %K', 'Momentum', [20, 80], undefined, [
    'stoch rsi',
  ]),
  bounded(
    'williams_r_14',
    'Williams %R (14)',
    'Momentum',
    [-80, -20],
    'Under -80 oversold, over -20 overbought',
  ),
  bounded(
    'mfi14',
    'Money Flow Index (14)',
    'Momentum',
    [20, 80],
    'RSI weighted by volume',
    ['mfi'],
  ),
  bounded(
    'cci_20',
    'CCI (20)',
    'Momentum',
    [-100, 100],
    'Beyond ±100 is a stretched move',
    ['commodity channel'],
  ),
  {
    id: 'roc12',
    label: 'Rate of change (12)',
    tab: 'technical',
    section: 'Momentum',
    kind: 'number',
    unit: '%',
    presets: [0],
  },

  {
    id: 'macd_12_26_histogram',
    label: 'MACD histogram (12, 26)',
    tab: 'technical',
    section: 'Trend',
    kind: 'number',
    presets: [0],
    hint: 'Crossing 0 is MACD crossing its signal line',
    keywords: ['macd crossover'],
  },
  {
    id: 'macd_8_21_9',
    label: 'MACD (8, 21, 9)',
    tab: 'technical',
    section: 'Trend',
    kind: 'number',
    presets: [0],
  },
  bounded(
    'adx_14',
    'ADX (14)',
    'Trend',
    [20, 25],
    'Above 25 is a trending market',
    ['trend strength', 'dmi'],
  ),
  bounded('di_plus_14', '+DI (14)', 'Trend', [25], undefined, [
    'dmi',
    'directional',
  ]),
  bounded('di_minus_14', '-DI (14)', 'Trend', [25], undefined, [
    'dmi',
    'directional',
  ]),
  bounded('aroon_up', 'Aroon up', 'Trend', [70]),
  bounded('aroon_down', 'Aroon down', 'Trend', [70]),

  {
    id: 'atr14',
    label: 'ATR (14)',
    tab: 'technical',
    section: 'Volatility',
    kind: 'number',
    unit: '₹',
    hint: 'Average range of a candle, in rupees',
    keywords: ['average true range'],
  },
  {
    id: 'atr_pct',
    label: 'ATR %',
    tab: 'technical',
    section: 'Volatility',
    kind: 'number',
    unit: '%',
  },
  line('bollinger_upper', 'Bollinger upper band', 'Volatility', undefined, [
    'bb',
  ]),
  line('bollinger_middle', 'Bollinger middle band', 'Volatility', undefined, [
    'bb',
  ]),
  line('bollinger_lower', 'Bollinger lower band', 'Volatility', undefined, [
    'bb',
  ]),
  {
    id: 'percent_b',
    label: 'Bollinger %B',
    tab: 'technical',
    section: 'Volatility',
    kind: 'number',
    presets: [0, 1],
    hint: 'Above 1 is outside the upper band, below 0 outside the lower',
    keywords: ['bb'],
  },
  {
    id: 'bb_width',
    label: 'Bollinger width',
    tab: 'technical',
    section: 'Volatility',
    kind: 'number',
    hint: 'Narrow bands often come before a big move',
    keywords: ['squeeze'],
  },
  line('keltner_upper', 'Keltner upper', 'Volatility'),
  line('keltner_lower', 'Keltner lower', 'Volatility'),
  line(
    'donchian_upper',
    'Donchian upper',
    'Volatility',
    'The highest high of the channel',
    ['breakout'],
  ),
  line(
    'donchian_lower',
    'Donchian lower',
    'Volatility',
    'The lowest low of the channel',
  ),
  {
    id: 'hist_vol',
    label: 'Historical volatility',
    tab: 'technical',
    section: 'Volatility',
    kind: 'number',
    unit: '%',
  },

  line('pivot_point', 'Pivot point', 'Levels', "Today's classic pivot"),
  line('pivot_r1', 'Resistance R1', 'Levels', undefined, ['pivot']),
  line('pivot_r2', 'Resistance R2', 'Levels', undefined, ['pivot']),
  line('pivot_s1', 'Support S1', 'Levels', undefined, ['pivot']),
  line('pivot_s2', 'Support S2', 'Levels', undefined, ['pivot']),
  line('cpr_tc', 'CPR top', 'Levels', 'Top of the central pivot range', [
    'central pivot',
  ]),
  line('cpr_bc', 'CPR bottom', 'Levels', 'Bottom of the central pivot range', [
    'central pivot',
  ]),

  bounded(
    'cmf20',
    'Chaikin Money Flow (20)',
    'Volume',
    [0],
    'Above 0 means buying pressure',
    ['cmf'],
  ),
  {
    id: 'obv',
    label: 'On-balance volume',
    tab: 'technical',
    section: 'Volume',
    kind: 'number',
    keywords: ['obv'],
  },

  pattern('bullish_engulfing', 'Bullish engulfing', 'Candle patterns'),
  pattern('bearish_engulfing', 'Bearish engulfing', 'Candle patterns'),
  pattern('hammer', 'Hammer', 'Candle patterns'),
  pattern('inverted_hammer', 'Inverted hammer', 'Candle patterns'),
  pattern('shooting_star', 'Shooting star', 'Candle patterns'),
  pattern('hanging_man', 'Hanging man', 'Candle patterns'),
  pattern('doji', 'Doji', 'Candle patterns'),
  pattern('morning_star', 'Morning star', 'Candle patterns'),
  pattern('evening_star', 'Evening star', 'Candle patterns'),
  pattern('piercing_pattern', 'Piercing line', 'Candle patterns'),
  pattern('dark_cloud_cover', 'Dark cloud cover', 'Candle patterns'),
  pattern('harami_bullish', 'Bullish harami', 'Candle patterns'),
  pattern('harami_bearish', 'Bearish harami', 'Candle patterns'),
  pattern('three_white_soldiers', 'Three white soldiers', 'Candle patterns'),
  pattern('three_black_crows', 'Three black crows', 'Candle patterns'),
  pattern('marubozu_bullish', 'Bullish marubozu', 'Candle patterns'),
  pattern('marubozu_bearish', 'Bearish marubozu', 'Candle patterns'),

  pattern('double_bottom', 'Double bottom', 'Chart patterns'),
  pattern('double_top', 'Double top', 'Chart patterns'),
  pattern('triple_bottom', 'Triple bottom', 'Chart patterns'),
  pattern('triple_top', 'Triple top', 'Chart patterns'),
  pattern('head_and_shoulders', 'Head and shoulders', 'Chart patterns'),
  pattern(
    'inverse_head_and_shoulders',
    'Inverse head and shoulders',
    'Chart patterns',
  ),
  pattern('cup_and_handle', 'Cup and handle', 'Chart patterns'),
  pattern('ascending_triangle', 'Ascending triangle', 'Chart patterns'),
  pattern('descending_triangle', 'Descending triangle', 'Chart patterns'),
  pattern('symmetrical_triangle', 'Symmetrical triangle', 'Chart patterns'),
  pattern('bullish_flag', 'Bull flag', 'Chart patterns'),
  pattern('bearish_flag', 'Bear flag', 'Chart patterns'),
  pattern('rounding_bottom', 'Rounding bottom', 'Chart patterns'),

  fundamental(
    'pe_ttm',
    'PE ratio',
    'Valuation',
    'x',
    "Price over the last 12 months' earnings",
    ['p/e', 'price to earnings'],
  ),
  fundamental('pb_mrq', 'PB ratio', 'Valuation', 'x', 'Price over book value', [
    'p/b',
    'price to book',
  ]),
  fundamental('ev_ebitda', 'EV / EBITDA', 'Valuation', 'x'),
  fundamental('price_to_cash_flow', 'Price to cash flow', 'Valuation', 'x'),
  fundamental('market_cap', 'Market cap', 'Valuation', '₹ Cr', undefined, [
    'mcap',
    'size',
  ]),
  fundamental('roe', 'Return on equity (ROE)', 'Profitability', '%'),
  fundamental('roce', 'Return on capital (ROCE)', 'Profitability', '%'),
  fundamental('roa', 'Return on assets (ROA)', 'Profitability', '%'),
  fundamental('net_margin', 'Net profit margin', 'Profitability', '%'),
  fundamental('operating_margin', 'Operating margin', 'Profitability', '%'),
  fundamental('revenue_growth', 'Revenue growth', 'Growth', '%', undefined, [
    'sales',
  ]),
  fundamental('eps_growth', 'EPS growth', 'Growth', '%', undefined, [
    'earnings',
  ]),
  fundamental('eps_basic', 'EPS', 'Growth', '₹', 'Earnings per share'),
  fundamental('bvps', 'Book value per share', 'Growth', '₹'),
  fundamental(
    'debt_equity',
    'Debt to equity',
    'Balance sheet',
    'x',
    undefined,
    ['leverage', 'd/e'],
  ),
  fundamental(
    'current_ratio',
    'Current ratio',
    'Balance sheet',
    'x',
    undefined,
    ['liquidity'],
  ),
  fundamental('dividend_yield', 'Dividend yield', 'Dividends & holdings', '%'),
  fundamental('payout_ratio', 'Payout ratio', 'Dividends & holdings', '%'),
  fundamental(
    'promoter',
    'Promoter holding',
    'Dividends & holdings',
    '%',
    undefined,
    ['shareholding'],
  ),
  fundamental(
    'promoter_pledge_pct',
    'Promoter pledge',
    'Dividends & holdings',
    '%',
    'Share of promoter holding pledged',
  ),
  fundamental('fii', 'FII holding', 'Dividends & holdings', '%', undefined, [
    'foreign',
    'fpi',
  ]),
  fundamental('dii', 'DII holding', 'Dividends & holdings', '%', undefined, [
    'domestic',
  ]),
  fundamental('mf', 'Mutual fund holding', 'Dividends & holdings', '%'),

  {
    id: 'ltp',
    label: 'Option premium',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    unit: '₹',
    contract: true,
    hint: "The chosen option's last traded price",
    keywords: ['premium', 'option price'],
  },
  {
    id: 'iv',
    label: 'Implied volatility (IV)',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    unit: '%',
    contract: true,
    presets: [15, 20, 30],
    hint: 'What the market expects the stock to swing',
    keywords: ['volatility'],
  },
  {
    id: 'delta',
    label: 'Delta',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    contract: true,
    presets: [0.3, 0.5],
    hint: 'How much the premium moves per ₹1 in the stock',
    keywords: ['greeks'],
  },
  {
    id: 'gamma',
    label: 'Gamma',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    contract: true,
    keywords: ['greeks'],
  },
  {
    id: 'theta',
    label: 'Theta',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    contract: true,
    hint: 'Premium lost to time each day',
    keywords: ['greeks', 'decay'],
  },
  {
    id: 'vega',
    label: 'Vega',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    contract: true,
    keywords: ['greeks'],
  },
  {
    id: 'open_interest',
    label: 'Open interest',
    tab: 'fno',
    section: 'Option contract',
    kind: 'number',
    contract: true,
    hint: 'Contracts still open on the chosen option',
    keywords: ['oi'],
  },
  {
    id: 'max_call_oi_strike',
    label: 'Highest call OI strike',
    tab: 'fno',
    section: 'Option chain',
    kind: 'number',
    unit: '₹',
    hint: 'Where call writers are heaviest — often read as resistance',
    keywords: ['oi', 'resistance'],
  },
  {
    id: 'max_put_oi_strike',
    label: 'Highest put OI strike',
    tab: 'fno',
    section: 'Option chain',
    kind: 'number',
    unit: '₹',
    hint: 'Where put writers are heaviest — often read as support',
    keywords: ['oi', 'support'],
  },
  {
    id: 'max_call_oi',
    label: 'Highest call OI',
    tab: 'fno',
    section: 'Option chain',
    kind: 'number',
    keywords: ['oi'],
  },
  {
    id: 'max_put_oi',
    label: 'Highest put OI',
    tab: 'fno',
    section: 'Option chain',
    kind: 'number',
    keywords: ['oi'],
  },
  {
    id: 'atm_strike',
    label: 'At-the-money strike',
    tab: 'fno',
    section: 'Option chain',
    kind: 'number',
    unit: '₹',
    keywords: ['atm'],
  },
  {
    id: 'futures_ltp',
    label: 'Futures price',
    tab: 'fno',
    section: 'Futures',
    kind: 'number',
    unit: '₹',
    keywords: ['fut'],
  },
  {
    id: 'basis',
    label: 'Futures basis',
    tab: 'fno',
    section: 'Futures',
    kind: 'number',
    unit: '₹',
    hint: 'Futures price minus spot',
    keywords: ['premium', 'discount'],
  },
  {
    id: 'basis_percent',
    label: 'Futures basis %',
    tab: 'fno',
    section: 'Futures',
    kind: 'number',
    unit: '%',
  },
];

const BY_ID = new Map(ALERT_FIELDS.map(f => [f.id, f]));

/** A field by id, reading an id the picker does not offer as the price. */
export const alertField = (id: string): AlertField =>
  BY_ID.get(id) ?? PRICE_FIELD;

/** A field of the picker, or undefined for an id it does not offer. */
export const findAlertField = (id: string): AlertField | undefined =>
  BY_ID.get(id);

/** The first screen of the picker: what most alerts are, one from each world. */
export const POPULAR_FIELD_IDS: readonly string[] = [
  'close_price',
  '__day_move',
  'rsi14',
  'ema50',
  'sma200',
  'rvol',
  'pct_from_52w_high',
  'bullish_engulfing',
  'pe_ttm',
  'iv',
  'max_call_oi_strike',
];

/** A tab's sections, in catalogue order. */
export const sectionsOf = (tab: AlertTab): string[] =>
  Array.from(
    new Set(ALERT_FIELDS.filter(f => f.tab === tab).map(f => f.section)),
  );

/** Word-prefix search, the way the chart's indicator picker searches. */
export const searchAlertFields = (query: string): AlertField[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return ALERT_FIELDS.filter(f => {
    const hay = [
      f.label,
      f.section,
      f.id.replace(/_/g, ' '),
      ...(f.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase();
    const tokens = hay.split(/[\s(),/%-]+/);
    return words.every(
      w => tokens.some(t => t.startsWith(w)) || hay.includes(w),
    );
  });
};

/** Which contract of a chain an F&O alert reads, by expiry. */
export type AlertExpiry = 'current' | 'next_week' | 'monthly' | 'next_month';

/** Moneyness, side and expiry for fields that read one contract. Expiry names
 *  are ExpirySelection's (llm/graph/nodes/strategy/alpha/fno_ir_schema.py). */
export const EXPIRY_CHOICES: readonly {value: AlertExpiry; label: string}[] = [
  {value: 'current', label: 'This week'},
  {value: 'next_week', label: 'Next week'},
  {value: 'monthly', label: 'This month'},
  {value: 'next_month', label: 'Next month'},
];
