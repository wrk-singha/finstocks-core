import {formatNumber} from '../format/index.ts';
import type {FnoPosition, FnoTradeIdea, OptionLeg} from '../types/fno.ts';
import {
  SESSION_CLOSE,
  addMarketDays,
  isTradingDay,
  marketDateString,
  marketMinutesNow,
  marketToday,
} from './marketHours.ts';

/** Payoff of one leg at an expiry spot, in ₹ (premium already netted). */
export function legPayoff(
  leg: OptionLeg,
  spotAtExpiry: number,
  lotSize: number,
): number {
  const qty = leg.lots * lotSize;
  const sign = leg.action === 'buy' ? 1 : -1;
  // A future has no premium, so `premium` carries its entry price instead of a
  // per-unit cost, which keeps one leg shape across both kinds.
  if (leg.right === 'FUT') return sign * (spotAtExpiry - leg.premium) * qty;
  const intrinsic =
    leg.right === 'CE'
      ? Math.max(spotAtExpiry - leg.strike, 0)
      : Math.max(leg.strike - spotAtExpiry, 0);
  return sign * (intrinsic - leg.premium) * qty;
}

export function payoffAt(
  legs: OptionLeg[],
  spotAtExpiry: number,
  lotSize: number,
): number {
  return legs.reduce(
    (sum, leg) => sum + legPayoff(leg, spotAtExpiry, lotSize),
    0,
  );
}

export interface StructureMath {
  /** Negative = net debit paid, positive = net credit received. */
  netPremium: number;
  /** Positive ₹ figure. Null means genuinely unlimited. */
  maxLoss: number | null;
  maxGain: number | null;
  /** Underlying levels where the position breaks even at expiry. */
  breakevens: number[];
  /** Slope of the payoff above every strike — decides unbounded upside. */
  slopeAbove: number;
}

/**
 * Expiry payoff profile of a multi-leg structure.
 *
 * The payoff is piecewise-linear with kinks only at strikes (and at a future’s
 * entry price), so evaluating at those plus both boundaries finds the true
 * extremes without sampling.
 *
 * For options the downside is bounded because the underlying cannot go below
 * zero, so spot=0 is the worst case. A future keeps paying out linearly past
 * every strike in both directions, so its tails are unbounded the same way a
 * naked short call’s upside is — which is exactly the case a trader most needs
 * flagged rather than rounded off to a big number.
 *
 * Null lot size returns null rather than substituting 1: every figure here is a
 * ₹ amount scaled by units-per-lot, so an assumed lot size understates the risk
 * on the card by whatever the real multiple is.
 */
export function structureMath(
  legs: OptionLeg[],
  lotSize: number,
): StructureMath;
export function structureMath(
  legs: OptionLeg[],
  lotSize: number | null,
): StructureMath | null;
export function structureMath(
  legs: OptionLeg[],
  lotSize: number | null,
): StructureMath | null {
  if (lotSize == null) return null;

  // Counting a future's entry price here would book the contract notional as a
  // cash flow, and riskedAmount divides every percentage by it.
  const netPremium = legs.reduce(
    (sum, leg) =>
      leg.right === 'FUT'
        ? sum
        : sum +
          (leg.action === 'buy' ? -1 : 1) * leg.premium * leg.lots * lotSize,
    0,
  );

  if (legs.length === 0) {
    return {
      netPremium: 0,
      maxLoss: null,
      maxGain: null,
      breakevens: [],
      slopeAbove: 0,
    };
  }

  // A future kinks nowhere, but its entry price is where its payoff crosses
  // zero, so it belongs in the sample set for the same reason a strike does.
  const kinks = Array.from(
    new Set(legs.map(l => (l.right === 'FUT' ? l.premium : l.strike))),
  ).sort((a, b) => a - b);
  const top = kinks[kinks.length - 1] ?? 0;
  const bottom = kinks[0] ?? 0;
  // One strike-gap past the highest strike, so the far-field slope is sampled
  // on the flat segment rather than on a kink.
  const beyond = top + Math.max(top * 0.25, top - bottom || top * 0.25);

  const signedLots = (l: OptionLeg) => (l.action === 'buy' ? 1 : -1) * l.lots;
  const slopeAbove = legs
    .filter(l => l.right === 'CE' || l.right === 'FUT')
    .reduce((s, l) => s + signedLots(l), 0);
  // Below the lowest kink a future still loses as spot falls and a put still
  // gains, so a put offsets a future exactly — a protective put's loss is
  // capped, not unlimited. Calls are worthless down here.
  const slopeBelow = legs
    .filter(l => l.right === 'FUT' || l.right === 'PE')
    .reduce((s, l) => s + (l.right === 'PE' ? -1 : 1) * signedLots(l), 0);

  const points = [0, ...kinks, beyond];
  const values = points.map(s => payoffAt(legs, s, lotSize));

  let maxGain: number | null = Math.max(...values);
  let maxLoss: number | null = Math.min(...values);
  if (slopeAbove > 0) maxGain = null;
  if (slopeAbove < 0) maxLoss = null;
  if (slopeBelow > 0) maxLoss = null;
  if (slopeBelow < 0) maxGain = null;

  const breakevens: number[] = [];
  // A level can be hit twice when a kink sits exactly on the crossing — a lone
  // future, whose entry price is both.
  const addBreakeven = (level: number) => {
    if (!breakevens.some(b => Math.abs(b - level) < 1e-9))
      breakevens.push(level);
  };
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i] ?? 0;
    const p1 = points[i + 1] ?? 0;
    const v0 = values[i] ?? 0;
    const v1 = values[i + 1] ?? 0;
    if (v0 === 0) addBreakeven(p0);
    else if (v0 < 0 !== v1 < 0) {
      const t = Math.abs(v0) / (Math.abs(v0) + Math.abs(v1));
      addBreakeven(p0 + t * (p1 - p0));
    }
  }

  return {
    netPremium,
    maxLoss: maxLoss == null ? null : Math.abs(Math.min(maxLoss, 0)),
    maxGain: maxGain == null ? null : Math.max(maxGain, 0),
    breakevens,
    slopeAbove,
  };
}

