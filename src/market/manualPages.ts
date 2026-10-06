// The field manuals: 142 published pages (138 sector manuals, their index and the three cap
// manuals) served as static documents under web's `public/manuals/` (web `dev` bd5a93ba). A chat
// answer's `open_page` button carries a page's path; web opens it as a document rather than a
// route (ActionsRow's DOCUMENT_PREFIX), and the app hosts it on a page of its own.

export const MANUAL_PAGE_PREFIX = '/manuals/';

const MANUAL_PAGE_SUFFIX = '.html';

/** True for a path under the manuals folder: `/manuals/banking-field-manual.html`, `/manuals/index.html`. */
export function isManualPagePath(path: string | null | undefined): boolean {
  if (typeof path !== 'string' || !path.startsWith(MANUAL_PAGE_PREFIX))
    return false;
  const rest = path.slice(MANUAL_PAGE_PREFIX.length);
  return rest !== '' && !rest.includes('/') && !rest.includes('..');
}

/** The page's slug without its extension: `banking-field-manual`, or `index` for the list. */
export function manualPageSlug(path: string): string {
  const rest = path.slice(MANUAL_PAGE_PREFIX.length);
  const queryAt = rest.search(/[?#]/);
  const name = queryAt < 0 ? rest : rest.slice(0, queryAt);
  return name.endsWith(MANUAL_PAGE_SUFFIX)
    ? name.slice(0, -MANUAL_PAGE_SUFFIX.length)
    : name;
}

/** Where the page is served: the web origin plus its path. */
export function manualPageUrl(frontendUrl: string, slug: string): string {
  return `${frontendUrl.replace(/\/+$/, '')}${MANUAL_PAGE_PREFIX}${slug}${MANUAL_PAGE_SUFFIX}`;
}

/**
 * A page title read off its slug, for the screen's header before the page itself has loaded:
 * `banking-field-manual` → `Banking field manual`.
 */
export function manualPageTitle(slug: string): string {
  const [first = '', ...rest] = slug.split('-').filter(Boolean);
  if (first === '') return '';
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
