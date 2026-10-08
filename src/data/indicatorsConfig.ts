/**
 * Every technical column the stock-detail indicators panel renders, grouped and labelled. Kept
 * 1:1 with the producer (refresher/database/column_defs.py) and the SQL allowlist: the strategy
 * rule picker and the screener's custom-indicator catalog both derive from this list, so a column
 * that was never computed can't be picked and a new one reaches both without a second list.
 *
 * drift resolved 2026-09-13: the web copy (core/patterns/advanced split, 186 keys) won over the
 * mobile single file (209 keys). Web commit 2026-09-07 "drop 23 pattern chips with no canonical
 * detector" removed Heikin Ashi (the Go side approximates ha_open), the chart patterns
 * (cup_and_handle, the triangles - stale one-row snapshots) and twelve candle patterns
 * (advance_block, counter_attack_*, deliberation, descending_hawk, doji_star_*,
 * gap_three_methods_*, homing_pigeon, three_outside_*); the mobile file predates that. Web's
 * value helpers also won: Indian-grouped rupees ("₹1,23,456.00" via formatCurrency, where mobile
 * printed an ungrouped toFixed), "Yes"/"No" flags (mobile: "✓ Yes"), and the longer pivot
 * labels ("Resistance 1", mobile "R1").
 *
 * 2026-09-19: +23 keys, taking this list to 209. Both apps landed them on 2026-09-18 — the old app
 * mirrored them into its single file (`10eb5b0`) and web restored them once detectors existed
 * (`45b4d103`, "Offer every indicator the engine can actually resolve"), so the 2026-09-07 drop was
 * about missing detectors rather than about the columns. Web's grouping and labels are followed
 * again: four sections (Trend-Confirmed Candles, More Double Candle Patterns, Gaps & Range Breaks,
 * Adaptive & Cycle) rather than the old app's three.
 *
 * 2026-09-19, later: +13 more from the old app's `9488c13`, taking this list to 222. All thirteen
 * were already declared in `TechnicalIndicatorData` and live in web, so they are the same
 * two-source case as the 23 above. Web splits them across **two** sections and that split carries
 * meaning: `September Additions` is `priceLevels` — moving averages, chandelier exits, the Ichimoku
 * lagging span and the Heikin Ashi trio, all drawable on the chart — while `Standard MACD & Volume
 * Averages` is not, since an oscillator and an average volume are not price levels. The old app put
 * all thirteen in one section, which would have drawn volume averages as price lines.
 *
 * 2026-09-26: +19 from web's `45b4d103`, taking this list to 241, web's full count. They are the
 * twelve candle patterns and seven Heikin Ashi flags the 2026-09-07 drop removed, which that commit
 * restored alongside the 23 above; the chart patterns stay dropped. This note used to call them
 * web-only, but the old app never dropped them: its single file has carried all nineteen since
 * `4f3549b` (2026-09-04), in its original Double Candle, Triple Candle and Heikin Ashi sections. So
 * this is the two-source case again, and web's grouping and labels are followed: four doubles lead
 * More Double Candle Patterns, and More Triple Candle Patterns and Heikin Ashi Patterns sit before
 * Gaps & Range Breaks. Heikin Ashi returns as rows, not pattern chips: web's PATTERN_SECTIONS still
 * leaves it out, because the Go side only approximates ha_open.
 *
 * 2026-09-27: Adaptive & Cycle moved to the end, after Standard MACD & Volume Averages, where web
 * (`dc29567e`) lists it, so the stock screen's sheet and the rule picker read in web's order.
 */
import {formatCurrency, formatNumber} from '../format/index.ts';
import type {TechnicalIndicatorData} from '../types/indicators.ts';

export type IndicatorKind = 'priceLevel' | 'raw';

export interface IndicatorField {
  label: string;
  key: keyof TechnicalIndicatorData;
  getValue: (data: TechnicalIndicatorData) => string;
  description?: string;
  /** `priceLevel` fields can be drawn on the chart; `raw` ones are text-only. */
  kind?: IndicatorKind;
}

export interface IndicatorSection {
  title: string;
  fields: IndicatorField[];
  defaultCollapsed?: boolean;
  /** Every field in the section is a price level unless it says `kind: 'raw'`. */
  priceLevels?: boolean;
}

export const price = (v: number | null | undefined): string =>
  v != null ? formatCurrency(v, 2) : 'N/A';
export const num = (v: number | null | undefined): string =>
  v != null ? v.toFixed(2) : 'N/A';
export const largeNum = (v: number | null | undefined): string =>
  v != null ? formatNumber(Math.round(v)) : 'N/A';
export const flag = (v: boolean | null | undefined): string =>
  v ? 'Yes' : 'No';