/**
 * Rupee amount actually at risk on a structure. Debit structures have
 * maxLoss === |netPremium|, so this is a no-op for them; credit structures
 * (e.g. an iron condor) diverge — the risk is width-minus-credit, not the
 * credit received, and that's the number an exit plan has to be measured
 * against. Falls back to the premium magnitude when the structure is
 * genuinely uncapped, since there's no finite figure to use instead.
 */
export function riskedAmount(
  math: Pick<StructureMath, 'maxLoss' | 'netPremium'>,
): number {
  return math.maxLoss ?? Math.abs(math.netPremium);
}

export interface NeedsCondition {
  /** Where the underlying has to finish for the position to make money. */
  kind: 'above' | 'below' | 'between' | 'outside';
  underlying: string;
  /** Lowest breakeven, rounded to a whole point. */
  low: number;
  /** Signed move from spot to the lowest breakeven, in % (unformatted). */
  lowMovePct: number;
  /** Highest breakeven, rounded; null for a single-breakeven `above`/`below`. */
  high: number | null;
  highMovePct: number | null;
}

/**
 * The falsifiable condition: what the underlying has to do, by when, for this
 * position to make money. A structure is otherwise a set of Greeks — this is
 * the form a trader can actually agree or disagree with.
 */
export function needsCondition(
  idea: Pick<FnoTradeIdea, 'underlying' | 'legs' | 'lotSize' | 'spot'>,
  math: StructureMath,
): NeedsCondition | null {
  const {breakevens} = math;
  const {spot, underlying} = idea;
  // The ideas feed sends spot 0 and lot size 0 when it has none (backend-go 4c8bf631): a move
  // measured from 0 is Infinity%, and a payoff of 0 lots says nothing about which side wins.
  if (ideaFigure(spot) === null || ideaLotSize(idea) === null) return null;
  const low = breakevens[0];
  const high = breakevens[breakevens.length - 1];
  if (low === undefined || high === undefined) return null;

  const movePct = (level: number) => ((level - spot) / spot) * 100;

  if (breakevens.length === 1) {
    const profitAbove = payoffAt(idea.legs, low * 1.02, idea.lotSize) > 0;
    return {
      kind: profitAbove ? 'above' : 'below',
      underlying,
      low: Math.round(low),
      lowMovePct: movePct(low),
      high: null,
      highMovePct: null,
    };
  }

  const insideWins = payoffAt(idea.legs, (low + high) / 2, idea.lotSize) > 0;
  return {
    kind: insideWins ? 'between' : 'outside',
    underlying,
    low: Math.round(low),
    lowMovePct: movePct(low),
    high: Math.round(high),
    highMovePct: movePct(high),
  };
}

