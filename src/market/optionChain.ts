import {
  formatCompactQuantity,
  formatCurrency,
  formatNumber,
} from '../format/number.ts';
import type {OptionChainRow, OptionOrderDraft} from '../types/fno.ts';
import {daysToExpiry} from './optionStructures.ts';

// Broker contract symbol from the underlying, expiry token, strike and side
// (e.g. NIFTY24JUL21000CE). Expiry is stripped to alphanumerics.
export function buildOptionContractSymbol(
  underlying: string,
  expiry: string | undefined,
  strike: number,
  side: 'CE' | 'PE',
): string {
  const base = underlying.toUpperCase();
  const expiryToken = expiry
    ? expiry.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : '';
  return `${base}${expiryToken}${strike}${side}`;
}

// Chronological, falling back to lexical for any non-date key so a broker-token
// format can't silently invert nearest/furthest.
export const byExpiryDate = (a: string, b: string): number => {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!isNaN(ta) && !isNaN(tb)) return ta - tb;
  return a < b ? -1 : a > b ? 1 : 0;
};

/**
 * The expiry a terminal should open on. Picking the first of a sorted list is
 * not the same thing: that list is a union of the socket's expiries and the
 * REST fallback's, so it grows as they arrive and its head changes under a leg
 * that has already started loading — one contract fetched, then another. The
 * nearest expiry still ahead is the same answer whichever source lands first.
 */
export const nearestExpiry = (
  expiries: string[],
  now = Date.now(),
): string | undefined => {
  if (expiries.length === 0) return undefined;
  const sorted = [...expiries].sort(byExpiryDate);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  // Falls back to the furthest listed rather than nothing: an all-past listing
  // is stale data, and blanking the terminal is worse than the last contract.
  return (
    sorted.find(e => {
      const t = Date.parse(e);
      return isNaN(t) || t >= startOfToday;
    }) ?? sorted[sorted.length - 1]
  );
};

const expiryLabelFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
});

// An ISO day parses as UTC midnight, so printed in the device's zone it reads as the day before
// anywhere west of UTC. It is a calendar date, not an instant, so it prints in UTC; the other
// broker spellings parse as local time and print in it.
const isoDayLabelFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Expiry token → "18 Aug" for the chain header and basket legs. Broker expiry
// formats vary, so a token that isn't a parseable date passes through as-is
// rather than becoming "Invalid Date".
export const formatExpiryLabel = (expiry: string | undefined): string => {
  if (!expiry) return '—';
  const parsed = Date.parse(expiry);
  if (Number.isNaN(parsed)) return expiry;
  const formatter = ISO_DAY_RE.test(expiry)
    ? isoDayLabelFormatter
    : expiryLabelFormatter;
  return (
    formatter
      .format(new Date(parsed))
      // "Sept" is the only four-letter short month Intl emits, so it alone
      // breaks the three-letter rhythm of an expiry column.
      .replace('Sept', 'Sep')
  );
};

// A strike names the contract, so it prints exactly: whole rupees without
// decimals, and a strike NSE lists on a 2.5 or 0.5 step with its fraction.
// Rounded to whole rupees, TATASTEEL's 187.5 call read as the 188 strike.
export const formatStrike = (strike: number): string => {
  const paise = Math.round(strike * 100);
  const decimals = paise % 100 === 0 ? 0 : paise % 10 === 0 ? 1 : 2;
  return formatNumber(strike, decimals);
};

/**
 * How a contract is named to a human: "NIFTY 18 Aug 24550 Call". The broker
 * symbol (`buildOptionContractSymbol`) is what goes on the order; this is what
 * goes on the ticket above it.
 */
export const optionContractLabel = (
  underlying: string,
  expiry: string | undefined,
  strike: number,
  right: 'CE' | 'PE',
): string =>
  [
    underlying.toUpperCase(),
    expiry ? formatExpiryLabel(expiry) : '',
    formatStrike(strike),
    right === 'CE' ? 'Call' : 'Put',
  ]
    .filter(Boolean)
    .join(' ');

// Open interest is a contract count, not a rupee figure, so `formatCurrency` and
// `formatCroreCompact` (which expects a value already denominated in crore) do
// not fit. It is on the same Indian scale as session volume and share
// quantities, so it reads through the one shared implementation, kept under its
// domain name because that is what every chain call site asks for.
export const formatOi = formatCompactQuantity;

