import type {FundamentalsOwnership} from '../types/fundamentalsDetail.ts';

// Promoter pledging: one of the few ownership facts that is a risk signal
// rather than a description. Shares pledged against borrowing can be sold by
// the lender if the price falls, so a rising pledge is a forced-selling risk
// that a shareholding percentage alone does not reveal. The vendor files it per
// quarter (the share of the promoter's own holding, and the share count), which
// is what makes the direction readable rather than just the level.

export interface PledgeQuarter {
  quarter: number;
  /** The pledged share of the promoter's holding, in percent; null where the quarter was not filed. */
  pct: number | null;
}

export interface PromoterPledge {
  /** The newest filed quarter's pledge, in percent of the promoter's own holding. */
  pct: number;
  /** That quarter, as YYYYMM. */
  quarter: number;
  /** Points moved since the filed quarter before it, to two decimals; null with nothing before it. */
  change: number | null;
  /** Shares pledged that quarter; null when the count was not filed. */
  shares: number | null;
  /** Every quarter oldest first: a level only means something against its own path. */
  history: PledgeQuarter[];
  /** The highest pledge on record, which the history is drawn against. */
  peak: number;
}

const PROMOTER = 'Ftotalpromoter';

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * The promoter pledge, or null when no quarter on file carries one. Most
 * companies have none, and an always-present "0.00%" would make the zero read
 * as a finding.
 */
export function promoterPledge(
  ownership: FundamentalsOwnership,
): PromoterPledge | null {
  const promoter = ownership.categories.find(c => c.code === PROMOTER);
  const filed: PledgeQuarter[] = ownership.quarters.map((quarter, i) => ({
    quarter,
    pct: promoter?.pledge_pct?.[i] ?? null,
  }));
  const levels = filed.flatMap(q => (q.pct == null ? [] : [q.pct]));
  if (!levels.some(pct => pct > 0)) return null;
  // Quarters run newest first, so the first filed one is the latest.
  const latestIndex = filed.findIndex(q => q.pct != null);
  const latest = filed[latestIndex];
  if (latest?.pct == null) return null;
  const prior = filed.slice(latestIndex + 1).find(q => q.pct != null);
  return {
    pct: latest.pct,
    quarter: latest.quarter,
    change: prior?.pct == null ? null : round2(latest.pct - prior.pct),
    shares: promoter?.pledge_shares?.[latestIndex] ?? null,
    history: [...filed].reverse(),
    peak: Math.max(...levels),
  };
}
