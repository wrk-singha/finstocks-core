export const SECTOR_CHIPS = [
  'Energy',
  'IT',
  'Financials',
  'Auto',
  'Healthcare',
  'FMCG',
  'Infrastructure',
] as const;

export type CoarseSector = (typeof SECTOR_CHIPS)[number];

/** Map a fine-grained data sector (e.g. "Software & Programming") to one of the
 *  coarse buckets above. Returns null when nothing matches. */
export function mapSector(sector: string | null): CoarseSector | null {
  if (!sector) return null;
  const s = sector.toLowerCase();
  const has = (...ks: string[]) => ks.some(k => s.includes(k));
  if (
    has(
      'oil',
      'gas',
      'coal',
      'energy',
      'petroleum',
      'power',
      'electric util',
      'fuel',
    )
  )
    return 'Energy';
  if (
    has(
      'software',
      'computer',
      'semiconductor',
      'communications equipment',
      'internet',
      'information tech',
      'electronic',
    )
  )
    return 'IT';
  if (has('bank', 'insurance', 'financ', 'investment', 'broker'))
    return 'Financials';
  if (has('auto', 'truck', 'vehicle', 'tyre', 'tire')) return 'Auto';
  if (has('drug', 'pharma', 'health', 'biotech', 'medical', 'hospital'))
    return 'Healthcare';
  if (
    has(
      'food',
      'beverage',
      'household',
      'tobacco',
      'restaurant',
      'grocery',
      'apparel',
      'personal',
      'consumer',
      'retail',
      'jewelry',
      'recreational',
    )
  )
    return 'FMCG';
  if (
    has(
      'construction',
      'cement',
      'steel',
      'iron',
      'infrastruct',
      'engineering',
      'capital goods',
      'railroad',
      'real estate',
      'metal',
      'machinery',
      'fabricated',
      'paper',
      'chemical',
    )
  )
    return 'Infrastructure';
  return null;
}
