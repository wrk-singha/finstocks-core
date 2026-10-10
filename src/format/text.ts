/** True for a "short" recommendation/order direction, case- and null-insensitive — short pre-selects the Sell tab and flips the buy/sell badge. */
export const isShortDirection = (direction?: string | null): boolean =>
  direction?.toLowerCase() === 'short';

/**
 * Title for a chat derived from its first message. Stores a generous slice with no trailing
 * "…" — the list truncates visually at the actual row edge.
 */
export const deriveChatTitle = (text: string, maxLength = 80): string => {
  const normalized = text.trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength).trimEnd()
    : normalized;
};

/** Avatar initials from a username: first+last initials, else first letter, else "U". */
export const getUserInitials = (username?: string | null): string => {
  const [first, second] = username?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!first) return 'U';
  const initials = second
    ? first.charAt(0) + second.charAt(0)
    : first.charAt(0);
  return initials.toUpperCase();
};

/** "1 leg" / "3 legs"; pass an explicit plural when it isn't a simple "+s" ("match", "matches"). */
export const pluralCount = (
  n: number,
  singular: string,
  plural = `${singular}s`,
): string => `${n} ${n === 1 ? singular : plural}`;

/** Turn a stored enum/slug into a readable label: "CAUTIOUSLY_OPTIMISTIC" → "Cautiously optimistic". */
export const humanizeLabel = (value: string | null | undefined): string => {
  if (!value) return '';
  const words = value.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** News and market-theme text carries inline citation markers like "[2][4][7]". */
export const stripCitations = (value: string | null | undefined): string =>
  (value ?? '').replace(/\[\d+\]/g, '').trim();

/**
 * LLM narrative also carries markdown (**bold**, `code`, [text](url)); flatten it to plain
 * text for inline rendering. Builds on `stripCitations`.
 */
export const cleanProse = (value: string | null | undefined): string =>
  stripCitations(value)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`+/g, '')
    .trim();

/** News source links display as their publisher domain, not the raw URL. */
export const sourceDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const CITATION = /\(\s*Source:\s*([^)]*?)\s*\((https?:\/\/[^\s)]+)\)\s*\)/i;
const BARE_URL = /\(?https?:\/\/[^\s)]+\)?/g;
const LEADING_STAMP = /^\s*\[[^\]]*\]\s*/;
const ORPHANED_DASH = /([.!?])\s*[—–-]\s+/g;
const EDGE_DASHES = /^[\s—–-]+|[\s—–-]+$/g;

export interface RationaleParts {
  text: string;
  sourceName: string | null;
  sourceUrl: string | null;
}

const EMPTY_RATIONALE: RationaleParts = {
  text: '',
  sourceName: null,
  sourceUrl: null,
};

const publicationName = (cited: string): string | null =>
  cited.replace(/[\s–—-]*['"“].*$/s, '').trim() || null;

/**
 * The producer is spec'd to emit a one-line thesis but sometimes sends a news digest, whose
 * bracketed date stamp and raw URL wrap across several lines. Splits the prose from its
 * "(Source: Name (url))" citation, or from a bare URL when no citation is present.
 */
export function splitRationaleSource(
  rationale: string | null | undefined,
): RationaleParts {
  const raw = (rationale ?? '').trim();
  if (!raw) return EMPTY_RATIONALE;

  const cited = CITATION.exec(raw);

  const text = raw
    .replace(CITATION, '')
    .replace(BARE_URL, '')
    .replace(LEADING_STAMP, '')
    .replace(ORPHANED_DASH, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(EDGE_DASHES, '')
    .trim();

  return {
    text,
    sourceName: cited ? publicationName(cited[1] ?? '') : null,
    sourceUrl:
      cited?.[2] ?? raw.match(BARE_URL)?.[0]?.replace(/[()\s]/g, '') ?? null,
  };
}

// The whitespace a vendor body actually contains: spaces, the tab and newline a pretty-printed
// feed wraps at, and the non-breaking space an entity decodes to. Listed rather than
// pattern-matched so the set is readable and testable.
const WHITESPACE = new Set([' ', '\t', '\n', '\r', '\f', '\v', ' ']);
// Block-level tags whose boundary is a sentence break: without a space in their place,
// "...the Company.</div><div>The above..." fuses into one word.
// A tag runs to the first `>` outside a quoted attribute, so `title="1 > 0"` cannot end it early.
const TAG_BODY = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;
const HTML_BLOCK_TAG = new RegExp(
  String.raw`<\/?(?:br|p|div|li|tr|h[1-6])\b${TAG_BODY}>`,
  'gi',
);
const HTML_DROPPED_CONTENT =
  /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;
const HTML_TAG = new RegExp(String.raw`<\/?[a-z]${TAG_BODY}>`, 'gi');
const HTML_ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+\d*));/gi;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  bull: '•',
  middot: '·',
  deg: '°',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  sect: '§',
  para: '¶',
  times: '×',
  divide: '÷',
  laquo: '«',
  raquo: '»',
};

const decodeEntity = (
  match: string,
  decimal: string | undefined,
  hex: string | undefined,
  name: string | undefined,
): string => {
  const codePoint =
    decimal !== undefined
      ? Number(decimal)
      : hex !== undefined
        ? parseInt(hex, 16)
        : undefined;
  if (codePoint !== undefined) {
    return codePoint > 0 && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : match;
  }
  return NAMED_ENTITIES[(name ?? '').toLowerCase()] ?? match;
};

/**
 * Vendor feeds (Accord's `details`) ship HTML in a text column: block tags, <br>, and escaped
 * entities. Rendered as text it reads as literal `<div>` soup, and it is third-party content
 * on an authenticated page, so it is flattened to plain text rather than rendered as markup.
 * Tags go first and entities decode in a single pass afterwards, so "&lt;b&gt;" stays the
 * visible text it was — the same order a parser would apply.
 */
export function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  const text = value
    .replace(HTML_DROPPED_CONTENT, '')
    .replace(HTML_BLOCK_TAG, ' ')
    .replace(HTML_TAG, '')
    .replace(HTML_ENTITY, decodeEntity);

  // Collapse whitespace runs into single spaces. A scan over the decoded text, rather than a
  // pattern: the set above says exactly which characters count, including the NBSP an entity
  // decodes to.
  const words: string[] = [];
  let word = '';
  for (const char of text) {
    if (WHITESPACE.has(char)) {
      if (word) words.push(word);
      word = '';
    } else {
      word += char;
    }
  }
  if (word) words.push(word);
  return words.join(' ');
}

/**
 * Empty-state copy for the chat list under a search and/or category filter. `categoryLabels`
 * are the display names of the selected categories, in the order the picker lists them.
 */
export function emptyChatsMessage({
  isError,
  query,
  categoryLabels,
  noChats,
}: {
  isError: boolean;
  query: string;
  categoryLabels: readonly string[];
  noChats: string;
}): string {
  if (isError) {
    return "Couldn't load your chats. Check your connection and try again.";
  }
  const labels = categoryLabels.join(', ');
  if (query && labels) return `No ${labels} chats matching "${query}"`;
  if (query) return `No chats matching "${query}"`;
  if (labels) return `No ${labels} chats yet`;
  return noChats;
}
