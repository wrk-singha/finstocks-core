import type {ContractSeries} from '../types/graphData.ts';

// The F&O heatmap's replay: every future's price and open interest on one shared clock, each
// step's change and OI change measured as the board measures them, and the tiles at a step held in
// the order the window closed in. Ported from web's `utils/market/fnoHeatReplay.ts`
// (origin/development, after 9b642b08). Bar stamps are IST wall-clock strings and are only ever
// compared as strings, so the device's time zone never moves a step.

/** The server's reading of a future's price change and OI change together (web `Buildup`). */
export type FnoBuildup =
  'long_buildup' | 'short_buildup' | 'short_covering' | 'long_unwinding';

/** A window of the futures' bars on a shared clock: every contract's price and open interest at every step. */
export interface FnoReplayFrames {
  /** "2026-10-23 09:15:00", IST wall clock, one per step. */
  times: string[];
  /** Keyed by contract, upper case. Carried forward over a bar the contract did not trade; NaN before it has one. */
  price: Map<string, Float64Array>;
  oi: Map<string, Float64Array>;
  /** What each step's change is measured from: the session before the window, or the window's first bar. */
  basePrice: Map<string, number>;
  /** Absent when no open interest is known to measure from. */
  baseOi: Map<string, number>;
}

export interface FnoReplayWindow {
  /** The first and last stamps the window holds, inclusive: "2026-10-23 09:15:00" to "2026-10-23 15:30:59". */
  start: string;
  end: string;
  /**
   * The window opens at a session's open, so its change runs from the session before, as the
   * board's does. Otherwise it runs from the window's own first bar.
   */
  fromOpen: boolean;
  /**
   * The window's one session, "2026-10-23", when it spans just one: the server's pc and poi are
   * measured against the day a contract's series ends on, so they are that session's base only
   * then. Null for a range.
   */
  day: string | null;
  /** The session's first and last bar, "09:15" and "15:30": a bar outside them is neither a step nor a base. */
  hours: {open: string; close: string};
}

/** One future's figures at a step, as the board reads them. */
export interface FnoReplayFigures {
  change: number | null;
  oiChange: number | null;
  buildup: FnoBuildup | null;
}

/** The bars a replay is built from: a contract's series, as `parseContractBars` reads it, or anything short of one. */
type ReplaySeries = Partial<ContractSeries> | null | undefined;

/** A tile the replay arranges: what it is keyed by, and the future it reads. */
export interface FnoReplayTile {
  ticker: string;
  /** The future the figures are read off, as the exchange names it; null when the screen named none. */
  contract: string | null;
}

/** How a tile at a step differs from the board's: its figures as of the step, and how it is drawn. */
export interface FnoReplayShown {
  change: number | null;
  oiChange: number | null;
  buildup: FnoBuildup | null;
  /** Outside the build-up filter: kept in place, faded. */
  faded: boolean;
  /** A replay has no figures for this future: no bars for it, or none to measure from. */
  missing: boolean;
}

export type FnoReplayFilter = 'all' | FnoBuildup;
export type FnoReplayOrder = 'desc' | 'asc';

// The answer is keyed as asked, in whichever case.
const seriesByContract = (
  raw: Readonly<Record<string, ReplaySeries>>,
): Map<string, Partial<ContractSeries>> => {
  const out = new Map<string, Partial<ContractSeries>>();
  for (const [key, series] of Object.entries(raw)) {
    if (series && Array.isArray(series.t)) out.set(key.toUpperCase(), series);
  }
  return out;
};

const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;
const known = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * The window's frames. The series come newest first, and a contract may lack a bar another has,
 * so every stamp in the window is one step and each contract carries its last price and open
 * interest forward, starting from where it stood before the window opened. Null when the window
 * holds fewer than two stamps, or no contract has a base to measure from.
 */
