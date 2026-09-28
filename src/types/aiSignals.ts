/**
 * AI Signals as the backend's /market/ai-signals serves them: the pattern engine's trade plans on
 * the closed bars a chart shows. Times are epoch seconds on the bars the request sent.
 */

export type AISignalState =
  'detected' | 'armed' | 'triggered' | 'expired' | 'invalidated';
export type AISignalFamily = 'classical' | 'candlestick' | 'harmonic';
export type AISignalDirection = 'long' | 'short';

export interface AISignalPoint {
  point: string;
  price: number;
  timestamp: number;
}

export interface AISignalGeoPoint {
  time: number;
  price: number;
  label?: string;
}

export interface AISignalOutcome {
  hit_t1: boolean;
  hit_t2: boolean;
  hit_stop: boolean;
  bars_to_t1?: number;
  bars_to_t2?: number;
  bars_to_stop?: number;
  mfe_atr: number;
  mae_atr: number;
  r_multiple: number;
  closed: boolean;
  horizon_bars: number;
  bars_tracked: number;
}

export interface AISignal {
  key: string;
  symbol: string;
  interval: string;
  family: AISignalFamily;
  pattern: string;
  label: string;
  direction: AISignalDirection;
  state: AISignalState;
  start_time: number;
  end_time: number;
  armed_at?: number;
  triggered_at?: number;
  ended_at?: number;
  trigger: number;
  invalidation: number;
  entry: number;
  stop: number;
  t1: number;
  t2: number;
  height: number;
  rr_t1: number;
  fit_quality: number;
  confidence: number;
  atr: number | null;
  volume_ratio: number;
  gates_passed: string[];
  gates_failed: string[];
  points: AISignalPoint[];
  lines: Record<string, AISignalGeoPoint[]>;
  trading_point?: AISignalGeoPoint;
  meta: Record<string, unknown>;
  outcome?: AISignalOutcome;
  alert?: {delivered: boolean; suppressed_reason?: string};
}

export interface AISignalPivotLevels {
  classical: Record<string, number>;
  fibonacci: Record<string, number>;
  camarilla: Record<string, number>;
}

/** One ZigZag swing the engine read the patterns off; only confirmed ones never repaint. */
export interface AISignalSwing {
  time: number;
  kind: 'H' | 'L';
  price: number;
  confirmed: boolean;
}

export interface AISignalsResponse {
  symbol: string;
  interval: string;
  profile: 'intraday' | 'swing';
  version: string;
  atr: number | null;
  from_time: number;
  to_time: number;
  bars: number;
  min_confidence: number;
  signals: AISignal[];
  pivots: AISignalSwing[];
  standard_pivots: AISignalPivotLevels | null;
}

export interface AISignalsRequestBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export interface AISignalsRequest {
  symbol: string;
  interval: string;
  bars: AISignalsRequestBar[];
  last_bar_forming: boolean;
}