// IV arrives as a fraction (0.0943 = 9.43%); 0 means the side has not quoted
// yet. Two decimals because a percentage point of IV is real money on a
// premium, and the "%" so the column can never be misread as a price.
export const formatIv = (iv: number | null): string =>
  iv != null && iv > 0 ? `${(iv * 100).toFixed(2)}%` : '—';

// Option premium. Always two decimals: rounding a ₹1,240.50 premium to ₹1,241
// above a threshold hides paise the user is actually paying.
export const formatPremium = (ltp: number | null): string =>
  ltp != null && ltp > 0 ? formatCurrency(ltp, 2) : '—';

export interface OiTotals {
  callOi: number;
  putOi: number;
  /** Σ pe oi / Σ ce oi; null unless both sides carry OI on at least
   *  MIN_PCR_STRIKES strikes. */
  pcr: number | null;
}

// A ratio over fewer strikes quoting both sides is one strike's quirk, not the
// market's positioning: a put-less fallback chain would otherwise read 0.00 and
// "bearish".
const MIN_PCR_STRIKES = 3;

// Call and put OI summed over `rows`, and the put-call ratio between them. The
// OI panel sums its window of strikes around the ATM, so the chart's assistant
// reads the same PCR the panel prints by calling this on the same window.
export function oiTotals(rows: readonly OptionChainRow[]): OiTotals {
  let callOi = 0;
  let putOi = 0;
  let paired = 0;
  for (const r of rows) {
    callOi += r.ceOi ?? 0;
    putOi += r.peOi ?? 0;
    if ((r.ceOi ?? 0) > 0 && (r.peOi ?? 0) > 0) paired += 1;
  }
  const pcr =
    callOi > 0 && putOi > 0 && paired >= MIN_PCR_STRIKES
      ? putOi / callOi
      : null;
  return {callOi, putOi, pcr};
}

// The row the ATM panel reads: the stream's own ATM flag, else the row at
// `atmStrike`.
export function atmRowOf(
  rows: readonly OptionChainRow[],
  atmStrike?: number | null,
): OptionChainRow | null {
  return (
    rows.find(r => r.isAtm) ??
    (atmStrike != null ? rows.find(r => r.strike === atmStrike) : undefined) ??
    null
  );
}

// Call plus put premium at a strike, or null unless both sides are quoting.
export function straddlePremium(row: OptionChainRow | null): number | null {
  if (!row) return null;
  const {ceLtp: ce, peLtp: pe} = row;
  if (ce == null || pe == null || ce <= 0 || pe <= 0) return null;
  return ce + pe;
}

// The ATM IV convention, at any strike: the mean of the call and put implied
// vol, falling back to whichever single side is quoting. A fraction (0.12);
// null when neither side is.
export function strikeIv(row: OptionChainRow | null): number | null {
  if (!row) return null;
  const ivs: number[] = [];
  if (row.ceIv != null && row.ceIv > 0) ivs.push(row.ceIv);
  if (row.peIv != null && row.peIv > 0) ivs.push(row.peIv);
  return ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : null;
}

export interface ChainSentiment {
  /** Put/Call OI ratio over the whole chain, as `oiTotals` reads it: null
   *  without enough strikes quoting both sides (no fabrication). */
  pcr: number | null;
  /** ATM straddle premium in points (ce ltp + pe ltp at the ATM strike) — the
   *  market's own expected move on the underlying by expiry. */
  expectedMove: number | null;
  /** ATM implied volatility as a fraction (e.g. 0.12), averaged over whichever
   *  of the ATM call/put IV are present. */
  atmIv: number | null;
  callOi: number;
  putOi: number;
}

/**
 * Single source of truth for the chain-derived sentiment vitals shared by the
 * terminal header and the Market F&O panel. Every value traces to streamed OI /
 * LTP / IV; anything the chain can't support is null.
 *
 * `atmStrike` is the fallback pivot for a snapshot whose rows carry no `isAtm`
 * flag (the REST fallback chain).
 */