const coreIndicatorSections: IndicatorSection[] = [
  {
    title: 'OHLCV Data',
    fields: [
      {
        label: 'Open',
        key: 'open',
        getValue: data => price(data.open),
        description: 'Opening price',
      },
      {
        label: 'High',
        key: 'high',
        getValue: data => price(data.high),
        description: 'Highest price',
      },
      {
        label: 'Low',
        key: 'low',
        getValue: data => price(data.low),
        description: 'Lowest price',
      },
      {
        label: 'Close',
        key: 'close_price',
        getValue: data => price(data.close_price),
        description: 'Closing price',
      },
      {
        label: 'Volume',
        key: 'volume',
        getValue: data => largeNum(data.volume),
        description: 'Trading volume',
      },
    ],
  },
  {
    title: 'Price & Moving Averages',
    priceLevels: true,
    fields: [
      {
        label: 'EMA 5',
        key: 'ema5',
        getValue: data => price(data.ema5),
        description: '5-period Exponential Moving Average',
      },
      {
        label: 'EMA 8',
        key: 'ema8',
        getValue: data => price(data.ema8),
        description: '8-period Exponential Moving Average',
      },
      {
        label: 'EMA 9',
        key: 'ema9',
        getValue: data => price(data.ema9),
        description: '9-period Exponential Moving Average',
      },
      {
        label: 'EMA 13',
        key: 'ema13',
        getValue: data => price(data.ema13),
        description: '13-period Exponential Moving Average',
      },
      {
        label: 'EMA 21',
        key: 'ema21',
        getValue: data => price(data.ema21),
        description: '21-period Exponential Moving Average',
      },
      {
        label: 'EMA 50',
        key: 'ema50',
        getValue: data => price(data.ema50),
        description: '50-period Exponential Moving Average',
      },
      {
        label: 'EMA 100',
        key: 'ema100',
        getValue: data => price(data.ema100),
        description: '100-period Exponential Moving Average',
      },
      {
        label: 'EMA 200',
        key: 'ema200',
        getValue: data => price(data.ema200),
        description: '200-period Exponential Moving Average',
      },
      {
        label: 'SMA 9',
        key: 'sma9',
        getValue: data => price(data.sma9),
        description: '9-period Simple Moving Average',
      },
      {
        label: 'SMA 50',
        key: 'sma50',
        getValue: data => price(data.sma50),
        description: '50-period Simple Moving Average',
      },
      {
        label: 'SMA 100',
        key: 'sma100',
        getValue: data => price(data.sma100),
        description: '100-period Simple Moving Average',
      },
    ],
  },
  {
    title: 'Momentum Indicators',
    fields: [
      {
        label: 'RSI 14',
        key: 'rsi14',
        getValue: data => num(data.rsi14),
        description: '14-period Relative Strength Index',
      },
      {
        label: 'RSI 9',
        key: 'rsi9',
        getValue: data => num(data.rsi9),
        description: '9-period Relative Strength Index',
      },
      {
        label: 'RSI 7',
        key: 'rsi7',
        getValue: data => num(data.rsi7),
        description: '7-period Relative Strength Index',
      },
      {
        label: 'MACD',
        key: 'macd_8_21_9',
        getValue: data => num(data.macd_8_21_9),
        description: 'MACD Line (8, 21, 9)',
      },
      {
        label: 'MACD Signal',
        key: 'macd_signal',
        getValue: data => num(data.macd_signal),
        description: 'MACD Signal Line',
      },
      {
        label: 'MFI 14',
        key: 'mfi14',
        getValue: data => num(data.mfi14),
        description: '14-period Money Flow Index',
      },
    ],
  },
  {
    title: 'Volatility & Trend',
    priceLevels: true,
    fields: [
      {
        label: 'ATR 14',
        kind: 'raw',
        key: 'atr14',
        getValue: data => num(data.atr14),
        description: '14-period Average True Range',
      },
      {
        label: 'Bollinger Upper',
        key: 'bollinger_upper',
        getValue: data => price(data.bollinger_upper),
        description: 'Upper Bollinger Band',
      },
      {
        label: 'Bollinger Middle',
        key: 'bollinger_middle',
        getValue: data => price(data.bollinger_middle),
        description: 'Middle Bollinger Band',
      },
      {
        label: 'Bollinger Lower',
        key: 'bollinger_lower',
        getValue: data => price(data.bollinger_lower),
        description: 'Lower Bollinger Band',
      },
      {
        label: 'SuperTrend',
        key: 'supertrend_10_3',
        getValue: data => price(data.supertrend_10_3),
        description: 'SuperTrend (10, 3)',
      },
      {
        label: 'Trend Direction',
        kind: 'raw',
        key: 'supertrend_direction',
        getValue: data => {
          const direction = data.supertrend_direction?.toUpperCase();
          return direction === 'UP'
            ? 'Uptrend'
            : direction === 'DOWN'
              ? 'Downtrend'
              : 'N/A';
        },
        description: 'Current trend direction',
      },
    ],
  },
  {
    title: 'Volume & Stochastic',
    fields: [
      {
        label: 'Stochastic K',
        key: 'stochastic_k_14',
        getValue: data => num(data.stochastic_k_14),
        description: '14-period Stochastic K',
      },
      {
        label: 'Stochastic D',
        key: 'stochastic_d_3',
        getValue: data => num(data.stochastic_d_3),
        description: '3-period Stochastic D',
      },
      {
        label: 'Stochastic RSI K',
        key: 'stoch_rsi_k',
        getValue: data => num(data.stoch_rsi_k),
        description: 'Stochastic RSI K Line',
      },
      {
        label: 'Stochastic RSI D',
        key: 'stoch_rsi_d',
        getValue: data => num(data.stoch_rsi_d),
        description: 'Stochastic RSI D Line',
      },
      {
        label: 'OBV',
        key: 'obv',
        getValue: data => largeNum(data.obv),
        description: 'On-Balance Volume',
      },
      {
        label: 'Volume MA 10',
        key: 'volume_ma10',
        getValue: data => largeNum(data.volume_ma10),
        description: '10-period Volume Moving Average',
      },
      {
        label: 'VWAP',
        key: 'vwap',
        // A session's figure: backend-go does not ask Doom for it on 1d or 1w and answers the
        // missing value as 0 (indicators/doom.go intradayOnly, news/gettechnicals.go). No traded
        // stock has a VWAP of 0, so 0 is read as missing.
        getValue: data => price(data.vwap === 0 ? null : data.vwap),
        description: 'Volume Weighted Average Price',
      },
    ],
  },
  {
    title: 'Trend Strength & Direction',
    fields: [
      {
        label: 'ADX 14',
        key: 'adx_14',
        getValue: data => num(data.adx_14),
        description: '14-period Average Directional Index',
      },
      {
        label: '+DI 14',
        key: 'di_plus_14',
        getValue: data => num(data.di_plus_14),
        description: '14-period Plus Directional Indicator',
      },
      {
        label: '-DI 14',
        key: 'di_minus_14',
        getValue: data => num(data.di_minus_14),
        description: '14-period Minus Directional Indicator',
      },
      {
        label: 'Parabolic SAR',
        key: 'parabolic_sar',
        getValue: data => price(data.parabolic_sar),
        description: 'Parabolic Stop and Reverse',
      },
      {
        label: 'CCI 20',
        key: 'cci_20',
        getValue: data => num(data.cci_20),
        description: '20-period Commodity Channel Index',
      },
      {
        label: 'Williams %R 14',
        key: 'williams_r_14',
        getValue: data => num(data.williams_r_14),
        description: '14-period Williams %R',
      },
    ],
  },
  {
    title: 'Channel Indicators',
    priceLevels: true,
    fields: [
      {
        label: 'Keltner Upper',
        key: 'keltner_upper',
        getValue: data => price(data.keltner_upper),
        description: 'Upper Keltner Channel',
      },
      {
        label: 'Keltner Lower',
        key: 'keltner_lower',
        getValue: data => price(data.keltner_lower),
        description: 'Lower Keltner Channel',
      },
      {
        label: 'Donchian Upper',
        key: 'donchian_upper',
        getValue: data => price(data.donchian_upper),
        description: 'Upper Donchian Channel',
      },
      {
        label: 'Donchian Lower',
        key: 'donchian_lower',
        getValue: data => price(data.donchian_lower),
        description: 'Lower Donchian Channel',
      },
    ],
  },
  {
    title: 'Ichimoku Cloud',
    priceLevels: true,
    fields: [
      {
        label: 'Conversion Line',
        key: 'ichimoku_conversion',
        getValue: data => price(data.ichimoku_conversion),
        description: 'Ichimoku Conversion Line (Tenkan-sen)',
      },
      {
        label: 'Base Line',
        key: 'ichimoku_base',
        getValue: data => price(data.ichimoku_base),
        description: 'Ichimoku Base Line (Kijun-sen)',
      },
      {
        label: 'Leading Span A',
        key: 'ichimoku_span_a',
        getValue: data => price(data.ichimoku_span_a),
        description: 'Ichimoku Leading Span A (Senkou Span A)',
      },
      {
        label: 'Leading Span B',
        key: 'ichimoku_span_b',
        getValue: data => price(data.ichimoku_span_b),
        description: 'Ichimoku Leading Span B (Senkou Span B)',
      },
    ],
  },
];

