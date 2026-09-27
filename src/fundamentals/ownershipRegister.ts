import type {OwnershipDeal, OwnershipHolder} from '../types/ownership.ts';

// The named register and the trades that changed it, as /news/ownership serves
// them: the newest quarter's largest holders, largest first, and the bulk,
// block and insider trades on record.

export type HolderBandKey = 'largest' | 'listed' | 'rest';

export interface HolderBand {
  key: HolderBandKey;
  /** The band's stake in the company, in percent, to two decimals. */
  pct: number;
  /** How many holders the band is: one, the rest of the register, or null for everyone undisclosed. */
  holders: number | null;
  /** The band's width on its track, in percent of the track. */
  share: number;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * How concentrated the register is — the one thing the list itself cannot show.
 *
 * The pattern answers "what kind of holder" and the rows answer "which holder";
 * neither answers whether the company is held by one party or by a thousand,
 * which is a different fact from the promoter percentage: a 50% promoter stake
 * split across eight family entities is not the 50% one trust holds outright.
 * So the register is cut into its largest holder, the rest of the names on it,
 * and everyone too small to be disclosed. Nothing to cut under two holders.
 */
export function holderConcentration(
  holders: readonly OwnershipHolder[],
): HolderBand[] {
  const [first, ...others] = holders;
  if (first === undefined || others.length === 0) return [];
  const largest = round2(first.percentage);
  const listed = round2(others.reduce((sum, h) => sum + h.percentage, 0));
  // Percentages are reported per holder and rounded independently, so a
  // register that is genuinely complete can total a hair over 100. Scaling by
  // whichever is larger keeps the bands inside their track either way.
  const scale = Math.max(100, largest + listed);
  const rest = round2(100 - largest - listed);
  const bands: Omit<HolderBand, 'share'>[] = [
    {key: 'largest', pct: largest, holders: 1},
    {key: 'listed', pct: listed, holders: others.length},
    // Dropped when the named holders already account for the whole register,
    // rather than drawn as a sliver that is really a rounding error.
    ...(rest > 1 ? [{key: 'rest' as const, pct: rest, holders: null}] : []),
  ];
  return bands.map(band => ({...band, share: (band.pct / scale) * 100}));
}

/** Whether a bulk or block deal bought. Read by its first letter, so BUY, Buy and B all count. */
export const isBuyDeal = (deal: OwnershipDeal): boolean =>
  deal.deal_type.trim().toUpperCase().startsWith('B');
