import {istDayKey, parseApiDate, signedPct} from '../format/index.ts';
import type {GraphDataPoint} from '../types/graphData.ts';
import type {TechnicalIndicatorData} from '../types/indicators.ts';
import type {MarketNewsItem} from '../types/market.ts';
import {macdHistogram} from './technicalSignal.ts';

/**
 * What is happening to this stock, as a short list of plain statements.
 *
 * The drawer already carries every input a signal is derived from — indicators,
 * daily bars, the 52-week range, the news feed. What it never did was say the
 * one thing those inputs add up to today. "RSI 74" is a reading; "Overbought on
 * RSI" is the sentence a reader can act on, and this module is the translation
 * between the two.
 *
 * Everything here is derived client-side from data already fetched. No signal
 * is invented, and none is emitted unless its inputs are actually present — a
 * blank is honest, a plausible-looking claim about a stock is not.
 */

export type SignalKind = 'technical' | 'news';
export type SignalTone = 'bullish' | 'bearish' | 'neutral';

export interface StockSignal {
  key: string;
  kind: SignalKind;
  /** The whole signal, as one sentence. This is the content; nothing else in
   *  the row is required to understand it. */
  label: string;
  /** The figure behind the label, pre-formatted. Null when the label is the
   *  whole story — a candle pattern has no magnitude to quote. */
  metric: string | null;
  /** `metric` is a return, so it earns profit/loss colour. Distances, multiples
   *  and readings are facts without a direction and stay in plain ink. */
  metricIsReturn: boolean;
  tone: SignalTone;
  /** When it fired. Null only when the source carried no usable timestamp. */
  at: string | null;
  /** Editorial rank — how much a reader would want this one first. Sorting is
   *  by rank, not recency: nearly every technical signal is stamped with the
   *  same session close, so recency alone would order them arbitrarily. */
  priority: number;
}

export interface SignalInputs {
  /** Daily bars, oldest first. The last is the session being described. */
  daily: GraphDataPoint[];
  /**
   * Indicators computed on the DAILY interval. "Daily breakout detected" is
   * only a true statement about daily data — passing a 1m payload here would
   * make every label a lie about its own timeframe.
   */
  indicators?: TechnicalIndicatorData;
  yearHigh?: number | null;
  yearLow?: number | null;
  /** Already filtered to this symbol. */
  news?: MarketNewsItem[];
  /** Live price when there is one; falls back to the last daily close. */
  lastPrice?: number | null;
  /** Injectable clock, for tests. */
  now?: number;
}

/** A move worth naming — below this, "price up" is just noise. */
const BIG_MOVE_PCT = 5;
const GAP_PCT = 2;
const VOLUME_SPIKE_X = 2;
/** Sessions the breakout window looks back over, excluding today. */
const BREAKOUT_LOOKBACK = 20;
const NEAR_52W_PCT = 2;
/** A histogram worth calling a crossover, as a fraction of the stock's own
 *  average daily range — a bare sign test fires on every stock, always. */
const MACD_MIN_ATR = 0.05;
const NEWS_WINDOW_DAYS = 30;
const MAX_NEWS = 3;
/** Past six rows this stops being a summary and becomes another tab. */
const MAX_SIGNALS = 6;

const PRIORITY = {
  bigMove: 10,
  freshNews: 9,
  gap: 8,
  breakout: 7,
  volume: 6,
  range52w: 5,
  olderNews: 4,
  pattern: 3,
  rsi: 2,
  trend: 1,
} as const;

const changePct = (from: number, to: number) => ((to - from) / from) * 100;

const move = (value: number) => signedPct(value, 2);

const toneOf = (value: number): SignalTone =>
  value > 0 ? 'bullish' : value < 0 ? 'bearish' : 'neutral';

/**
 * The signals for one stock, best first, capped.
 *
 * Sorted by editorial rank and then recency. A stock with nothing going on
 * still returns its trend row rather than an empty list — "quiet" is an answer,
 * and it is a better one than a section that vanishes without explanation.
 */
export const buildStockSignals = (input: SignalInputs): StockSignal[] =>
  [...technicalSignals(input), ...newsSignals(input)]
    .sort((a, b) => b.priority - a.priority || stamp(b) - stamp(a))
    .slice(0, MAX_SIGNALS);

const stamp = (s: StockSignal) => (s.at ? new Date(s.at).getTime() : 0);

