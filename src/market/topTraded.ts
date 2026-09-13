export interface RankedUnderlying {
  underlying: string;
  volume: number;
}

// `topTraded` isn't assumed pre-sorted (defensive), and its entries are
// filtered against `universe` since the ranking endpoint can return a symbol
// outside the current segment (e.g. delisted or mismatched).
export function rankByTopTraded(
  universe: string[],
  topTraded: RankedUnderlying[] | undefined,
): string[] {
  if (!topTraded || topTraded.length === 0) return universe;

  const universeSet = new Set(universe);
  const seen = new Set<string>();
  const ranked: string[] = [];
  for (const t of [...topTraded].sort((a, b) => b.volume - a.volume)) {
    if (!universeSet.has(t.underlying) || seen.has(t.underlying)) continue;
    seen.add(t.underlying);
    ranked.push(t.underlying);
  }

  const rest = universe.filter(symbol => !seen.has(symbol));

  return [...ranked, ...rest];
}
