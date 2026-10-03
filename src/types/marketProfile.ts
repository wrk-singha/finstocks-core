// GET /api/market/profile — one session's volume and TPO profile, its key levels, the setups read
// off it and the order flow estimated beside it (backend-go internal/market/profile). Web's
// interfaces, as web `dev` declares them.
//
// A backend before backend-go 625477d3 and b4133183 answers the same route without `thresholds`
// and without a setup's `title`, `summary` and `reasonText`. A reader that has to serve that
// backend too narrows the body itself rather than trusting these types (mobile: readMarketProfile).

export interface ProfileLevels {
  poc: number | null;
  val: number | null;
  vah: number | null;
}

/** One price row of the profile; `price` is the row's lower edge and rows come highest first. */
export interface ProfileRow {
  price: number;
  volume: number;
  tpo: number;
}

export type ProfileScreenGroup = 'trading' | 'investing';
export type ProfileScreenStatus = 'triggered' | 'none' | 'insufficient';
export type ProfileDirection = 'bullish' | 'bearish' | 'caution';

export interface ProfileScreen {
  id: string;
  group: ProfileScreenGroup;
  status: ProfileScreenStatus;
  direction?: ProfileDirection;
  invalidation?: number;
  reason?: string;
  /** The setup's name and one-line meaning, from the backend that owns the rule. */
  title: string;
  summary?: string;
  /** Why an insufficient setup could not be read, in words. */
  reasonText?: string;
}

export interface FlowMinute {
  t: string;
  price: number;
  volume: number;
  buy: number;
  sell: number;
  unknown: number;
  missing: number;
  delta: number;
  cvd: number;
  di: number | null;
  wdi: number | null;
  spread: number | null;
}

export interface FootprintRow {
  price: number;
  buy: number;
  sell: number;
  unknown: number;
}

export interface OrderFlow {
  minutes: FlowMinute[];
  footprint: FootprintRow[];
  coverage: number;
  gapFraction: number;
  quotes: number;
  reliable: boolean;
}

export interface MarketProfile {
  symbol: string;
  sessions: string[];
  session: string;
  asOf: string;
  live: boolean;
  rowSize: number;
  lastPrice: number | null;
  volume: ProfileLevels;
  tpo: ProfileLevels;
  hvn: number[];
  lvn: number[];
  rows: ProfileRow[];
  // The backend also says whether the opening hour has closed (`ibComplete`, since b4133183);
  // web does not read it, so it is not declared here.
  trading: {
    prior: ProfileLevels;
    priorLvns: number[];
    rvol: number | null;
    vwap: number | null;
    ibHigh: number | null;
    ibLow: number | null;
  };
  investing: {
    dailyRvol: number | null;
    excessReturn: number | null;
  };
  screens: ProfileScreen[];
  flow: OrderFlow | null;
  quality: {
    bars: number;
    expectedBars: number;
    hasVolume: boolean;
    volumeRepair: {cumulative: boolean; leakBars: number};
  };
  thresholds: {valueArea: number; rvolThreshold: number};
}

/** One session's profile as drawn, without the session list, order flow or thresholds - what a chat card carries. */
export type ProfileSnapshot = Omit<
  MarketProfile,
  'sessions' | 'flow' | 'thresholds'
>;

/** A stock or index by its symbol; a future by its underlying and expiry month (`YYYY-MM`). */
export type ProfileInstrument =
  {symbol: string} | {underlying: string; month: string};
