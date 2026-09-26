import type {FundamentalsSeries} from '../types/fundamentalsDetail.ts';

export interface EquityYear {
  period: number;
  /** ₹ per share. */
  faceValue: number | null;
  /** Paid-up equity, ₹ crore. */
  paidUp: number | null;
  /** Authorised equity, ₹ crore. */
  authorised: number | null;
  /** Shares outstanding: paid-up capital over face value. */
  shares: number | null;
  /** Change in shares on the year before, %. */
  change: number | null;
}

/**
 * The company's share capital year by year, newest first, from the balance
 * sheet it filed. The share count is paid-up equity over face value, which is
 * what a bonus, split, buyback, ESOP allotment or preferential issue moves.
 */
export function buildEquityHistory(
  bs: FundamentalsSeries | undefined,
): EquityYear[] {
  if (!bs?.periods.length) return [];
  const at = (key: string, i: number): number | null =>
    bs.items[key]?.[i] ?? null;
  const years: EquityYear[] = bs.periods.map((period, i) => {
    const faceValue = at('FACE_VALUE', i);
    const paidUp = at('EQUITY_PAIDUP', i) ?? at('Share_Capital', i);
    return {
      period,
      faceValue,
      paidUp,
      authorised: at('Equity_Authorised', i),
      shares: paidUp != null && faceValue ? (paidUp * 1e7) / faceValue : null,
      change: null,
    };
  });
  return years
    .map((y, i) => {
      const prior = years[i + 1]?.shares;
      return {
        ...y,
        change:
          y.shares != null && prior ? ((y.shares - prior) / prior) * 100 : null,
      };
    })
    .filter(y => y.paidUp != null);
}