export function computeChainSentiment(
  rows: OptionChainRow[],
  atmStrike?: number,
): ChainSentiment {
  if (rows.length === 0)
    return {pcr: null, expectedMove: null, atmIv: null, callOi: 0, putOi: 0};

  const {callOi, putOi, pcr} = oiTotals(rows);

  // drift resolved 2026-09-13: the web only honoured `isAtm`; the mobile's
  // `atmStrike` fallback wins because the REST fallback chain flags no row.
  const atm = atmRowOf(rows, atmStrike);

  return {
    pcr,
    expectedMove: straddlePremium(atm),
    atmIv: strikeIv(atm),
    callOi,
    putOi,
  };
}

export interface ExpiryPickerOption {
  value: string;
  label: string;
  /** "N DTE" for a live expiry; absent once past. */
  hint?: string;
}

// Expiry rows for a picker: the date, plus how many days away it is. Two
// contracts on the same underlying differ mainly by time left, so the DTE is
// what the choice is actually made on.
export const expiryPickerOptions = (
  expiries: string[],
  now: number = Date.now(),
): ExpiryPickerOption[] =>
  expiries.map(expiry => {
    const dte = daysToExpiry(expiry, now);
    const option: ExpiryPickerOption = {
      value: expiry,
      label: formatExpiryLabel(expiry),
    };
    // Today's expiry is "0 DTE" to a trader, but a past one is not worth a
    // negative count — those are filtered upstream anyway.
    if (dte != null && dte >= 0) option.hint = `${dte} DTE`;
    return option;
  });

// The strikes worth rendering as a chain. The feed sends 0, not null, for a
// contract that has never traded, and the ladder runs thousands of points past
// the money on both sides — keeping those pads the chain with hundreds of dead
// rows and pushes the money off the opening screen.
export function tradableChainRows(rows: OptionChainRow[]): OptionChainRow[] {
  const quoted = rows.filter(r => (r.ceLtp ?? 0) > 0 || (r.peLtp ?? 0) > 0);
  // Before the first trade of the session every strike is 0; showing the raw
  // ladder beats showing nothing.
  return quoted.length > 0
    ? quoted
    : rows.filter(r => r.ceLtp != null || r.peLtp != null);
}

// The `windowSize` strikes (that carry OI) nearest `pivot`, preserving the
// stream's ascending-strike order. Used by the OI panels to focus on the strikes
// around the ATM, where the OI that matters sits.
export function selectAtmWindow(
  rows: OptionChainRow[],
  pivot: number,
  windowSize: number,
): OptionChainRow[] {
  const withOi = rows.filter(r => r.ceOi != null || r.peOi != null);
  if (withOi.length === 0) return [];

  let centre = 0;
  let centreGap = Infinity;
  withOi.forEach((row, i) => {
    const gap = Math.abs(row.strike - pivot);
    if (gap < centreGap) {
      centreGap = gap;
      centre = i;
    }
  });

  const half = Math.floor(windowSize / 2);
  let start = Math.max(0, centre - half);
  const end = Math.min(withOi.length, start + windowSize);
  start = Math.max(0, end - windowSize);
  return withOi.slice(start, end);
}

// Max Pain: the strike at which option writers owe the least total intrinsic
// value if the underlying expired there. Derived purely from the per-strike
// open interest already streamed — no new data.
//
//   totalPain(K) = Σ over strikes s < K:  CE_OI[s] * (K - s)   // ITM calls
//                + Σ over strikes s > K:  PE_OI[s] * (s - K)   // ITM puts
//   maxPainStrike = argmin over all strikes K of totalPain(K)
//
// Missing or non-positive OI on a strike contributes 0. Returns null when the
// chain is empty or carries no real OI (caller renders no Max Pain marker).
// Only the strike and its OI are read, so callers holding stored OI (no prices) pass it as it is.
export function computeMaxPain(
  rows: readonly Pick<OptionChainRow, 'strike' | 'ceOi' | 'peOi'>[],
): number | null {
  if (rows.length === 0) return null;

  const strikes = rows.map(r => ({
    strike: r.strike,
    ceOi: r.ceOi != null && r.ceOi > 0 ? r.ceOi : 0,
    peOi: r.peOi != null && r.peOi > 0 ? r.peOi : 0,
  }));

  // An all-zero chain has no writer pain to minimise; don't guess a strike.
  if (!strikes.some(s => s.ceOi > 0 || s.peOi > 0)) return null;

  let bestStrike: number | null = null;
  let bestPain = Infinity;

  for (const {strike: k} of strikes) {
    let pain = 0;
    for (const s of strikes) {
      if (s.strike < k) pain += s.ceOi * (k - s.strike);
      else if (s.strike > k) pain += s.peOi * (s.strike - k);
    }
    if (pain < bestPain) {
      bestPain = pain;
      bestStrike = k;
    }
  }

  return bestStrike;
}

