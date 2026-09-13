// The technical-indicator row the backend computes per symbol and timeframe. Every field is optional:
// the row is sparse by design and each reader null-checks what it uses. Both apps declared this
// beside a hook; the maths that reads it (stock signals, technical signal, indicator config) lives here.
export interface TechnicalIndicatorData {
  id?: number;
  symbol?: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close_price?: number | null;
  volume?: number | null;
  updated_at?: string;
  timestamp?: string;

  ema5?: number | null;
  ema8?: number | null;
  ema9?: number | null;
  ema13?: number | null;
  ema21?: number | null;
  ema50?: number | null;
  ema100?: number | null;
  ema200?: number | null;

  sma9?: number | null;
  sma100?: number | null;

  macd_8_21_9?: number | null;
  macd_histogram?: number | null;

  rsi14?: number | null;
  rsi9?: number | null;
  rsi7?: number | null;

  stochastic_k_14?: number | null;
  stochastic_d_3?: number | null;

  atr14?: number | null;
  percent_b?: number | null;
  supertrend_10_3?: number | null;
  supertrend_direction?: 'UP' | 'DOWN' | 'up' | 'down' | null;
  obv?: number | null;
  volume_ma10?: number | null;
  mfi14?: number | null;
  adx_14?: number | null;
  di_plus_14?: number | null;
  di_minus_14?: number | null;
  vwap?: number | null;
  parabolic_sar?: number | null;
  cci_20?: number | null;
  williams_r_14?: number | null;
  stoch_rsi_k?: number | null;
  stoch_rsi_d?: number | null;
  keltner_upper?: number | null;
  keltner_lower?: number | null;
  donchian_upper?: number | null;
  donchian_lower?: number | null;
  ichimoku_conversion?: number | null;
  ichimoku_base?: number | null;
  ichimoku_span_a?: number | null;
  ichimoku_span_b?: number | null;

  doji?: boolean | null;
  hammer?: boolean | null;
  inverted_hammer?: boolean | null;
  shooting_star?: boolean | null;
  hanging_man?: boolean | null;
  marubozu_bullish?: boolean | null;
  marubozu_bearish?: boolean | null;
  bullish_engulfing?: boolean | null;
  bearish_engulfing?: boolean | null;
  harami_bullish?: boolean | null;
  harami_bearish?: boolean | null;
  tweezer_top?: boolean | null;
  tweezer_bottom?: boolean | null;
  piercing_pattern?: boolean | null;
  dark_cloud_cover?: boolean | null;
  morning_star?: boolean | null;
  evening_star?: boolean | null;
  three_white_soldiers?: boolean | null;
  three_black_crows?: boolean | null;
  three_inside_up?: boolean | null;
  three_inside_down?: boolean | null;
  long_legged_doji?: boolean | null;
  dragonfly_doji?: boolean | null;
  gravestone_doji?: boolean | null;
  rising_three_methods?: boolean | null;
  falling_three_methods?: boolean | null;
  cup_and_handle?: boolean | null;
  ascending_triangle?: boolean | null;
  descending_triangle?: boolean | null;
  symmetrical_triangle?: boolean | null;
  pivot_point?: number | null;
  pivot_r1?: number | null;
  pivot_r2?: number | null;
  pivot_r3?: number | null;
  pivot_s1?: number | null;
  pivot_s2?: number | null;
  pivot_s3?: number | null;

  avg_price?: number | null;
  median_price?: number | null;
  typical_price?: number | null;
  momentum10?: number | null;
  roc12?: number | null;
  net_volume?: number | null;
  bop?: number | null;
  stddev20?: number | null;
  bb_width?: number | null;
  dpo20?: number | null;
  majority_rule?: number | null;

  wma20?: number | null;
  dema20?: number | null;
  tema20?: number | null;
  hma20?: number | null;
  smma20?: number | null;
  alma?: number | null;
  mcginley?: number | null;
  kama?: number | null;
  hamma20?: number | null;
  ma_channel_upper?: number | null;
  ma_channel_lower?: number | null;

  gmma_short_3?: number | null;
  gmma_short_5?: number | null;
  gmma_short_8?: number | null;
  gmma_short_10?: number | null;
  gmma_short_12?: number | null;
  gmma_short_15?: number | null;
  gmma_long_30?: number | null;
  gmma_long_35?: number | null;
  gmma_long_40?: number | null;
  gmma_long_45?: number | null;
  gmma_long_50?: number | null;
  gmma_long_60?: number | null;

  lsma20?: number | null;
  linreg_curve?: number | null;
  linreg_slope?: number | null;
  stderr20?: number | null;
  se_band_upper?: number | null;
  se_band_lower?: number | null;
  trend_strength?: number | null;

  ema_cross?: number | null;
  ma_cross?: number | null;
  ma_ema_cross?: number | null;

  aroon_up?: number | null;
  aroon_down?: number | null;
  cmo14?: number | null;
  trix?: number | null;
  tsi?: number | null;
  ppo?: number | null;
  coppock?: number | null;
  kst?: number | null;
  kst_signal?: number | null;
  fisher?: number | null;
  fisher_trigger?: number | null;
  rvi?: number | null;
  rvi_signal?: number | null;
  smi_ergodic?: number | null;
  smi_signal?: number | null;
  connors_rsi?: number | null;
  klinger?: number | null;
  klinger_signal?: number | null;
  ao?: number | null;
  ultimate_osc?: number | null;

  hist_vol?: number | null;
  vol_cc?: number | null;
  vol_ohlc?: number | null;
  vol_zt_cc?: number | null;
  volatility_index?: number | null;
  chaikin_vol?: number | null;
  chop_zone?: number | null;
  choppiness14?: number | null;
  envelope_upper?: number | null;
  envelope_lower?: number | null;
  price_channel_upper?: number | null;
  price_channel_lower?: number | null;
  ck_stop_long?: number | null;
  ck_stop_short?: number | null;
  vi_plus?: number | null;
  vi_minus?: number | null;
  mass_index?: number | null;
  asi?: number | null;

  adl?: number | null;
  cmf20?: number | null;
  chaikin_osc?: number | null;
  pvt?: number | null;
  eom14?: number | null;
  efi13?: number | null;
  volume_osc?: number | null;
  vwma20?: number | null;
  rvi_vol?: number | null;

  alligator_jaw?: number | null;
  alligator_teeth?: number | null;
  alligator_lips?: number | null;
  fractal_up?: boolean | null;
  fractal_down?: boolean | null;
  zigzag_pivot?: number | null;

  stock_symbol: string;
  rsi?: number;
  macd?: number;
  signal?: number;
  macd_signal?: number;
  sma_20?: number;
  sma50?: number;
  sma_200?: number;
  ema_12?: number;
  ema_26?: number;
  bb_upper?: number;
  bb_lower?: number;
  bollinger_upper?: number;
  bollinger_lower?: number;
  bollinger_middle?: number;
  adx?: number;
  stochastic_k?: number;
  stochastic_d?: number;
}
