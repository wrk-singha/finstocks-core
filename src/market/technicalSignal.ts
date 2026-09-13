import type {TechnicalIndicatorData} from '../types/indicators.ts';

export type Verdict = 'Buy' | 'Neutral' | 'Sell';

export interface OscillatorSignal {
  label: string;
  value: number | null;
  /** 0–100 position along the gauge track. */
  left: number;
  verdict: Verdict;
}

export interface SignalTally {
  buy: number;
  neutral: number;
  sell: number;
  total: number;
  overall: Verdict;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * MACD line less its signal line — the feed sends the two legs, not the gap.
 * Null unless both are present: a missing leg is no reading, not a zero gap,
 * and zero is the value that means "momentum has just flipped". The server's
 * own `macd_histogram` can't be trusted for this — the legs are `omitempty`,
 * so a missing one arrives as an absent field and the gap reads as 0.
 */
export const macdHistogram = (d?: TechnicalIndicatorData): number | null =>
  d?.macd_8_21_9 == null || d.macd_signal == null
    ? null
    : d.macd_8_21_9 - d.macd_signal;

/** The tone a verdict earns; the apps map it to their profit/loss/muted colours. */
export function verdictColorKey(v: Verdict): 'profit' | 'loss' | 'muted' {
  return v === 'Buy' ? 'profit' : v === 'Sell' ? 'loss' : 'muted';
}

const bandVerdict = (
  v: number | null | undefined,
  buyBelow: number,
  sellAbove: number,
): Verdict => {
  if (v == null) return 'Neutral';
  if (v < buyBelow) return 'Buy';
  if (v > sellAbove) return 'Sell';
  return 'Neutral';
};

/**
 * The six oscillator gauges (RSI/MACD/Stochastic/CCI/Williams %R/MFI) with
 * Buy/Neutral/Sell verdicts, shared by the technicals tab and the chat buy
 * cards so both carry the exact same verdict math.
 */
export function buildOscillators(
  d?: TechnicalIndicatorData,
): OscillatorSignal[] {
  if (!d) return [];
  const hist = macdHistogram(d);
  return [
    {
      label: 'RSI 14',
      value: d.rsi14 ?? null,
      left: clamp(d.rsi14 ?? 50, 0, 100),
      verdict: bandVerdict(d.rsi14, 30, 70),
    },
    {
      label: 'MACD Hist',
      value: hist,
      left: clamp(50 + (hist ?? 0) * 10, 0, 100),
      verdict:
        hist == null
          ? 'Neutral'
          : hist > 0
            ? 'Buy'
            : hist < 0
              ? 'Sell'
              : 'Neutral',
    },
    {
      label: 'Stochastic %K',
      value: d.stochastic_k_14 ?? null,
      left: clamp(d.stochastic_k_14 ?? 50, 0, 100),
      verdict: bandVerdict(d.stochastic_k_14, 20, 80),
    },
    {
      label: 'CCI 20',
      value: d.cci_20 ?? null,
      left: clamp((((d.cci_20 ?? 0) + 200) / 400) * 100, 0, 100),
      verdict: bandVerdict(d.cci_20, -100, 100),
    },
    {
      label: 'Williams %R',
      value: d.williams_r_14 ?? null,
      left: clamp((d.williams_r_14 ?? -50) + 100, 0, 100),
      verdict: bandVerdict(d.williams_r_14, -80, -20),
    },
    {
      label: 'MFI 14',
      value: d.mfi14 ?? null,
      left: clamp(d.mfi14 ?? 50, 0, 100),
      verdict: bandVerdict(d.mfi14, 20, 80),
    },
  ];
}

// Price vs. long-term EMAs — the two trend votes that join the oscillators.
const buildPriceSignals = (d?: TechnicalIndicatorData): Verdict[] => {
  if (!d) return [];
  const c = d.close_price;
  const vs = (ma: number | null | undefined): Verdict =>
    c == null || ma == null ? 'Neutral' : c >= ma ? 'Buy' : 'Sell';
  return [vs(d.ema50), vs(d.ema200)];
};

/**
 * Overall Buy/Neutral/Sell tally across the six oscillators plus the two EMA
 * trend votes. `oscillators` is injectable so callers that already built the
 * list (the technicals tab renders it) don't recompute it.
 */
export function computeSignalTally(
  d?: TechnicalIndicatorData,
  oscillators: OscillatorSignal[] = buildOscillators(d),
): SignalTally {
  const all: Verdict[] = [
    ...oscillators.map(o => o.verdict),
    ...buildPriceSignals(d),
  ];
  const buy = all.filter(v => v === 'Buy').length;
  const sell = all.filter(v => v === 'Sell').length;
  const neutral = all.filter(v => v === 'Neutral').length;
  const overall: Verdict =
    buy > sell && buy >= neutral
      ? 'Buy'
      : sell > buy && sell >= neutral
        ? 'Sell'
        : 'Neutral';
  // drift resolved 2026-09-13: the web returned a bare `all.length`; the mobile's
  // `|| 1` wins because the tally bar divides by `total` and an empty payload
  // must render an empty bar, not NaN widths.
  return {buy, sell, neutral, total: all.length || 1, overall};
}