const technicalSignals = ({
  daily,
  indicators,
  yearHigh,
  yearLow,
  lastPrice,
}: SignalInputs): StockSignal[] => {
  const out: StockSignal[] = [];
  const last = daily[daily.length - 1] ?? null;
  const prev = daily.length > 1 ? (daily[daily.length - 2] ?? null) : null;
  const at = last?.time ?? null;
  const price = lastPrice ?? last?.close ?? null;

  const push = (s: Omit<StockSignal, 'kind' | 'at'>) =>
    out.push({...s, kind: 'technical', at});

  // The session's own move, against the prior close — the same anchor the
  // header prints, so the two can never disagree.
  const dayMove =
    last && prev?.close ? changePct(prev.close, last.close) : null;

  if (dayMove != null && Math.abs(dayMove) >= BIG_MOVE_PCT) {
    push({
      key: 'day-move',
      label: `Price ${dayMove > 0 ? 'up' : 'down'} over ${BIG_MOVE_PCT}%`,
      metric: move(dayMove),
      metricIsReturn: true,
      tone: toneOf(dayMove),
      priority: PRIORITY.bigMove,
    });
  }

  if (last && prev?.close) {
    const gap = changePct(prev.close, last.open);
    if (Math.abs(gap) >= GAP_PCT) {
      push({
        key: 'gap',
        label: `Gapped ${gap > 0 ? 'up' : 'down'} at open`,
        metric: move(gap),
        metricIsReturn: true,
        tone: toneOf(gap),
        priority: PRIORITY.gap,
      });
    }
  }

  // Breakout is measured against the window BEFORE today — include the current
  // bar and the high it just set is its own resistance, so nothing ever breaks
  // out. The window must also be full: calling a 20-day high off six days of
  // history is a statement we have no data for.
  const window = daily.slice(-1 - BREAKOUT_LOOKBACK, -1);
  if (last && window.length >= BREAKOUT_LOOKBACK) {
    const high = Math.max(...window.map(b => b.high));
    const low = Math.min(...window.map(b => b.low));
    if (last.close > high) {
      push({
        key: 'breakout',
        label: 'Daily breakout detected',
        metric: `${BREAKOUT_LOOKBACK}-day high`,
        metricIsReturn: false,
        tone: 'bullish',
        priority: PRIORITY.breakout,
      });
    } else if (last.close < low) {
      push({
        key: 'breakdown',
        label: 'Daily breakdown detected',
        metric: `${BREAKOUT_LOOKBACK}-day low`,
        metricIsReturn: false,
        tone: 'bearish',
        priority: PRIORITY.breakout,
      });
    }
  }

  const volume = indicators?.volume;
  const volumeMa = indicators?.volume_ma10;
  if (volume != null && volumeMa != null && volumeMa > 0) {
    const times = volume / volumeMa;
    if (times >= VOLUME_SPIKE_X) {
      push({
        key: 'volume',
        label: 'High trading volume',
        metric: `${times.toFixed(1)}× average`,
        metricIsReturn: false,
        // Volume has no direction of its own — it confirms whichever way the
        // session actually went. With no move to confirm it stays neutral
        // rather than borrowing a colour it hasn't earned.
        tone: dayMove == null ? 'neutral' : toneOf(dayMove),
        priority: PRIORITY.volume,
      });
    }
  }

  // The 52-week bounds come from fundamentals, which refresh on their own
  // schedule — so a live price can legitimately sit outside them. That case is
  // a new high, not a near-high, and saying "near" would be the wrong word for
  // the more interesting event.
  if (price != null && yearHigh) {
    const away = changePct(price, yearHigh);
    if (away <= 0) {
      push({
        key: '52w-high',
        label: 'At a 52-week high',
        metric: null,
        metricIsReturn: false,
        tone: 'bullish',
        priority: PRIORITY.range52w,
      });
    } else if (away <= NEAR_52W_PCT) {
      push({
        key: '52w-high',
        label: 'Trading near 52-week high',
        metric: `${away.toFixed(1)}% away`,
        metricIsReturn: false,
        tone: 'bullish',
        priority: PRIORITY.range52w,
      });
    }
  }

  if (price != null && yearLow) {
    const above = changePct(yearLow, price);
    if (above <= 0) {
      push({
        key: '52w-low',
        label: 'At a 52-week low',
        metric: null,
        metricIsReturn: false,
        tone: 'bearish',
        priority: PRIORITY.range52w,
      });
    } else if (above <= NEAR_52W_PCT) {
      push({
        key: '52w-low',
        label: 'Trading near 52-week low',
        metric: `${above.toFixed(1)}% away`,
        metricIsReturn: false,
        tone: 'bearish',
        priority: PRIORITY.range52w,
      });
    }
  }

  // One pattern only, the strongest that printed. Six of these at once is a
  // wall of jargon that tells a reader less than the single best one does.
  const pattern = indicators
    ? PATTERNS.find(p => indicators[p.field] === true)
    : undefined;
  if (pattern) {
    push({
      key: 'pattern',
      label: pattern.label,
      metric: null,
      metricIsReturn: false,
      tone: pattern.tone,
      priority: PRIORITY.pattern,
    });
  }

  // Overbought reads as caution and oversold as opportunity — the same way
  // technicalSignal.ts scores the band, so the drawer never contradicts itself.
  const rsi = indicators?.rsi14;
  if (rsi != null && (rsi >= 70 || rsi <= 30)) {
    push({
      key: 'rsi',
      label: rsi >= 70 ? 'Overbought on RSI' : 'Oversold on RSI',
      metric: `RSI ${rsi.toFixed(0)}`,
      metricIsReturn: false,
      tone: rsi >= 70 ? 'bearish' : 'bullish',
      priority: PRIORITY.rsi,
    });
  }

  // Always true of something, which is exactly why it ranks last: it is the
  // row that keeps a quiet stock from showing an empty section, and the moment
  // anything real fires it gets pushed off the end by the cap.
  const ema200 = indicators?.ema200;
  if (price != null && ema200 != null) {
    const above = price >= ema200;
    push({
      key: 'trend',
      label: `Trading ${above ? 'above' : 'below'} its 200-day average`,
      metric: null,
      metricIsReturn: false,
      tone: above ? 'bullish' : 'bearish',
      priority: PRIORITY.trend,
    });
  }

  // The periods belong in the label: this is the refresher's macd_8_21_9, not
  // the 12/26/9 every charting tool means by an unqualified "MACD". The fast
  // variant flips days earlier, so an unlabelled row contradicts the reader's
  // own chart.
  // drift resolved 2026-09-13: the mobile read the server's `macd_histogram`;
  // the web derives the gap from the two legs, which wins because a missing
  // `omitempty` leg makes the server field read as a false 0 (see macdHistogram).
  const hist = macdHistogram(indicators);
  const atr = indicators?.atr14;
  if (
    hist != null &&
    atr != null &&
    atr > 0 &&
    Math.abs(hist) >= atr * MACD_MIN_ATR
  ) {
    push({
      key: 'macd',
      label: `MACD (8,21,9) ${hist > 0 ? 'above' : 'below'} its signal line`,
      metric: null,
      metricIsReturn: false,
      tone: toneOf(hist),
      priority: PRIORITY.trend,
    });
  }

  return out;
};