export function buildFnoReplay(
  raw: Readonly<Record<string, ReplaySeries>>,
  contracts: readonly string[],
  window: FnoReplayWindow,
): FnoReplayFrames | null {
  const series = seriesByContract(raw);
  // Bar stamps and the window's bounds are compared at the bounds' length, so a bound may name a
  // day alone.
  const key = (t: string) => t.slice(0, window.start.length);
  // The feed stores some minutes past the close; the replay plays the session.
  const inSession = (t: string) => {
    const hhmm = t.slice(11, 16);
    return (
      hhmm.length < 5 ||
      (hhmm >= window.hours.open && hhmm <= window.hours.close)
    );
  };
  const inWindow = (t: string) =>
    key(t) >= window.start && key(t) <= window.end && inSession(t);

  const stamps = new Set<string>();
  for (const contract of contracts) {
    for (const t of series.get(contract.toUpperCase())?.t ?? []) {
      if (typeof t === 'string' && inWindow(t)) stamps.add(t);
    }
  }
  // One bar is a picture, not a replay.
  if (stamps.size < 2) return null;
  const times = [...stamps].sort();
  const at = new Map(times.map((t, i) => [t, i]));

  const price = new Map<string, Float64Array>();
  const oi = new Map<string, Float64Array>();
  const basePrice = new Map<string, number>();
  const baseOi = new Map<string, number>();

  for (const asked of contracts) {
    const contract = asked.toUpperCase();
    const s = series.get(contract);
    const stampsOf = s?.t;
    if (!s || stampsOf === undefined || price.has(contract)) continue;
    const order = stampsOf
      .map((_, i) => i)
      .sort((a, b) => {
        const left = stampsOf[a] ?? '';
        const right = stampsOf[b] ?? '';
        return left < right ? -1 : left > right ? 1 : 0;
      });

    let priceIn = Number.NaN;
    let oiIn = Number.NaN;
    const priceRow = new Float64Array(times.length).fill(Number.NaN);
    const oiRow = new Float64Array(times.length).fill(Number.NaN);
    for (const i of order) {
      const t = stampsOf[i];
      const c = s.c?.[i];
      const o = s.oi?.[i];
      if (typeof t !== 'string' || key(t) > window.end || !inSession(t)) {
        continue;
      }
      if (key(t) < window.start) {
        if (positive(c)) priceIn = c;
        if (known(o)) oiIn = o;
        continue;
      }
      const step = at.get(t);
      if (step === undefined) continue;
      if (positive(c)) priceRow[step] = c;
      if (known(o)) oiRow[step] = o;
    }
    fillForward(priceRow, priceIn);
    fillForward(oiRow, oiIn);

    const firstPrice = priceRow.find(v => !Number.isNaN(v));
    const firstOi = oiRow.find(v => !Number.isNaN(v));
    let priceBase: number | undefined = firstPrice;
    let oiBase: number | undefined = firstOi;
    if (window.fromOpen) {
      // The server's figures are the board's own base, but only for the session the contract's
      // series ends on.
      const newest =
        order.length > 0 ? stampsOf[order[order.length - 1] ?? -1] : undefined;
      const ownSession =
        window.day !== null &&
        typeof newest === 'string' &&
        newest.slice(0, 10) === window.day;
      priceBase =
        ownSession && positive(s.pc)
          ? s.pc
          : !Number.isNaN(priceIn)
            ? priceIn
            : firstPrice;
      oiBase =
        ownSession && positive(s.poi)
          ? s.poi
          : !Number.isNaN(oiIn)
            ? oiIn
            : firstOi;
    }
    if (!positive(priceBase)) continue;
    price.set(contract, priceRow);
    oi.set(contract, oiRow);
    basePrice.set(contract, priceBase);
    if (positive(oiBase)) baseOi.set(contract, oiBase);
  }
  return price.size > 0 ? {times, price, oi, basePrice, baseOi} : null;
}

function fillForward(row: Float64Array, from: number): void {
  let last = from;
  for (let i = 0; i < row.length; i++) {
    const v = row[i] ?? Number.NaN;
    if (Number.isNaN(v)) row[i] = last;
    else last = v;
  }
}

/**
 * The server's own reading (screenoptions.go, futureFigures): price and open interest both up is a
 * long build-up, and so on round the four; either one flat or unknown is no build-up.
 */
export function buildupFrom(
  change: number | null,
  oiChange: number | null,
): FnoBuildup | null {
  if (change == null || oiChange == null || change === 0 || oiChange === 0) {
    return null;
  }
  if (change > 0) return oiChange > 0 ? 'long_buildup' : 'short_covering';
  return oiChange > 0 ? 'short_buildup' : 'long_unwinding';
}

/** Each contract's change, OI change and build-up as of one step, in percent. */
export function fnoReplayFigures(
  frames: FnoReplayFrames,
  step: number,
): Map<string, FnoReplayFigures> {
  const i = Math.min(Math.max(0, step), frames.times.length - 1);
  const out = new Map<string, FnoReplayFigures>();
  for (const [contract, row] of frames.price) {
    const base = frames.basePrice.get(contract);
    const p = row[i] ?? Number.NaN;
    const change = base && !Number.isNaN(p) ? (p / base - 1) * 100 : null;
    const oiBase = frames.baseOi.get(contract);
    const o = frames.oi.get(contract)?.[i] ?? Number.NaN;
    const oiChange = oiBase && !Number.isNaN(o) ? (o / oiBase - 1) * 100 : null;
    out.set(contract, {
      change,
      oiChange,
      buildup: buildupFrom(change, oiChange),
    });
  }
  return out;
}

/**
 * The tiles at one step, held in the order the window closed in: a grid that reshuffled every step
 * could not be watched. For the same reason a tile outside the build-up filter keeps its place,
 * faded. A tile whose future the replay has no figures for shows none and says so. Ties, and the
 * tiles with no closing figure (after the rest), go by ticker, so a step never reshuffles them.
 */
export function arrangeFnoReplay<T extends FnoReplayTile>(
  tiles: readonly T[],
  figures: ReadonlyMap<string, FnoReplayFigures>,
  closing: ReadonlyMap<string, FnoReplayFigures>,
  filter: FnoReplayFilter,
  order: FnoReplayOrder,
): (Omit<T, keyof FnoReplayShown> & FnoReplayShown)[] {
  const of = (map: ReadonlyMap<string, FnoReplayFigures>, tile: T) =>
    tile.contract ? map.get(tile.contract.toUpperCase()) : undefined;
  const byTicker = (a: T, b: T) =>
    a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0;
  return tiles
    .map(tile => ({tile, end: of(closing, tile)?.change ?? null}))
    .sort((a, b) => {
      if (a.end == null || b.end == null) {
        if (a.end == null && b.end == null) return byTicker(a.tile, b.tile);
        return a.end == null ? 1 : -1;
      }
      return (
        (order === 'desc' ? b.end - a.end : a.end - b.end) ||
        byTicker(a.tile, b.tile)
      );
    })
    .map(({tile}) => {
      const now = of(figures, tile);
      const buildup = now?.buildup ?? null;
      return {
        ...tile,
        change: now?.change ?? null,
        oiChange: now?.oiChange ?? null,
        buildup,
        faded: filter !== 'all' && buildup !== filter,
        missing: !now,
      };
    });
}