/**
 * The needs condition as one sentence: "NIFTY above 24,050 (+0.2%)".
 * English for the web app; mobile renders `needsCondition`.
 */
export function needsSentence(
  idea: Pick<FnoTradeIdea, 'underlying' | 'legs' | 'lotSize' | 'spot'>,
  math: StructureMath,
): string | null {
  const condition = needsCondition(idea, math);
  if (condition === null) return null;
  const {kind, underlying, high, highMovePct} = condition;

  const at = (level: number, move: number) =>
    `${formatNumber(level)} (${move >= 0 ? '+' : ''}${move.toFixed(1)}%)`;
  const low = at(condition.low, condition.lowMovePct);

  if (high === null || highMovePct === null)
    return `${underlying} ${kind} ${low}`;
  return kind === 'between'
    ? `${underlying} between ${low} and ${at(high, highMovePct)}`
    : `${underlying} outside ${low} – ${at(high, highMovePct)}`;
}

export interface CostDrag {
  /** Round-trip charges across every leg, in ₹. */
  total: number;
  /** Share of the best case those charges consume, 0-100. Null if unbounded. */
  shareOfMaxGainPct: number | null;
}

/**
 * Round-trip charges on one options leg at a flat exit: entered and exited at
 * `price` for `quantity` units. The host app binds its brokerage calculator
 * and broker here, e.g. `(p, q) => calculateBrokerage(p, p, q, 'options', broker).totalCharges`.
 */
export type LegChargesFn = (price: number, quantity: number) => number;

/**
 * Round-trip charges for the whole structure.
 *
 * SEBI's study puts transaction costs at 28% of everything individual traders
 * lost — the single largest identifiable drain, and the one no platform shows
 * before the trade. Estimated at a flat exit (same premium in and out), which
 * is the honest floor: it is what the position costs even when nothing moves.
 */
export function costDrag(
  idea: Pick<FnoTradeIdea, 'legs' | 'lotSize'>,
  math: StructureMath,
  chargesFor: LegChargesFn,
): CostDrag {
  const total = idea.legs.reduce(
    (sum, leg) => sum + chargesFor(leg.premium, leg.lots * idea.lotSize),
    0,
  );

  const shareOfMaxGainPct =
    math.maxGain != null && math.maxGain > 0
      ? (total / math.maxGain) * 100
      : null;

  return {total, shareOfMaxGainPct};
}

export type IvStance = 'rich' | 'fair' | 'cheap';

export interface IvRead {
  stance: IvStance;
  /**
   * Plain-language consequence, not the percentile restated.
   * English for web; mobile maps `stance`.
   */
  note: string;
}

/**
 * Turns an IV percentile into the decision it actually drives. Buying premium
 * into rich IV is the documented way to be right on direction and still lose,
 * so the read is phrased as what to do rather than as a number to interpret.
 */
export function ivRead(percentile: number | null): IvRead | null {
  if (percentile == null) return null;
  if (percentile >= 70)
    return {
      stance: 'rich',
      note: 'Premium is expensive — favours selling, not buying',
    };
  if (percentile <= 30)
    return {
      stance: 'cheap',
      note: 'Premium is cheap — favours buying, not selling',
    };
  return {stance: 'fair', note: 'Premium is around its usual level'};
}

/** Margin freed by the hedge leg, as a percentage of the unhedged requirement. */
export function marginUnlockPct(idea: FnoTradeIdea): number | null {
  const naked = idea.nakedCapitalRequired;
  // A capital of 0 is the feed having none, not a hedge that frees all of it.
  if (ideaFigure(idea.capitalRequired) === null) return null;
  if (naked == null || naked <= 0 || idea.capitalRequired >= naked) return null;
  return ((naked - idea.capitalRequired) / naked) * 100;
}

/**
 * A figure the ideas feed sends as 0 when it has none (spot, capital required, conviction, since
 * backend-go 4c8bf631 builds ideas from the recommendations table): the number when it is a
 * positive one, else null. Shown only when not null; never "0%" or "₹0".
 */
export const ideaFigure = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null;

/** The lot size an idea can be sized by, or null: the feed sends 0 when it knows none. */
export const ideaLotSize = (
  idea: Pick<FnoTradeIdea, 'lotSize'>,
): number | null =>
  Number.isInteger(idea.lotSize) && idea.lotSize > 0 ? idea.lotSize : null;

/**
 * Live while the feed calls it `active` (before backend-go 4c8bf631) or `open` (since), or says
 * nothing. Anything else (`closed`, `hit_target`, `hit_stop`, `expired`, `cancelled`) is resolved.
 */