const patternIndicatorSections: IndicatorSection[] = [
  {
    title: 'Single Candle Patterns',
    fields: [
      {
        label: 'Doji',
        key: 'doji',
        getValue: data => flag(data.doji),
        description: 'Indecision pattern - equal open and close prices',
      },
      {
        label: 'Hammer',
        key: 'hammer',
        getValue: data => flag(data.hammer),
        description: 'Bullish reversal - small body with long lower shadow',
      },
      {
        label: 'Inverted Hammer',
        key: 'inverted_hammer',
        getValue: data => flag(data.inverted_hammer),
        description: 'Potential bullish reversal with long upper shadow',
      },
      {
        label: 'Shooting Star',
        key: 'shooting_star',
        getValue: data => flag(data.shooting_star),
        description: 'Bearish reversal - small body with long upper shadow',
      },
      {
        label: 'Hanging Man',
        key: 'hanging_man',
        getValue: data => flag(data.hanging_man),
        description: 'Bearish reversal at top of uptrend',
      },
      {
        label: 'Bullish Marubozu',
        key: 'marubozu_bullish',
        getValue: data => flag(data.marubozu_bullish),
        description: 'Strong bullish - no shadows, close at high',
      },
      {
        label: 'Bearish Marubozu',
        key: 'marubozu_bearish',
        getValue: data => flag(data.marubozu_bearish),
        description: 'Strong bearish - no shadows, close at low',
      },
      {
        label: 'Spinning Top',
        key: 'spinning_top',
        getValue: data => flag(data.spinning_top),
        description: 'Indecision - small body with upper and lower shadows',
      },
      {
        label: 'Long White Candle',
        key: 'long_white_candle',
        getValue: data => flag(data.long_white_candle),
        description: 'Strong bullish - body larger than 1.5x average',
      },
      {
        label: 'Long Black Candle',
        key: 'long_black_candle',
        getValue: data => flag(data.long_black_candle),
        description: 'Strong bearish - body larger than 1.5x average',
      },
      {
        label: 'Bullish Pin Bar',
        key: 'bullish_pin_bar',
        getValue: data => flag(data.bullish_pin_bar),
        description: 'Bullish reversal - long lower wick, small body at top',
      },
      {
        label: 'Bearish Pin Bar',
        key: 'bearish_pin_bar',
        getValue: data => flag(data.bearish_pin_bar),
        description: 'Bearish reversal - long upper wick, small body at bottom',
      },
      {
        label: 'Belt Hold Bullish',
        key: 'belt_hold_bullish',
        getValue: data => flag(data.belt_hold_bullish),
        description: 'Bullish reversal - opens at low with no lower wick',
      },
      {
        label: 'Belt Hold Bearish',
        key: 'belt_hold_bearish',
        getValue: data => flag(data.belt_hold_bearish),
        description: 'Bearish reversal - opens at high with no upper wick',
      },
    ],
  },
  {
    title: 'Double Candle Patterns',
    fields: [
      {
        label: 'Bullish Engulfing',
        key: 'bullish_engulfing',
        getValue: data => flag(data.bullish_engulfing),
        description: 'Bullish reversal - large body engulfs previous candle',
      },
      {
        label: 'Bearish Engulfing',
        key: 'bearish_engulfing',
        getValue: data => flag(data.bearish_engulfing),
        description: 'Bearish reversal - large body engulfs previous candle',
      },
      {
        label: 'Bullish Harami',
        key: 'harami_bullish',
        getValue: data => flag(data.harami_bullish),
        description: 'Bullish reversal - small body inside previous candle',
      },
      {
        label: 'Bearish Harami',
        key: 'harami_bearish',
        getValue: data => flag(data.harami_bearish),
        description: 'Bearish reversal - small body inside previous candle',
      },
      {
        label: 'Tweezer Top',
        key: 'tweezer_top',
        getValue: data => flag(data.tweezer_top),
        description: 'Bearish reversal - matching highs',
      },
      {
        label: 'Tweezer Bottom',
        key: 'tweezer_bottom',
        getValue: data => flag(data.tweezer_bottom),
        description: 'Bullish reversal - matching lows',
      },
      {
        label: 'Piercing Pattern',
        key: 'piercing_pattern',
        getValue: data => flag(data.piercing_pattern),
        description:
          'Bullish reversal - closes above midpoint of previous candle',
      },
      {
        label: 'Dark Cloud Cover',
        key: 'dark_cloud_cover',
        getValue: data => flag(data.dark_cloud_cover),
        description:
          'Bearish reversal - opens above high, closes below midpoint',
      },
      {
        label: 'Harami Cross Bullish',
        key: 'harami_cross_bullish',
        getValue: data => flag(data.harami_cross_bullish),
        description: 'Bullish reversal - doji inside previous bearish candle',
      },
      {
        label: 'Harami Cross Bearish',
        key: 'harami_cross_bearish',
        getValue: data => flag(data.harami_cross_bearish),
        description: 'Bearish reversal - doji inside previous bullish candle',
      },
      {
        label: 'Kicker Bullish',
        key: 'kicker_bullish',
        getValue: data => flag(data.kicker_bullish),
        description: 'Strong bullish reversal - gap up from bearish candle',
      },
      {
        label: 'Kicker Bearish',
        key: 'kicker_bearish',
        getValue: data => flag(data.kicker_bearish),
        description: 'Strong bearish reversal - gap down from bullish candle',
      },
      {
        label: 'On Neck',
        key: 'on_neck',
        getValue: data => flag(data.on_neck),
        description: 'Bearish continuation - close near previous low',
      },
      {
        label: 'Separating Lines Bullish',
        key: 'separating_lines_bullish',
        getValue: data => flag(data.separating_lines_bullish),
        description: 'Bullish continuation - same open, opposite direction',
      },
      {
        label: 'Separating Lines Bearish',
        key: 'separating_lines_bearish',
        getValue: data => flag(data.separating_lines_bearish),
        description: 'Bearish continuation - same open, opposite direction',
      },
      {
        label: 'Matching Low',
        key: 'matching_low',
        getValue: data => flag(data.matching_low),
        description: 'Bullish reversal - two candles with equal lows',
      },
      {
        label: 'Matching High',
        key: 'matching_high',
        getValue: data => flag(data.matching_high),
        description: 'Bearish reversal - two candles with equal highs',
      },
    ],
  },
  {
    title: 'Triple Candle Patterns',
    fields: [
      {
        label: 'Morning Star',
        key: 'morning_star',
        getValue: data => flag(data.morning_star),
        description: 'Bullish reversal - three candle pattern at bottom',
      },
      {
        label: 'Evening Star',
        key: 'evening_star',
        getValue: data => flag(data.evening_star),
        description: 'Bearish reversal - three candle pattern at top',
      },
      {
        label: 'Three White Soldiers',
        key: 'three_white_soldiers',
        getValue: data => flag(data.three_white_soldiers),
        description: 'Strong bullish - three consecutive long green candles',
      },
      {
        label: 'Three Black Crows',
        key: 'three_black_crows',
        getValue: data => flag(data.three_black_crows),
        description: 'Strong bearish - three consecutive long red candles',
      },
      {
        label: 'Three Inside Up',
        key: 'three_inside_up',
        getValue: data => flag(data.three_inside_up),
        description: 'Bullish reversal - harami followed by confirmation',
      },
      {
        label: 'Three Inside Down',
        key: 'three_inside_down',
        getValue: data => flag(data.three_inside_down),
        description: 'Bearish reversal - harami followed by confirmation',
      },
      {
        label: 'Morning Doji Star',
        key: 'morning_doji_star',
        getValue: data => flag(data.morning_doji_star),
        description:
          'Bullish reversal - doji gap-down then gap-up confirmation',
      },
      {
        label: 'Evening Doji Star',
        key: 'evening_doji_star',
        getValue: data => flag(data.evening_doji_star),
        description:
          'Bearish reversal - doji gap-up then gap-down confirmation',
      },
      {
        label: 'Three Line Strike Bullish',
        key: 'three_line_strike_bullish',
        getValue: data => flag(data.three_line_strike_bullish),
        description: 'Bullish reversal - three soldiers then engulfing bearish',
      },
      {
        label: 'Three Line Strike Bearish',
        key: 'three_line_strike_bearish',
        getValue: data => flag(data.three_line_strike_bearish),
        description: 'Bearish reversal - three crows then engulfing bullish',
      },
      {
        label: 'Tasuki Gap Up',
        key: 'tasuki_gap_up',
        getValue: data => flag(data.tasuki_gap_up),
        description: 'Bullish continuation - gap up with partial fill',
      },
      {
        label: 'Tasuki Gap Down',
        key: 'tasuki_gap_down',
        getValue: data => flag(data.tasuki_gap_down),
        description: 'Bearish continuation - gap down with partial fill',
      },
    ],
  },
  {
    title: 'Doji Variants',
    fields: [
      {
        label: 'Long-Legged Doji',
        key: 'long_legged_doji',
        getValue: data => flag(data.long_legged_doji),
        description: 'High indecision - long upper and lower shadows',
      },
      {
        label: 'Dragonfly Doji',
        key: 'dragonfly_doji',
        getValue: data => flag(data.dragonfly_doji),
        description: 'Bullish reversal - long lower shadow, no upper shadow',
      },
      {
        label: 'Gravestone Doji',
        key: 'gravestone_doji',
        getValue: data => flag(data.gravestone_doji),
        description: 'Bearish reversal - long upper shadow, no lower shadow',
      },
    ],
  },
  {
    title: 'Continuation Patterns',
    fields: [
      {
        label: 'Rising Three Methods',
        key: 'rising_three_methods',
        getValue: data => flag(data.rising_three_methods),
        description: 'Bullish continuation - small pullback in uptrend',
      },
      {
        label: 'Falling Three Methods',
        key: 'falling_three_methods',
        getValue: data => flag(data.falling_three_methods),
        description: 'Bearish continuation - small rally in downtrend',
      },
    ],
  },
  {
    title: 'Range Patterns',
    fields: [
      {
        label: 'NR4',
        key: 'nr4',
        getValue: data => flag(data.nr4),
        description: 'Narrowest range of last 4 bars - breakout setup',
      },
      {
        label: 'NR7',
        key: 'nr7',
        getValue: data => flag(data.nr7),
        description: 'Narrowest range of last 7 bars - volatility squeeze',
      },
      {
        label: 'WR7',
        key: 'wr7',
        getValue: data => flag(data.wr7),
        description: 'Widest range of last 7 bars - volatility expansion',
      },
    ],
  },
  {
    title: 'Trend-Confirmed Candles',
    fields: [
      {
        label: 'Hammer at downtrend',
        key: 'hammer_at_downtrend',
        getValue: data => flag(data.hammer_at_downtrend),
        description:
          'Hammer confirmed by a preceding downtrend - rejection of lower prices',
      },
      {
        label: 'Inverted hammer at downtrend',
        key: 'inverted_hammer_at_downtrend',
        getValue: data => flag(data.inverted_hammer_at_downtrend),
        description: 'Inverted hammer after a decline - failed push down',
      },
      {
        label: 'Shooting star at uptrend',
        key: 'shooting_star_at_uptrend',
        getValue: data => flag(data.shooting_star_at_uptrend),
        description:
          'Shooting star confirmed by a preceding uptrend - rejection of highs',
      },
      {
        label: 'Hanging man at uptrend',
        key: 'hanging_man_at_uptrend',
        getValue: data => flag(data.hanging_man_at_uptrend),
        description:
          'Hanging man after an advance - selling pressure inside a rise',
      },
      {
        label: 'Takuri',
        key: 'takuri',
        getValue: data => flag(data.takuri),
        description:
          'A long lower shadow far below the body - deep rejection of the low',
      },
      {
        label: 'Short line candle',
        key: 'short_line_candle',
        getValue: data => flag(data.short_line_candle),
        description: 'A short body with little range - a pause in the trend',
      },
      {
        label: 'Closing marubozu (bullish)',
        key: 'closing_marubozu_bullish',
        getValue: data => flag(data.closing_marubozu_bullish),
        description: 'Green body running to its close with no upper shadow',
      },
      {
        label: 'Closing marubozu (bearish)',
        key: 'closing_marubozu_bearish',
        getValue: data => flag(data.closing_marubozu_bearish),
        description: 'Red body running to its close with no lower shadow',
      },
    ],
  },
  {
    title: 'More Double Candle Patterns',
    fields: [
      {
        label: 'Bullish counter attack',
        key: 'counter_attack_bullish',
        getValue: data => flag(data.counter_attack_bullish),
        description:
          'Gap down that closes back at the prior close - sellers gained nothing',
      },
      {
        label: 'Bearish counter attack',
        key: 'counter_attack_bearish',
        getValue: data => flag(data.counter_attack_bearish),
        description: 'Gap up given back to the prior close within the session',
      },
      {
        label: 'Bullish doji star',
        key: 'doji_star_bullish',
        getValue: data => flag(data.doji_star_bullish),
        description: 'Doji gapping below a red body - the decline stalls',
      },
      {
        label: 'Bearish doji star',
        key: 'doji_star_bearish',
        getValue: data => flag(data.doji_star_bearish),
        description: 'Doji gapping above a green body - the advance stalls',
      },
      {
        label: 'In neck (bearish)',
        key: 'in_neck_bearish',
        getValue: data => flag(data.in_neck_bearish),
        description:
          'Weak close just into the prior red body - the bounce fails',
      },
      {
        label: 'Thrusting (bearish)',
        key: 'thrusting_bearish',
        getValue: data => flag(data.thrusting_bearish),
        description:
          'Close pushes into but not past the prior red body midpoint',
      },
    ],
  },
  {
    title: 'More Triple Candle Patterns',
    fields: [
      {
        label: 'Three outside up',
        key: 'three_outside_up',
        getValue: data => flag(data.three_outside_up),
        description: 'Bullish engulfing confirmed by a third higher close',
      },
      {
        label: 'Three outside down',
        key: 'three_outside_down',
        getValue: data => flag(data.three_outside_down),
        description: 'Bearish engulfing confirmed by a third lower close',
      },
      {
        label: 'Advance block',
        key: 'advance_block',
        getValue: data => flag(data.advance_block),
        description:
          'Three higher closes on shrinking bodies - the push is being sold',
      },
      {
        label: 'Deliberation',
        key: 'deliberation',
        getValue: data => flag(data.deliberation),
        description:
          'Two strong green bars then a third that barely moves - hesitation',
      },
      {
        label: 'Homing pigeon',
        key: 'homing_pigeon',
        getValue: data => flag(data.homing_pigeon),
        description:
          'A small red body inside a larger one - selling is losing force',
      },
      {
        label: 'Descending hawk',
        key: 'descending_hawk',
        getValue: data => flag(data.descending_hawk),
        description:
          'The bearish mirror of the homing pigeon - buying is losing force',
      },
      {
        label: 'Bullish gap three methods',
        key: 'gap_three_methods_bullish',
        getValue: data => flag(data.gap_three_methods_bullish),
        description: 'A gap up held through a shallow pause - continuation',
      },
      {
        label: 'Bearish gap three methods',
        key: 'gap_three_methods_bearish',
        getValue: data => flag(data.gap_three_methods_bearish),
        description: 'A gap down held through a shallow pause - continuation',
      },
    ],
  },
  {
    title: 'Heikin Ashi Patterns',
    fields: [
      {
        label: 'HA bullish initiation',
        key: 'ha_bullish_initiation',
        getValue: data => flag(data.ha_bullish_initiation),
        description:
          'Heikin Ashi turns green with no lower wick - a trend begins',
      },
      {
        label: 'HA bearish initiation',
        key: 'ha_bearish_initiation',
        getValue: data => flag(data.ha_bearish_initiation),
        description:
          'Heikin Ashi turns red with no upper wick - a trend begins',
      },
      {
        label: 'HA bullish continuation',
        key: 'ha_bullish_continuation',
        getValue: data => flag(data.ha_bullish_continuation),
        description: 'Successive green Heikin Ashi bodies - the trend persists',
      },
      {
        label: 'HA bearish continuation',
        key: 'ha_bearish_continuation',
        getValue: data => flag(data.ha_bearish_continuation),
        description: 'Successive red Heikin Ashi bodies - the trend persists',
      },
      {
        label: 'HA doji',
        key: 'ha_doji',
        getValue: data => flag(data.ha_doji),
        description: 'A Heikin Ashi body near zero - the trend is undecided',
      },
      {
        label: 'HA tick up',
        key: 'ha_tick_up',
        getValue: data => flag(data.ha_tick_up),
        description: 'Heikin Ashi close ticks above the prior one',
      },
      {
        label: 'HA tick down',
        key: 'ha_tick_down',
        getValue: data => flag(data.ha_tick_down),
        description: 'Heikin Ashi close ticks below the prior one',
      },
    ],
  },
  {
    // The squeezes themselves are in Range Patterns above; these are how they resolve.
    title: 'Gaps & Range Breaks',
    fields: [
      {
        label: 'Fair value gap (bullish)',
        key: 'fvg_bullish',
        getValue: data => flag(data.fvg_bullish),
        description:
          'An unfilled gap between wicks - price often returns to it',
      },
      {
        label: 'Fair value gap (bearish)',
        key: 'fvg_bearish',
        getValue: data => flag(data.fvg_bearish),
        description: 'An unfilled downward imbalance left by a fast move',
      },
      {
        label: 'NR4 breakout',
        key: 'nr4_bullish_breakout',
        getValue: data => flag(data.nr4_bullish_breakout),
        description: 'NR4 squeeze resolved upward',
      },
      {
        label: 'NR4 breakdown',
        key: 'nr4_bearish_breakdown',
        getValue: data => flag(data.nr4_bearish_breakdown),
        description: 'NR4 squeeze resolved downward',
      },
      {
        label: 'NR7 breakout',
        key: 'nr7_bullish_breakout',
        getValue: data => flag(data.nr7_bullish_breakout),
        description: 'NR7 squeeze resolved upward',
      },
      {
        label: 'NR7 breakdown',
        key: 'nr7_bearish_breakdown',
        getValue: data => flag(data.nr7_bearish_breakdown),
        description: 'NR7 squeeze resolved downward',
      },
      {
        label: 'WR7 bullish continuation',
        key: 'wr7_bullish_continuation',
        getValue: data => flag(data.wr7_bullish_continuation),
        description: 'Wide range bar extending an advance',
      },
      {
        label: 'WR7 bearish continuation',
        key: 'wr7_bearish_continuation',
        getValue: data => flag(data.wr7_bearish_continuation),
        description: 'Wide range bar extending a decline',
      },
    ],
  },
];