/**
 * Recent stories, each carrying what the stock has done since it broke.
 *
 * The return is the reason this belongs in a signal list rather than in a news
 * list: a headline on its own is an event, but a headline with "+11.36% since"
 * next to it is an event the market has already answered — and the answer is
 * the part a reader is here for.
 *
 * Priced at the close of the day the story landed, against the price now. Day
 * resolution, deliberately: these span days or weeks, so minute precision on
 * the entry point would be false exactness on a number that is only ever a
 * rough "what has it done since". Bucketed in IST, not device local: a session
 * belongs to the exchange's day, so a device in another timezone would match
 * news to the wrong close.
 */
const newsSignals = ({
  news,
  daily,
  lastPrice,
  now = Date.now(),
}: SignalInputs): StockSignal[] => {
  if (!news?.length) return [];

  const closeByDay = new Map<string, number>();
  daily.forEach(bar =>
    closeByDay.set(istDayKey(new Date(bar.time)), bar.close),
  );

  const current = lastPrice ?? daily[daily.length - 1]?.close ?? null;

  // drift resolved 2026-09-13: the web parsed `analysis_date` with `new Date`;
  // the mobile's `parseApiDate` wins because Hermes rejects the Postgres
  // "YYYY-MM-DD HH:MM:SS+00" form and would silently drop every story.
  return news
    .map(item => ({item, at: parseApiDate(item.analysis_date)}))
    .filter(
      (r): r is {item: MarketNewsItem; at: Date} =>
        r.at != null && !!r.item.headline,
    )
    .filter(r => now - r.at.getTime() <= NEWS_WINDOW_DAYS * 86400000)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, MAX_NEWS)
    .map(({item, at}, i): StockSignal => {
      const then = closeByDay.get(istDayKey(at)) ?? null;
      const since = then && current != null ? changePct(then, current) : null;
      const ageDays = (now - at.getTime()) / 86400000;

      const llmTone: SignalTone =
        item.direction === 'bullish' || item.direction === 'bearish'
          ? item.direction
          : since == null
            ? 'neutral'
            : toneOf(since);

      return {
        key: `news-${at.getTime()}-${i}`,
        kind: 'news',
        label: item.catalyst ?? item.headline,
        metric: since == null ? null : `${move(since)} since`,
        metricIsReturn: true,
        tone: llmTone,
        at: at.toISOString(),
        priority: ageDays <= 3 ? PRIORITY.freshNews : PRIORITY.olderNews,
      };
    });
};

/** Ordered by how much a print of each actually tells you — the first match
 *  wins, so the three-bar reversals outrank the single-candle ones. */
const PATTERNS: {
  field: keyof TechnicalIndicatorData;
  label: string;
  tone: SignalTone;
}[] = [
  {
    field: 'three_white_soldiers',
    label: 'Three white soldiers pattern',
    tone: 'bullish',
  },
  {
    field: 'three_black_crows',
    label: 'Three black crows pattern',
    tone: 'bearish',
  },
  {field: 'morning_star', label: 'Morning star pattern', tone: 'bullish'},
  {field: 'evening_star', label: 'Evening star pattern', tone: 'bearish'},
  {
    field: 'bullish_engulfing',
    label: 'Bullish engulfing candle',
    tone: 'bullish',
  },
  {
    field: 'bearish_engulfing',
    label: 'Bearish engulfing candle',
    tone: 'bearish',
  },
  {field: 'piercing_pattern', label: 'Piercing pattern', tone: 'bullish'},
  {field: 'dark_cloud_cover', label: 'Dark cloud cover', tone: 'bearish'},
  {field: 'hammer', label: 'Hammer candle', tone: 'bullish'},
  {field: 'shooting_star', label: 'Shooting star candle', tone: 'bearish'},
];