export const isLiveIdea = (idea: Pick<FnoTradeIdea, 'status'>): boolean =>
  idea.status === undefined ||
  idea.status === 'active' ||
  idea.status === 'open';

/**
 * Why an idea cannot be placed as it stands, in the order the reader is told:
 * - `closed`: the idea has resolved;
 * - `noExpiry`: no expiry date, which the feed sends empty when its source has none;
 * - `expiryPassed`: its expiry day is behind it (`daysToExpiry` below 0);
 * - `noLotSize`: no lot size, which the feed sends as 0 when it knows none;
 * - `legIncomplete`: no legs, or a leg without a buy/sell side, a whole number of lots, a price
 *   above 0 (the feed fills a leg's premium from its entry, 0 when there is none), or (for an
 *   option) a strike and CE/PE; the feed reads strike and right off the instrument's name and
 *   leaves them 0 and "" when the name does not parse.
 */
export type FnoIdeaHold =
  'closed' | 'noExpiry' | 'expiryPassed' | 'noLotSize' | 'legIncomplete';

const isCompleteLeg = (leg: OptionLeg): boolean =>
  (leg.action === 'buy' || leg.action === 'sell') &&
  Number.isInteger(leg.lots) &&
  leg.lots > 0 &&
  Number.isFinite(leg.premium) &&
  leg.premium > 0 &&
  (leg.right === 'FUT' ||
    ((leg.right === 'CE' || leg.right === 'PE') &&
      Number.isFinite(leg.strike) &&
      leg.strike > 0));

/**
 * What keeps a structure from being stated as an order at `now` (epoch ms): everything
 * `FnoIdeaHold` names but `closed`.
 */
export function structureHold(
  idea: Pick<FnoTradeIdea, 'expiry' | 'lotSize' | 'legs'>,
  now: number = Date.now(),
): Exclude<FnoIdeaHold, 'closed'> | null {
  const {expiry} = idea;
  const days =
    typeof expiry === 'string' && expiry.trim() !== ''
      ? daysToExpiry(expiry, now)
      : null;
  if (days === null) return 'noExpiry';
  if (days < 0) return 'expiryPassed';
  if (ideaLotSize(idea) === null) return 'noLotSize';
  if (idea.legs.length === 0 || !idea.legs.every(isCompleteLeg))
    return 'legIncomplete';
  return null;
}

/** Why Place is held for an idea at `now`, or null when it may be placed. See `FnoIdeaHold`. */
export const fnoIdeaHold = (
  idea: Pick<FnoTradeIdea, 'expiry' | 'lotSize' | 'legs' | 'status'>,
  now: number = Date.now(),
): FnoIdeaHold | null =>
  isLiveIdea(idea) ? structureHold(idea, now) : 'closed';

/**
 * Serialise a structure into the chat handoff. Every leg is spelled out because
 * a spread placed one leg at a time is a different, riskier trade than the one
 * the card showed.
 *
 * Null when the structure is not complete enough to be an order (`structureHold`): an assistant
 * asked to place "expiry ." or "Lot size 0" would have to pick the expiry or the size itself.
 *
 * English on purpose: this is a prompt for the AI assistant, not UI copy.
 */
export function describeStructure(
  idea: FnoTradeIdea,
  prefix: string,
  now: number = Date.now(),
): string | null {
  if (structureHold(idea, now) !== null) return null;
  const legs = idea.legs
    .map(
      l =>
        `${l.action.toUpperCase()} ${l.lots} lot(s) ${idea.underlying} ${l.strike} ${l.right} @ ${l.premium}`,
    )
    .join('; ');
  return `${prefix} ${idea.label} on ${idea.underlying}, expiry ${idea.expiry}. Legs: ${legs}. Lot size ${idea.lotSize}.`;
}

export interface PositionExitState {
  /** entryNet - currentNet: positive when the premium moved in the holder's favour. */
  pnl: number;
  /** Null when the lot size is unknown: the amount risked can't be sized, and a
   *  percentage of an unknown base is worse than no percentage. */
  pnlPct: number | null;
  breached: boolean;
  nearing: boolean;
}

