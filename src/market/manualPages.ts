// The field manuals: 142 published pages (138 sector manuals, their index and the three cap
// manuals) served as static documents under web's `public/manuals/` (web `dev` bd5a93ba). A chat
// answer's `open_page` button carries a page's path; web opens it as a document rather than a
// route (ActionsRow's DOCUMENT_PREFIX), and the app hosts it on a page of its own.

export const MANUAL_PAGE_PREFIX = '/manuals/';

const MANUAL_PAGE_SUFFIX = '.html';

/** A page's name: lowercase words and digits joined by hyphens, as every published page is named. */
const MANUAL_SLUG = /^[a-z0-9-]+$/;

/**
 * The slug a manuals path names, or null for anything else: a path outside the folder, a nested
 * one, an encoded or literal `..`, a name with characters no page carries. A query or hash after
 * the name is ignored.
 */
function slugOfPath(path: string): string | null {
  if (!path.startsWith(MANUAL_PAGE_PREFIX)) return null;
  const rest = path.slice(MANUAL_PAGE_PREFIX.length);
  const queryAt = rest.search(/[?#]/);
  const name = queryAt < 0 ? rest : rest.slice(0, queryAt);
  const slug = name.endsWith(MANUAL_PAGE_SUFFIX)
    ? name.slice(0, -MANUAL_PAGE_SUFFIX.length)
    : name;
  return MANUAL_SLUG.test(slug) ? slug : null;
}

/** True for a path under the manuals folder: `/manuals/banking-field-manual.html`, `/manuals/index.html`. */
export function isManualPagePath(path: string | null | undefined): boolean {
  return typeof path === 'string' && slugOfPath(path) !== null;
}

/** The page's slug without its extension: `banking-field-manual`, or `index` for the list. */
export function manualPageSlug(path: string): string {
  return slugOfPath(path) ?? '';
}

/**
 * The manual page a full URL points at, when it is one served from the web origin, else null: a
 * host that shows these pages decides whether a tapped link stays on its page (another manual),
 * or leaves for the browser (an exchange's site, a regulator's data).
 */
export function manualPageSlugOfUrl(
  frontendUrl: string,
  url: string,
): string | null {
  const origin = frontendUrl.replace(/\/+$/, '');
  if (!url.startsWith(`${origin}/`)) return null;
  return slugOfPath(url.slice(origin.length));
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