const advancedIndicatorSections: IndicatorSection[] = [
  {
    title: 'Pivot Points',
    fields: [
      {
        label: 'Pivot Point',
        key: 'pivot_point',
        getValue: data => price(data.pivot_point),
        description: 'Central pivot point - average of high, low, and close',
      },
      {
        label: 'Resistance 1',
        key: 'pivot_r1',
        getValue: data => price(data.pivot_r1),
        description: 'First resistance level',
      },
      {
        label: 'Resistance 2',
        key: 'pivot_r2',
        getValue: data => price(data.pivot_r2),
        description: 'Second resistance level',
      },
      {
        label: 'Resistance 3',
        key: 'pivot_r3',
        getValue: data => price(data.pivot_r3),
        description: 'Third resistance level',
      },
      {
        label: 'Support 1',
        key: 'pivot_s1',
        getValue: data => price(data.pivot_s1),
        description: 'First support level',
      },
      {
        label: 'Support 2',
        key: 'pivot_s2',
        getValue: data => price(data.pivot_s2),
        description: 'Second support level',
      },
      {
        label: 'Support 3',
        key: 'pivot_s3',
        getValue: data => price(data.pivot_s3),
        description: 'Third support level',
      },
    ],
  },
  {
    title: 'Price Transforms & Momentum',
    defaultCollapsed: true,
    fields: [
      {
        label: 'Momentum (10)',
        key: 'momentum10',
        getValue: d => num(d.momentum10),
        description: '10-period price momentum (close minus close 10 bars ago)',
      },
      {
        label: 'ROC (12)',
        key: 'roc12',
        getValue: d => num(d.roc12),
        description: '12-period Rate of Change (% price change)',
      },
      {
        label: 'Std Dev (20)',
        key: 'stddev20',
        getValue: d => num(d.stddev20),
        description: '20-period standard deviation of price',
      },
      {
        label: 'DPO (20)',
        key: 'dpo20',
        getValue: d => num(d.dpo20),
        description:
          '20-period Detrended Price Oscillator (removes trend to isolate cycles)',
      },
    ],
  },
  {
    title: 'Advanced Moving Averages',
    priceLevels: true,
    defaultCollapsed: true,
    fields: [
      {
        label: 'WMA 20',
        key: 'wma20',
        getValue: d => price(d.wma20),
        description: '20-period Weighted Moving Average',
      },
      {
        label: 'DEMA 20',
        key: 'dema20',
        getValue: d => price(d.dema20),
        description:
          '20-period Double Exponential Moving Average (reduced lag)',
      },
      {
        label: 'TEMA 20',
        key: 'tema20',
        getValue: d => price(d.tema20),
        description:
          '20-period Triple Exponential Moving Average (reduced lag)',
      },
      {
        label: 'HMA 20',
        key: 'hma20',
        getValue: d => price(d.hma20),
        description: '20-period Hull Moving Average (fast and smooth)',
      },
      {
        label: 'SMMA 20',
        key: 'smma20',
        getValue: d => price(d.smma20),
        description: '20-period Smoothed Moving Average',
      },
      {
        label: 'ALMA',
        key: 'alma',
        getValue: d => price(d.alma),
        description:
          'Arnaud Legoux Moving Average (Gaussian-weighted, low lag)',
      },
      {
        label: 'McGinley Dynamic',
        key: 'mcginley',
        getValue: d => price(d.mcginley),
        description: 'Adaptive moving average that adjusts to market speed',
      },
      {
        label: 'KAMA',
        key: 'kama',
        getValue: d => price(d.kama),
        description: 'Kaufman Adaptive Moving Average (adjusts to volatility)',
      },
      {
        label: 'Hamming MA 20',
        key: 'hamma20',
        getValue: d => price(d.hamma20),
        description: '20-period Hamming-windowed Moving Average',
      },
      {
        label: 'MA Channel Upper',
        key: 'ma_channel_upper',
        getValue: d => price(d.ma_channel_upper),
        description: 'Upper band of the moving-average channel',
      },
      {
        label: 'MA Channel Lower',
        key: 'ma_channel_lower',
        getValue: d => price(d.ma_channel_lower),
        description: 'Lower band of the moving-average channel',
      },
    ],
  },
  {
    title: 'GMMA Ribbons',
    priceLevels: true,
    defaultCollapsed: true,
    fields: [
      {
        label: 'GMMA Short 3',
        key: 'gmma_short_3',
        getValue: d => price(d.gmma_short_3),
        description: 'Guppy short-term EMA (3) — reflects trader sentiment',
      },
      {
        label: 'GMMA Short 5',
        key: 'gmma_short_5',
        getValue: d => price(d.gmma_short_5),
        description: 'Guppy short-term EMA (5) — reflects trader sentiment',
      },
      {
        label: 'GMMA Short 8',
        key: 'gmma_short_8',
        getValue: d => price(d.gmma_short_8),
        description: 'Guppy short-term EMA (8) — reflects trader sentiment',
      },
      {
        label: 'GMMA Short 10',
        key: 'gmma_short_10',
        getValue: d => price(d.gmma_short_10),
        description: 'Guppy short-term EMA (10) — reflects trader sentiment',
      },
      {
        label: 'GMMA Short 12',
        key: 'gmma_short_12',
        getValue: d => price(d.gmma_short_12),
        description: 'Guppy short-term EMA (12) — reflects trader sentiment',
      },
      {
        label: 'GMMA Short 15',
        key: 'gmma_short_15',
        getValue: d => price(d.gmma_short_15),
        description: 'Guppy short-term EMA (15) — reflects trader sentiment',
      },
      {
        label: 'GMMA Long 30',
        key: 'gmma_long_30',
        getValue: d => price(d.gmma_long_30),
        description: 'Guppy long-term EMA (30) — reflects investor sentiment',
      },
      {
        label: 'GMMA Long 35',
        key: 'gmma_long_35',
        getValue: d => price(d.gmma_long_35),
        description: 'Guppy long-term EMA (35) — reflects investor sentiment',
      },
      {
        label: 'GMMA Long 40',
        key: 'gmma_long_40',
        getValue: d => price(d.gmma_long_40),
        description: 'Guppy long-term EMA (40) — reflects investor sentiment',
      },
      {
        label: 'GMMA Long 45',
        key: 'gmma_long_45',
        getValue: d => price(d.gmma_long_45),
        description: 'Guppy long-term EMA (45) — reflects investor sentiment',
      },
      {
        label: 'GMMA Long 50',
        key: 'gmma_long_50',
        getValue: d => price(d.gmma_long_50),
        description: 'Guppy long-term EMA (50) — reflects investor sentiment',
      },
      {
        label: 'GMMA Long 60',
        key: 'gmma_long_60',
        getValue: d => price(d.gmma_long_60),
        description: 'Guppy long-term EMA (60) — reflects investor sentiment',
      },
    ],
  },
  {
    title: 'Linear Regression & Trend',
    priceLevels: true,
    defaultCollapsed: true,
    fields: [
      {
        label: 'LSMA 20',
        key: 'lsma20',
        getValue: d => price(d.lsma20),
        description: '20-period Least Squares Moving Average (regression line)',
      },
      {
        label: 'Linear Reg Curve',
        key: 'linreg_curve',
        getValue: d => price(d.linreg_curve),
        description: 'Linear regression value of price',
      },
      {
        label: 'Linear Reg Slope',
        kind: 'raw',
        key: 'linreg_slope',
        getValue: d => num(d.linreg_slope),
        description:
          'Slope of the linear regression line (trend direction and strength)',
      },
      {
        label: 'Standard Error (20)',
        kind: 'raw',
        key: 'stderr20',
        getValue: d => num(d.stderr20),
        description: '20-period standard error of the regression',
      },
    ],
  },
  {
    title: 'Cross Signals',
    defaultCollapsed: true,
    fields: [],
  },
  {
    title: 'Extended Oscillators',
    defaultCollapsed: true,
    fields: [
      {
        label: 'Aroon Up',
        key: 'aroon_up',
        getValue: d => num(d.aroon_up),
        description:
          'Time since the recent high over 25 periods; >70 signals a strong uptrend',
      },
      {
        label: 'Aroon Down',
        key: 'aroon_down',
        getValue: d => num(d.aroon_down),
        description:
          'Time since the recent low over 25 periods; >70 signals a strong downtrend',
      },
      {
        label: 'CMO (14)',
        key: 'cmo14',
        getValue: d => num(d.cmo14),
        description: '14-period Chande Momentum Oscillator (-100 to +100)',
      },
      {
        label: 'TRIX',
        key: 'trix',
        getValue: d => num(d.trix),
        description: 'Triple-smoothed EMA rate of change; momentum oscillator',
      },
      {
        label: 'TSI',
        key: 'tsi',
        getValue: d => num(d.tsi),
        description:
          'True Strength Index; double-smoothed momentum (-100 to +100)',
      },
      {
        label: 'PPO',
        key: 'ppo',
        getValue: d => num(d.ppo),
        description:
          'Percentage Price Oscillator (MACD expressed as a percentage)',
      },
      {
        label: 'Coppock Curve',
        key: 'coppock',
        getValue: d => num(d.coppock),
        description:
          'Long-term momentum; upward turns signal buying opportunities',
      },
      {
        label: 'KST',
        key: 'kst',
        getValue: d => num(d.kst),
        description: 'Know Sure Thing; smoothed rate-of-change momentum',
      },
      {
        label: 'KST Signal',
        key: 'kst_signal',
        getValue: d => num(d.kst_signal),
        description: 'Signal line for the KST oscillator',
      },
      {
        label: 'Fisher Transform',
        key: 'fisher',
        getValue: d => num(d.fisher),
        description: 'Sharpens turning points in price for clearer reversals',
      },
      {
        label: 'Fisher Trigger',
        key: 'fisher_trigger',
        getValue: d => num(d.fisher_trigger),
        description: 'Trigger line for the Fisher Transform',
      },
      {
        label: 'RVI',
        key: 'rvi',
        getValue: d => num(d.rvi),
        description: 'Relative Vigor Index; closes vs range momentum',
      },
      {
        label: 'RVI Signal',
        key: 'rvi_signal',
        getValue: d => num(d.rvi_signal),
        description: 'Signal line for the Relative Vigor Index',
      },
      {
        label: 'SMI Ergodic',
        key: 'smi_ergodic',
        getValue: d => num(d.smi_ergodic),
        description: 'Stochastic Momentum Index (ergodic); trend momentum',
      },
      {
        label: 'SMI Signal',
        key: 'smi_signal',
        getValue: d => num(d.smi_signal),
        description: 'Signal line for SMI Ergodic',
      },
      {
        label: 'Connors RSI',
        key: 'connors_rsi',
        getValue: d => num(d.connors_rsi),
        description: 'Composite RSI for mean-reversion (0-100)',
      },
      {
        label: 'Klinger Oscillator',
        key: 'klinger',
        getValue: d => num(d.klinger),
        description: 'Volume-based trend oscillator',
      },
      {
        label: 'Klinger Signal',
        key: 'klinger_signal',
        getValue: d => num(d.klinger_signal),
        description: 'Signal line for the Klinger Oscillator',
      },
      {
        label: 'Awesome Oscillator',
        key: 'ao',
        getValue: d => num(d.ao),
        description: 'Difference of 5- and 34-period median-price SMAs',
      },
      {
        label: 'Ultimate Oscillator',
        key: 'ultimate_osc',
        getValue: d => num(d.ultimate_osc),
        description: 'Multi-timeframe momentum oscillator (0-100)',
      },
    ],
  },
  {
    title: 'Advanced Volatility & Channels',
    defaultCollapsed: true,
    fields: [
      {
        label: 'Historical Volatility',
        key: 'hist_vol',
        getValue: d => num(d.hist_vol),
        description: 'Annualized standard deviation of returns',
      },
      {
        label: 'Volatility (OHLC)',
        key: 'vol_ohlc',
        getValue: d => num(d.vol_ohlc),
        description: 'Garman-Klass OHLC volatility estimate',
      },
      {
        label: 'Volatility (Zero-Trend CC)',
        key: 'vol_zt_cc',
        getValue: d => num(d.vol_zt_cc),
        description: 'Zero-trend close-to-close volatility estimate',
      },
      {
        label: 'Chaikin Volatility',
        key: 'chaikin_vol',
        getValue: d => num(d.chaikin_vol),
        description: 'Rate of change of the high-low range',
      },
      {
        label: 'Choppiness (14)',
        key: 'choppiness14',
        getValue: d => num(d.choppiness14),
        description: '14-period Choppiness Index; >61.8 choppy, <38.2 trending',
      },
      {
        label: 'Price Channel Upper',
        key: 'price_channel_upper',
        getValue: d => price(d.price_channel_upper),
        description: 'Highest high over the lookback period',
      },
      {
        label: 'Price Channel Lower',
        key: 'price_channel_lower',
        getValue: d => price(d.price_channel_lower),
        description: 'Lowest low over the lookback period',
      },
      {
        label: 'Chandelier Stop Long',
        key: 'ck_stop_long',
        getValue: d => price(d.ck_stop_long),
        description: 'Chandelier exit trailing stop for long positions',
      },
      {
        label: 'Chandelier Stop Short',
        key: 'ck_stop_short',
        getValue: d => price(d.ck_stop_short),
        description: 'Chandelier exit trailing stop for short positions',
      },
      {
        label: 'Vortex +VI',
        key: 'vi_plus',
        getValue: d => num(d.vi_plus),
        description: 'Positive Vortex Indicator (uptrend strength)',
      },
      {
        label: 'Vortex -VI',
        key: 'vi_minus',
        getValue: d => num(d.vi_minus),
        description: 'Negative Vortex Indicator (downtrend strength)',
      },
      {
        label: 'Mass Index',
        key: 'mass_index',
        getValue: d => num(d.mass_index),
        description:
          'Range-expansion measure; a bulge above 27 signals reversals',
      },
      {
        label: 'ASI',
        key: 'asi',
        getValue: d => num(d.asi),
        description: 'Accumulative Swing Index; cumulative price swing',
      },
    ],
  },
  {
    title: 'Volume Flow',
    defaultCollapsed: true,
    fields: [
      {
        label: 'Accumulation/Distribution',
        key: 'adl',
        getValue: d => largeNum(d.adl),
        description: 'A/D Line; cumulative money-flow volume',
      },
      {
        label: 'CMF (20)',
        key: 'cmf20',
        getValue: d => num(d.cmf20),
        description: '20-period Chaikin Money Flow (-1 to +1)',
      },
      {
        label: 'Chaikin Oscillator',
        key: 'chaikin_osc',
        getValue: d => num(d.chaikin_osc),
        description: 'MACD of the Accumulation/Distribution Line',
      },
      {
        label: 'PVT',
        key: 'pvt',
        getValue: d => largeNum(d.pvt),
        description:
          'Price Volume Trend; cumulative volume-weighted price change',
      },
      {
        label: 'Ease of Movement (14)',
        key: 'eom14',
        getValue: d => num(d.eom14),
        description: 'Relates price change to volume over 14 periods',
      },
      {
        label: 'Force Index (13)',
        key: 'efi13',
        getValue: d => num(d.efi13),
        description: '13-period Elder Force Index (price change × volume)',
      },
      {
        label: 'Volume Oscillator',
        key: 'volume_osc',
        getValue: d => num(d.volume_osc),
        description: 'Percentage difference between fast and slow volume MAs',
      },
      {
        label: 'VWMA 20',
        key: 'vwma20',
        getValue: d => price(d.vwma20),
        description: '20-period Volume Weighted Moving Average',
      },
      {
        label: 'Relative Volume',
        key: 'rvi_vol',
        getValue: d => num(d.rvi_vol),
        description: 'Current volume relative to its average',
      },
    ],
  },
  {
    title: 'Market Structure',
    defaultCollapsed: true,
    fields: [
      {
        label: 'Alligator Jaw',
        key: 'alligator_jaw',
        getValue: d => price(d.alligator_jaw),
        description: 'Williams Alligator jaw line (slow, 13-period SMMA)',
      },
      {
        label: 'Alligator Teeth',
        key: 'alligator_teeth',
        getValue: d => price(d.alligator_teeth),
        description: 'Williams Alligator teeth line (medium, 8-period SMMA)',
      },
      {
        label: 'Alligator Lips',
        key: 'alligator_lips',
        getValue: d => price(d.alligator_lips),
        description: 'Williams Alligator lips line (fast, 5-period SMMA)',
      },
      {
        label: 'Fractal Up',
        key: 'fractal_up',
        getValue: d => flag(d.fractal_up),
        description: 'Bearish fractal — a local high pivot (5-bar)',
      },
      {
        label: 'Fractal Down',
        key: 'fractal_down',
        getValue: d => flag(d.fractal_down),
        description: 'Bullish fractal — a local low pivot (5-bar)',
      },
      {
        label: 'ZigZag Pivot',
        key: 'zigzag_pivot',
        getValue: d => price(d.zigzag_pivot),
        description: 'Most recent ZigZag swing pivot price',
      },
    ],
  },
  {
    // Web keeps these two apart and the split is the meaningful one: everything here is a price
    // level the chart can draw, while the MACD and volume averages below are not. The old app put
    // all thirteen in one section, which would have drawn volume averages as price lines.
    title: 'September Additions',
    defaultCollapsed: true,
    priceLevels: true,
    fields: [
      {
        label: 'SMA 20',
        key: 'sma20',
        getValue: data => price(data.sma20),
        description: '20-period simple moving average',
      },
      {
        label: 'SMA 200',
        key: 'sma200',
        getValue: data => price(data.sma200),
        description:
          '200-period simple moving average — the long-term trend line',
      },
      {
        label: 'Chandelier Exit Long',
        key: 'chandelier_exit_long',
        getValue: data => price(data.chandelier_exit_long),
        description: 'Trailing stop for a long: 22-bar high less 3x ATR',
      },
      {
        label: 'Chandelier Exit Short',
        key: 'chandelier_exit_short',
        getValue: data => price(data.chandelier_exit_short),
        description: 'Trailing stop for a short: 22-bar low plus 3x ATR',
      },
      {
        label: 'Ichimoku Chikou',
        key: 'ichimoku_chikou',
        getValue: data => price(data.ichimoku_chikou),
        description: 'Lagging span — close shifted back 26 periods',
      },
      {
        label: 'Heikin Ashi Open',
        key: 'ha_open',
        getValue: data => price(data.ha_open),
        description:
          'Heikin Ashi open — average of the prior HA open and close',
      },
      {
        label: 'Heikin Ashi High',
        key: 'ha_high',
        getValue: data => price(data.ha_high),
        description: 'Heikin Ashi high',
      },
      {
        label: 'Heikin Ashi Low',
        key: 'ha_low',
        getValue: data => price(data.ha_low),
        description: 'Heikin Ashi low',
      },
    ],
  },
  {
    title: 'Standard MACD & Volume Averages',
    defaultCollapsed: true,
    fields: [
      {
        label: 'MACD (12, 26, 9)',
        key: 'macd_12_26_9',
        getValue: data => num(data.macd_12_26_9),
        description: 'MACD on the conventional 12/26/9 settings',
      },
      {
        label: 'MACD Signal (12, 26, 9)',
        key: 'macd_12_26_signal',
        getValue: data => num(data.macd_12_26_signal),
        description: 'Signal line for the conventional MACD',
      },
      {
        label: 'Accelerator Oscillator',
        key: 'accelerator_osc',
        getValue: data => num(data.accelerator_osc),
        description: 'Awesome Oscillator less its own 5-period average',
      },
      {
        label: 'Volume MA 20',
        key: 'volume_ma20',
        getValue: data => largeNum(data.volume_ma20),
        description: '20-period average volume',
      },
      {
        label: 'Volume MA 50',
        key: 'volume_ma50',
        getValue: data => largeNum(data.volume_ma50),
        description: '50-period average volume',
      },
    ],
  },
  {
    title: 'Adaptive & Cycle',
    fields: [
      {
        label: 'FRAMA',
        key: 'frama',
        getValue: data => price(data.frama),
        description:
          'Fractal Adaptive Moving Average - adapts to fractal dimension',
      },
      {
        label: 'T3 MA',
        key: 't3_ma',
        getValue: data => price(data.t3_ma),
        description: 'Tillson T3 - smoother than EMA with less lag',
      },
      {
        label: 'Schaff Trend Cycle',
        key: 'schaff_trend_cycle',
        getValue: data => num(data.schaff_trend_cycle),
        description: 'MACD run through stochastic cycles - faster turns',
      },
      {
        label: 'Wave Trend',
        key: 'wave_trend',
        getValue: data => num(data.wave_trend),
        description:
          'Channel-based oscillator for overbought and oversold turns',
      },
      {
        label: 'Random Walk Index',
        key: 'random_walk_index',
        getValue: data => num(data.random_walk_index),
        description: 'Whether the move exceeds what a random walk explains',
      },
    ],
  },
];

export const indicatorSections: IndicatorSection[] = [
  ...coreIndicatorSections,
  ...patternIndicatorSections,
  ...advancedIndicatorSections,
];
