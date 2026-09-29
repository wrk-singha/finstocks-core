import type {StatementBasis} from './fundamentalsDetail.ts';

export type SegmentPeriod = 'annual' | 'quarterly';

/** One reportable segment; each series is aligned to `periods`, oldest first. */
export interface SegmentSeries {
  name: string;
  key: string;
  is_unallocated: boolean;
  is_intersegment: boolean;
  /** ₹ crore; null where the segment was not reported that period. */
  revenue: (number | null)[];
  /** Profit before interest and tax, ₹ crore. */
  result: (number | null)[];
  /** Segment assets less segment liabilities at period end, ₹ crore. */
  capital_employed: (number | null)[];
}

export interface SegmentFilingRef {
  period: number;
  url: string;
  source: string;
  /** A year summed from its four quarters: the filing had no year column. */
  derived: boolean;
  reconciles: boolean;
  reconcile_note?: string;
}

export interface SegmentsResponse {
  symbol: string;
  fincode: number;
  /** The basis actually served, which falls back when the asked one is unfiled. */
  basis: StatementBasis;
  basis_available: StatementBasis[];
  period: SegmentPeriod;
  period_available: SegmentPeriod[];
  /** YYYYMM, oldest first. */
  periods: number[];
  segments: SegmentSeries[];
  filings: SegmentFilingRef[];
}