/**
 * Why the payoff beside an order pad has nothing to draw. The chart sees one
 * empty legs array whether the size or the price is missing, so only the draft
 * can name the field the trader still has to fill. `quoted` is whether the
 * contract has a price at all — without one, waiting is the honest message.
 */
export function payoffGap(
  draft: OptionOrderDraft | null,
  quoted: boolean,
): string | undefined {
  if (!draft) return undefined;
  if (draft.price == null || draft.price <= 0) {
    return quoted
      ? 'Please enter a valid limit price'
      : 'Waiting for a quote on this contract';
  }
  if (draft.qty <= 0) return "Enter a quantity to see this trade's payoff";
  return undefined;
}

/** One strike's worth of the OI ladder: the two sides drawn against a shared peak. */
export interface OiLadderBar {
  strike: number;
  callOi: number;
  putOi: number;
  /** 0–1 against the ladder's heaviest single-side OI, so both sides share a scale. */
  callShare: number;
  putShare: number;
}

export interface PositioningLadder {
  bars: OiLadderBar[];
  /** Strike bounds the ladder is plotted across, for positioning spot/max-pain rules. */
  min: number;
  max: number;
}

/**
 * The strikes worth plotting as a histogram: spot ±`spanPct`, widened to include
 * the heaviest call and put walls so a distant wall still appears — compressed at
 * the edge rather than dropped, or left to flatten every bar near the money.
 *
 * Strike intervals differ per underlying (50 on NIFTY, 100 on BANKNIFTY, arbitrary
 * on stocks), so the window is taken in percent of spot rather than in strike
 * count — the plotted range then means the same thing whichever symbol is open.
 */
export function buildOiLadder(
  rows: OptionChainRow[],
  spot: number | null,
  walls: {support?: number | null; resistance?: number | null} = {},
  spanPct = 0.04,
): PositioningLadder | null {
  if (rows.length === 0 || spot == null || spot <= 0) return null;

  let lo = spot * (1 - spanPct);
  let hi = spot * (1 + spanPct);
  for (const wall of [walls.support, walls.resistance]) {
    if (wall == null) continue;
    lo = Math.min(lo, wall);
    hi = Math.max(hi, wall);
  }

  const bars = rows
    .filter(r => r.strike >= lo && r.strike <= hi)
    .map(r => ({
      strike: r.strike,
      callOi: Math.max(r.ceOi ?? 0, 0),
      putOi: Math.max(r.peOi ?? 0, 0),
    }))
    .filter(b => b.callOi > 0 || b.putOi > 0);

  const first = bars[0];
  const last = bars[bars.length - 1];
  if (bars.length < 3 || first === undefined || last === undefined) return null;

  const peak = Math.max(...bars.map(b => Math.max(b.callOi, b.putOi)));
  if (peak <= 0) return null;

  return {
    bars: bars.map(b => ({
      ...b,
      callShare: b.callOi / peak,
      putShare: b.putOi / peak,
    })),
    min: first.strike,
    max: last.strike,
  };
}

