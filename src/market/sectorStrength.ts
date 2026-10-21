// The link into the Markets page's "Sector strength" section, as web `dev` reads it
// (RsSectorMatrixSection: `/market?rs=NIFTYIT&vs=NIFTY#sector-strength` lands on the section
// with that pair selected). A chat answer's `open_page` button carries this path; both apps
// parse it here.

export const SECTOR_STRENGTH_ANCHOR = 'sector-strength';

const MARKET_PATH = '/market';

export interface SectorStrengthLink {
  /** The Markets tab the section sits under; web's section is on Stocks and F&O alike. */
  tab: 'stocks' | 'fno';
  row: string | null;
  col: string | null;
}

/** The path web's section answers to, with a pair when one is given. */
export function sectorStrengthPath(pair?: {row: string; col: string}): string {
  const query =
    pair === undefined
      ? ''
      : `?rs=${encodeURIComponent(pair.row)}&vs=${encodeURIComponent(pair.col)}`;
  return `${MARKET_PATH}${query}#${SECTOR_STRENGTH_ANCHOR}`;
}

/**
 * Reads a sector-strength link, or null for any other path. The hash is what names the section:
 * `/market?rs=A&vs=B` alone is the Markets page.
 */
export function parseSectorStrengthPath(
  path: string,
): SectorStrengthLink | null {
  const hashAt = path.indexOf('#');
  if (hashAt < 0 || path.slice(hashAt + 1) !== SECTOR_STRENGTH_ANCHOR)
    return null;
  const beforeHash = path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const pathname = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  if (pathname !== MARKET_PATH && pathname !== `${MARKET_PATH}/fno`)
    return null;
  const params = new URLSearchParams(
    queryAt < 0 ? '' : beforeHash.slice(queryAt + 1),
  );
  const read = (key: string): string | null => {
    const value = params.get(key);
    return value === null || value === '' ? null : value;
  };
  return {
    tab: pathname === `${MARKET_PATH}/fno` ? 'fno' : 'stocks',
    row: read('rs'),
    col: read('vs'),
  };
}
