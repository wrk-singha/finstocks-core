import {
  lastSessionOpen,
  marketDateString,
  marketSession,
  marketToday,
  PRE_OPEN_START,
  sessionFor,
} from './marketHours.ts';

/**
 * When a list's prices are from, as the Markets lists and the screener stamp them (web's
 * smartListStamp), in parts for the host to word:
 * - in session, the read's own time: "as of 14:32", with the day first when it is not today's,
 *   and "Live" when the read carries no time;
 * - from 09:00 to the open, a read from today's auction is the pre-open, which is neither the
 *   last close nor the session yet: "Pre-open · as of 09:07";
 * - otherwise the last session's close, "Fri 23 Oct close", unless the read is older than that
 *   session or than its last minute: then its own day and time, "as of Mon 26 Oct 14:00".
 *
 * Judged on the clock (`now`), never on when the page fetched: a list fetched at 15:20 and still
 * on screen at 15:35 holds 15:20's prices, not the close.
 */
export type ListStamp =
  | {kind: 'live'}
  | {
      kind: 'asOf';
      /** The read's instant, epoch ms. */
      at: number;
      /** Name its IST day as well as its time: off-hours always, in session when not today. */
      showsDay: boolean;
    }
  | {kind: 'preOpen'; at: number | null}
  | {
      kind: 'close';
      /** The session's open, epoch ms: its IST day is the one the stamp names. */
      session: number;
    };

/**
 * Polling stops at the bell, so the last read can be a few minutes short of it: figures from 15:27
 * are not the close. The session's last one-minute frame (from 15:28) stands for it.
 */
export const CLOSE_FRAME_MS = 2 * 60_000;

const istDay = (ms: number): string =>
  marketDateString(marketToday(new Date(ms)));

export function listStamp(
  asOf: string | number | null | undefined,
  isLive: boolean,
  now: number,
  market = 'IN',
): ListStamp {
  const at =
    typeof asOf === 'number' ? asOf : asOf ? Date.parse(asOf) : Number.NaN;
  const isKnown = Number.isFinite(at);
  const today = istDay(now);
  if (isLive) {
    if (!isKnown) return {kind: 'live'};
    return {kind: 'asOf', at, showsDay: istDay(at) !== today};
  }
  // Figures from today's auction say so; ones from before it are still the last close.
  const auction = sessionFor(today).midnight * 1000 + PRE_OPEN_START * 60_000;
  if (
    marketSession(market, new Date(now)) === 'preopen' &&
    (!isKnown || at >= auction)
  ) {
    return {kind: 'preOpen', at: isKnown ? at : null};
  }
  const lastOpen = lastSessionOpen(market, new Date(now)).getTime();
  const lastClose = sessionFor(istDay(lastOpen)).close * 1000;
  if (isKnown && (at < lastOpen || at < lastClose - CLOSE_FRAME_MS)) {
    return {kind: 'asOf', at, showsDay: true};
  }
  return {kind: 'close', session: lastOpen};
}
