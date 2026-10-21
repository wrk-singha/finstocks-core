import type {
  DepthInterpretation,
  MarketDepth,
  MarketSession,
} from '../types/market.ts';

/** The price "Use as limit" fills the order pad with: the reading's fair price at two decimals. */
export const fairLimitPrice = (reading: DepthInterpretation): number =>
  Number(reading.rough_iep_rounded.toFixed(2));

export type DepthRefusal = 'crossed' | 'thin';

/**
 * Why the backend withheld a reading, as the two things a reader is told: the best bid is above
 * the best ask, or too little of the book is quoted (one-sided, an empty touch).
 */
export const depthRefusal = (error: string): DepthRefusal =>
  error.startsWith('crossed book') ? 'crossed' : 'thin';

export type DepthBookStatus = 'live' | 'stored' | 'preopen' | 'closed';

/**
 * How a book stands against the clock. Only a `live` book offers its fair price to order at. In
 * market hours the backend can still hold only an earlier day's book, and labels it closed by
 * when it was seen: that is `stored`, shown as the closing book and not as live quotes.
 */
export function depthBookStatus(
  session: MarketSession,
  book: Pick<MarketDepth, 'session'>,
): DepthBookStatus {
  if (session === 'preopen') return 'preopen';
  if (session === 'closed') return 'closed';
  return book.session === 'closed' ? 'stored' : 'live';
}