/** Where `value` sits between `min` and `max`, clamped to 0–1. Null outside a real range. */
export function positionIn(
  value: number | null,
  min: number,
  max: number,
): number | null {
  if (value == null || !(max > min)) return null;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

export type PositioningStance = 'bullish' | 'bearish' | 'neutral';

export interface PositioningVerdict {
  /** English for web; mobile maps `stance`. */
  label: string;
  stance: PositioningStance;
  /**
   * Plain-language gloss of the label, for readers who don't trade the chain.
   * English for web; mobile maps `stance`.
   */
  leaning: string;
  /** 0–1 bias meter position: 0 fully call-heavy, 0.5 balanced, 1 fully put-heavy. */
  bias: number;
}

/**
 * The card's headline. PCR is mapped onto a fixed 0.5–1.5 track rather than a
 * percentile, because the ratio has an absolute meaning — 1.0 is balanced by
 * construction — and a percentile would need a history the chain doesn't carry.
 */
export function positioningVerdict(
  pcr: number | null,
): PositioningVerdict | null {
  if (pcr == null) return null;
  const bias = Math.min(Math.max((pcr - 0.5) / 1.0, 0), 1);
  if (pcr >= 1.1)
    return {
      label: 'Mildly bullish',
      stance: 'bullish',
      leaning: 'towards a rise',
      bias,
    };
  if (pcr <= 0.9)
    return {
      label: 'Mildly bearish',
      stance: 'bearish',
      leaning: 'towards a fall',
      bias,
    };
  return {label: 'Neutral', stance: 'neutral', leaning: 'neither way', bias};
}

/** Day-over-day PCR from the previous session's OI the stream already carries. */
export function pcrDelta(
  rows: OptionChainRow[],
  pcr: number | null,
): number | null {
  if (pcr == null || rows.length === 0) return null;
  let prevCall = 0;
  let prevPut = 0;
  for (const r of rows) {
    prevCall += Math.max(r.cePrevOi ?? 0, 0);
    prevPut += Math.max(r.pePrevOi ?? 0, 0);
  }
  if (prevCall <= 0) return null;
  return pcr - prevPut / prevCall;
}

export interface IvContext {
  /** 0–1 position of ATM IV within today's own smile. */
  position: number;
  low: number;
  high: number;
}

/**
 * IV needs a reference to be readable, and a true IV rank needs a year of history
 * the chain has none of. Today's own smile is the honest substitute: it says
 * whether the money is the cheap part of this chain or already bid up.
 */
export function ivContext(
  rows: OptionChainRow[],
  atmIv: number | null,
): IvContext | null {
  if (atmIv == null || atmIv <= 0) return null;
  const ivs: number[] = [];
  for (const r of rows) {
    if (r.ceIv != null && r.ceIv > 0) ivs.push(r.ceIv);
    if (r.peIv != null && r.peIv > 0) ivs.push(r.peIv);
  }
  if (ivs.length < 4) return null;
  const low = Math.min(...ivs);
  const high = Math.max(...ivs);
  const position = positionIn(atmIv, low, high);
  if (position == null) return null;
  return {position, low, high};
}

const nearestWithin = (value: number, spot: number, pct: number): boolean =>
  Math.abs(value - spot) / spot <= pct;

export interface PositioningInput {
  verdict: PositioningVerdict | null;
  spot: number | null;
  maxPain: number | null;
  support?: number | null;
  resistance?: number | null;
  expectedMove: number | null;
}

/**
 * One sentence of the positioning readout, as the numbers it names. Wall and
 * max-pain levels are the strikes as given; distances and the straddle's
 * expected move are rounded to whole points, as the sentence prints them.
 */
export type PositioningFact =
  | {
      /** Both walls bracket spot and the call wall is nearer. */
      kind: 'ceilingBindsFirst';
      ceiling: number;
      floor: number;
      /** Points from spot up to the call wall. */
      room: number;
      /** Points from spot down to the put wall. */
      cushion: number;
    }
  | {
      /** Both walls bracket spot and the put wall is nearer, or they are level. */
      kind: 'floorNearer';
      ceiling: number;
      floor: number;
      room: number;
      cushion: number;
    }
  | {kind: 'callWallOnly'; ceiling: number; distance: number}
  | {kind: 'putWallOnly'; floor: number; distance: number}
  | {
      /** Max pain within 1% of spot, inside the straddle's priced move. */
      kind: 'maxPainPin';
      maxPain: number;
      expectedMove: number;
    }
  | {
      kind: 'maxPainPull';
      distance: number;
      /** Where max pain sits relative to spot. */
      direction: 'above' | 'below';
      /** The side of the lean it pulls against. */
      side: 'upside' | 'downside';
    }
  | {
      /** Bearish lean under a call wall: a close above it breaks the lean. */
      kind: 'ceilingInvalidates';
      ceiling: number;
    }
  | {
      /** Bullish lean under a call wall: losing this level breaks the lean. */
      kind: 'supportInvalidates';
      level: number;
      /** The put wall when there is one, otherwise spot rounded to a point. */
      source: 'putWall' | 'spot';
    };

/**
 * What the positioning implies and what would break it — not a re-narration of
 * the numbers printed above. Every fact names a level, so the readout is only
 * useful alongside the ladder rather than a substitute for reading it. In
 * reading order; empty without a verdict, a usable spot, or anything to say.
 */
export function positioningFacts(p: PositioningInput): PositioningFact[] {
  const {verdict, spot, maxPain, support, resistance, expectedMove} = p;
  if (!verdict || spot == null || spot <= 0) return [];

  const facts: PositioningFact[] = [];

  const ceiling = resistance != null && resistance > spot ? resistance : null;
  const floor = support != null && support < spot ? support : null;

  if (ceiling != null && floor != null) {
    const room = ceiling - spot;
    const cushion = spot - floor;
    facts.push({
      kind: room < cushion ? 'ceilingBindsFirst' : 'floorNearer',
      ceiling,
      floor,
      room: Math.round(room),
      cushion: Math.round(cushion),
    });
  } else if (ceiling != null) {
    facts.push({
      kind: 'callWallOnly',
      ceiling,
      distance: Math.round(ceiling - spot),
    });
  } else if (floor != null) {
    facts.push({
      kind: 'putWallOnly',
      floor,
      distance: Math.round(spot - floor),
    });
  }

  if (
    maxPain != null &&
    nearestWithin(maxPain, spot, 0.01) &&
    expectedMove != null
  ) {
    facts.push({
      kind: 'maxPainPin',
      maxPain,
      expectedMove: Math.round(expectedMove),
    });
  } else if (maxPain != null) {
    facts.push({
      kind: 'maxPainPull',
      distance: Math.round(Math.abs(maxPain - spot)),
      direction: maxPain > spot ? 'above' : 'below',
      side: verdict.stance === 'bearish' ? 'downside' : 'upside',
    });
  }

  if (ceiling != null && verdict.stance !== 'neutral') {
    if (verdict.stance === 'bearish') {
      facts.push({kind: 'ceilingInvalidates', ceiling});
    } else {
      facts.push(
        floor != null
          ? {kind: 'supportInvalidates', level: floor, source: 'putWall'}
          : {
              kind: 'supportInvalidates',
              level: Math.round(spot),
              source: 'spot',
            },
      );
    }
  }

  return facts;
}

function positioningSentence(fact: PositioningFact): string {
  switch (fact.kind) {
    case 'ceilingBindsFirst':
      return `Writers have ${formatNumber(fact.room)} points of room to the ${formatNumber(fact.ceiling)} call wall against ${formatNumber(fact.cushion)} to the ${formatNumber(fact.floor)} put wall, so the ceiling binds first.`;
    case 'floorNearer':
      return `The ${formatNumber(fact.floor)} put wall is ${formatNumber(fact.cushion)} points below against ${formatNumber(fact.room)} to the ${formatNumber(fact.ceiling)} call wall, so the floor is the nearer constraint.`;
    case 'callWallOnly':
      return `Call writers are stacked at ${formatNumber(fact.ceiling)}, ${formatNumber(fact.distance)} points up — that is the level to clear.`;
    case 'putWallOnly':
      return `Put writers are defending ${formatNumber(fact.floor)}, ${formatNumber(fact.distance)} points down.`;
    case 'maxPainPin':
      return `Max pain at ${formatNumber(fact.maxPain)} sits inside the ±${formatNumber(fact.expectedMove)} the straddle prices, so a pin here is the path of least resistance.`;
    case 'maxPainPull':
      return `Max pain ${formatNumber(fact.distance)} points ${fact.direction} pulls against the ${fact.side}.`;
    case 'ceilingInvalidates':
      return `A close above ${formatNumber(fact.ceiling)} would force those calls to cover and invalidate the lean.`;
    case 'supportInvalidates':
      return `Losing ${formatNumber(fact.level)} would pull the support out from under it.`;
  }
}

/**
 * The positioning facts as one paragraph.
 * English for the web app; mobile renders `positioningFacts`.
 */
export function positioningReadout(p: PositioningInput): string | null {
  const facts = positioningFacts(p);
  return facts.length ? facts.map(positioningSentence).join(' ') : null;
}