/**
 * Where an open position stands against the exit plan agreed at entry.
 *
 * entryNet/currentNet are signed net premium (debit negative, credit
 * positive), so pnl is entryNet - currentNet, not the other way round: a
 * long premium position that drops from -8,642 to -5,070 lost 3,572, and
 * entryNet - currentNet is the form that comes out negative for that loss.
 *
 * The ₹ P&L survives an unknown lot size because both nets arrive already in ₹;
 * only the percentage needs sizing, and without it the plan cannot be said to
 * be breached either — the desk stays silent rather than raising a false alarm.
 */
export function positionExitState(
  position: Pick<
    FnoPosition,
    'legs' | 'lotSize' | 'entryNet' | 'currentNet' | 'planExitPct'
  >,
): PositionExitState {
  const math = structureMath(position.legs, position.lotSize);
  const pnl = position.entryNet - position.currentNet;
  if (!math) return {pnl, pnlPct: null, breached: false, nearing: false};

  // Nothing sizable to measure against — a bare future risks margin, not
  // premium. A zero here would read as a 0% move and trip an exit plan whose
  // threshold is negative, so the desk stays silent instead.
  const risked = riskedAmount(math);
  if (risked <= 0) return {pnl, pnlPct: null, breached: false, nearing: false};

  const pnlPct = (pnl / risked) * 100;
  const plan = position.planExitPct;
  const breached = plan != null && pnlPct <= plan;
  const nearing = !breached && plan != null && pnlPct <= plan * 0.6;
  return {pnl, pnlPct, breached, nearing};
}

/** Whole days from now until expiry; negative once past. */
export function daysToExpiry(
  expiry: string,
  now: number = Date.now(),
): number | null {
  const end = new Date(expiry);
  if (isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - now) / 86_400_000);
}

// SEBI's Nov-2024 circular capped every exchange to a single benchmark weekly
// index expiry, so NIFTY is the only NSE index that still expires weekly and
// everything else expires once a month; since 1 Sep 2025 the expiry day is
// Tuesday rather than Thursday. An expiry landing on a holiday settles on the
// previous trading day. Computed rather than fetched because the strip renders
// above the tabs — the option-chain socket only carries expiries during market
// hours, and this line has to be right at 3 AM on a Sunday too.
const EXPIRY_WEEKDAY = 2;
const WEEKLY_EXPIRY_UNDERLYINGS = ['NIFTY'];
const MONTHLY_EXPIRY_UNDERLYINGS = [
  'BANKNIFTY',
  'FINNIFTY',
  'MIDCPNIFTY',
  'NIFTYNXT50',
];

/** Latest trading day at or before `date`, so a holiday expiry settles early. */
function settlementDay(date: Date): Date {
  let day = date;
  for (let i = 0; i < 10 && !isTradingDay(day); i++)
    day = addMarketDays(day, -1);
  return day;
}

/** First EXPIRY_WEEKDAY at or after `from`. */
function nextWeekday(from: Date): Date {
  return addMarketDays(from, (EXPIRY_WEEKDAY - from.getUTCDay() + 7) % 7);
}

/** Last EXPIRY_WEEKDAY of the month `date` falls in. */
function lastWeekdayOfMonth(date: Date): Date {
  const monthEnd = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
  return addMarketDays(
    monthEnd,
    -((monthEnd.getUTCDay() - EXPIRY_WEEKDAY + 7) % 7),
  );
}

/**
 * Nearest live expiry for an index underlying, as YYYY-MM-DD. Null for symbols
 * with no index options (INDIA VIX, NIFTY 100) rather than a guessed date.
 *
 * Once the session has closed on expiry day the nearest contract is the next
 * one, so the search starts tomorrow — otherwise the strip would keep claiming
 * "expires today" all evening.
 */
export function nextIndexExpiry(
  underlying: string,
  now: Date = new Date(),
): string | null {
  const symbol = underlying.toUpperCase();
  const weekly = WEEKLY_EXPIRY_UNDERLYINGS.includes(symbol);
  if (!weekly && !MONTHLY_EXPIRY_UNDERLYINGS.includes(symbol)) return null;

  const today = marketToday(now);
  const from =
    marketMinutesNow(now) > SESSION_CLOSE ? addMarketDays(today, 1) : today;

  // Both cadences can settle before their nominal day, so a holiday-shifted
  // expiry that has already passed rolls to the following series.
  for (let i = 0; i < 3; i++) {
    const nominal = weekly
      ? addMarketDays(nextWeekday(from), i * 7)
      : lastWeekdayOfMonth(
          new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)),
        );
    const settled = settlementDay(nominal);
    if (settled.getTime() >= from.getTime()) return marketDateString(settled);
  }
  return null;
}
