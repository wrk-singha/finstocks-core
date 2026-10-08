import type {AnnouncementRow} from '../api/market.ts';
import {istDayKey, parseTimestamp} from '../format/date.ts';
import type {GetDividendsResponse} from '../types/dividends.ts';
import type {FundamentalsCorporateAction} from '../types/fundamentals.ts';
import type {
  ActionFamily,
  ActionStage,
  ActionSubtitle,
  ActionValue,
  CorporateActionEntry,
  CorporateFiling,
  ExchangeFilingEntry,
  FilingKind,
  StockEvent,
} from '../types/stockEvents.ts';

/**
 * The same action reaches us from four feeds that name it four ways — "Final Dividend" from the
 * dividend feed, "EX Dividend" from the fundamentals history, "Dividend" from the events API, a
 * Regulation 30 caption from the exchange. Reducing each to a family is what lets one date hold one
 * row instead of several, and is also how a results date knows to offer the financials rather than
 * a number.
 */
const FAMILY_PATTERNS: readonly (readonly [ActionFamily, RegExp])[] = [
  ['dividend', /dividend/i],
  ['bonus', /bonus/i],
  ['split', /split|face\s*value/i],
  ['rights', /rights/i],
  ['buyback', /buy\s*-?\s*back/i],
  ['preferential', /preferential/i],
  ['esop', /\b(esop|esos|esps)|employee\S* stock|stock option/i],
  ['demerger', /de-?merger|spin\s*-?\s*off|arrangement/i],
  ['merger', /merger|amalgamat/i],
  ['results', /result|board\s*meeting|earnings/i],
  ['agm', /\b[ae]gm\b|general\s*meeting/i],
  ['book_closure', /book\s*clos/i],
];

export const familyOf = (text: string): ActionFamily =>
  FAMILY_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';

export type ActionGroupKey =
  | 'dividend'
  | 'bonus'
  | 'split'
  | 'rights'
  | 'buyback'
  | 'esop'
  | 'preferential'
  | 'merger'
  | 'meetings'
  | 'other';

export interface ActionGroup {
  key: ActionGroupKey;
  families: readonly ActionFamily[];
}

/** How the Events tab splits corporate actions, in the order it offers them. */
export const ACTION_GROUPS: readonly ActionGroup[] = [
  {key: 'dividend', families: ['dividend']},
  {key: 'bonus', families: ['bonus']},
  {key: 'split', families: ['split']},
  {key: 'rights', families: ['rights']},
  {key: 'buyback', families: ['buyback']},
  {key: 'esop', families: ['esop']},
  {key: 'preferential', families: ['preferential']},
  {key: 'merger', families: ['merger', 'demerger']},
  {key: 'meetings', families: ['results', 'agm', 'book_closure']},
  {key: 'other', families: ['other']},
];

export const actionGroupOf = (family: ActionFamily): ActionGroupKey =>
  ACTION_GROUPS.find(group => group.families.includes(family))?.key ?? 'other';

/** The groups that hold at least one row, in the order the tab offers them. */
export const groupCorporateActions = <
  T extends {readonly family: ActionFamily},
>(
  actions: readonly T[],
): {key: ActionGroupKey; entries: T[]}[] =>
  ACTION_GROUPS.map(group => ({
    key: group.key,
    entries: actions.filter(action => group.families.includes(action.family)),
  })).filter(group => group.entries.length > 0);

/** Whether a feed's date parses, in any of the shapes the backend sends. */
export const isValidDate = (
  value: string | null | undefined,
): value is string => parseTimestamp(value) !== null;

/** A row's instant, for ordering; 0 for a date that does not parse. */
export const eventTime = (value: string): number =>
  parseTimestamp(value)?.getTime() ?? 0;

const dayOf = (value: string): string => {
  const parsed = parseTimestamp(value);
  return parsed === null ? '' : istDayKey(parsed);
};

const newestFirst = <T extends {readonly date: string}>(rows: T[]): T[] =>
  rows.sort((a, b) => eventTime(b.date) - eventTime(a.date));

const trimmed = (value: string | null | undefined): string | null => {
  const text = value?.trim();
  return text === undefined || text === '' ? null : text;
};

// The vendor escapes an apostrophe by doubling it ("Investors'' Meeting"), and the doubled form is
// what reaches the row unless it is undone here.
const tidy = (text: string): string =>
  text.replace(/''/g, "'").replace(/\s+/g, ' ').trim();

/**
 * The filing's subject, not the word "Announcement".
 *
 * 43% of captions open with "Announcement under Regulation 30 (LODR)-" and the rest with a sibling
 * of it, so titling rows by their type printed the same noun down the whole column and buried the
 * one phrase that separates a credit rating from an earnings call behind forty characters of
 * statute.
 */
const REG_PREFIX =
  /^(announcements?|intimations?|disclosures?)\s+under\s+regulation[^-–:]*[-–:]\s*/i;

/** The caption without its statute, else the declared type; null when neither names anything. */
export const filingTitle = (
  caption: string,
  type?: string | null,
): string | null => {
  const stripped = tidy(caption.trim().replace(REG_PREFIX, ''));
  if (stripped !== '') return stripped;
  const kind = (type ?? '').toLowerCase().replace(/_/g, ' ').trim();
  if (kind === '' || kind.startsWith('general')) return null;
  return kind.charAt(0).toUpperCase() + kind.slice(1);
};

// Filings carry a type worth seeing, but not worth a bold noun on every row.
export const filingKind = (type: string | null | undefined): FilingKind => {
  const kind = (type ?? '').toLowerCase().replace(/_/g, ' ').trim();
  if (kind.startsWith('outcome')) return 'outcome';
  if (kind.startsWith('intimation')) return 'intimation';
  if (kind.startsWith('compliance')) return 'compliance';
  return 'filing';
};

/** Only when it says something the title has not. */
const detailBeyond = (
  details: string | null | undefined,
  title: string | null,
): string | null => {
  const text = tidy(details ?? '');
  return text === '' || text.toLowerCase() === (title ?? '').toLowerCase()
    ? null
    : text;
};

type CategoryPhrase = Extract<
  ActionSubtitle,
  'acquisition' | 'name_change' | 'delisting'
>;

// Accord leaves `subject` blank on most scheduled events, so these few categories keep a phrase
// of their own rather than the family's.
const hasOwnPhrase = (category: string): category is CategoryPhrase =>
  category === 'acquisition' ||
  category === 'name_change' ||
  category === 'delisting';

// The archive names the stage in the action ("EX Dividend", "RECORD DATE"), which is the phrase
// that belongs on the second line rather than the title.
const historyStage = (action: string): ActionStage | null => {
  if (/^ex[\s-]/i.test(action)) return 'exDate';
  if (/record/i.test(action)) return 'recordDate';
  if (/payment|pay\s*date/i.test(action)) return 'paymentDate';
  return null;
};

const historyTitle = (action: string): string | null =>
  trimmed(action.trim().replace(/^ex[\s-]+/i, ''));

const historyValue = (
  row: FundamentalsCorporateAction,
): ActionValue | undefined => {
  if (row.amount != null && row.amount > 0) {
    return {kind: 'perShare', amount: row.amount};
  }
  if (row.ratio1 != null && row.ratio2 != null && row.ratio2 > 0) {
    return {kind: 'ratio', ratio1: row.ratio1, ratio2: row.ratio2};
  }
  if (row.offer_price != null && row.offer_price > 0) {
    return {kind: 'offerPrice', amount: row.offer_price};
  }
  return undefined;
};

type EntryFields = Pick<
  CorporateActionEntry,
  'key' | 'date' | 'family' | 'title' | 'subtitle'
> & {
  detail?: string | null | undefined;
  value?: ActionValue | undefined;
  href?: string | null | undefined;
};

/** An entry holds only what its feed filled in. */
const entryOf = ({
  detail,
  value,
  href,
  ...fields
}: EntryFields): CorporateActionEntry => ({
  ...fields,
  ...(detail == null ? {} : {detail}),
  ...(value === undefined ? {} : {value}),
  ...(href == null ? {} : {href}),
});

/**
 * A dividend row's identity: its stock, ex-date (the announcement date before one is set), type and
 * amount, as web keys it (66d641c3). Backend-go dev's Doom feed sends no `id`
 * (`marketdata/dividends.go` `DividendEvent`) where main's does, so a key built from the id read
 * "undefined" for every row on dev; this one is the same on both.
 */
export const dividendKey = (dividend: GetDividendsResponse): string =>
  [
    'div',
    (dividend.stock_symbol ?? '').toUpperCase(),
    String(dividend.ex_date ?? dividend.announcement_date),
    String(dividend.dividend_type),
    String(dividend.dividend_amount),
  ].join('-');

export interface CorporateActionFeeds {
  symbols: readonly string[];
  dividends?: readonly GetDividendsResponse[] | null | undefined;
  events?: readonly StockEvent[] | null | undefined;
  history?: readonly FundamentalsCorporateAction[] | null | undefined;
  /** One stock's classified exchange filings; ignored for a list of several. */
  filings?: readonly CorporateFiling[] | null | undefined;
  families?: readonly ActionFamily[] | undefined;
  labelSymbols?: boolean | undefined;
}

/**
 * Corporate actions for one stock or many, newest first, from the four feeds that carry them.
 *
 * Rows are keyed by stock, day and action family and the richest feed wins — the dividend feed
 * (amount, link), then the events API, then the fundamentals archive, then the exchange filings —
 * so an action the feeds all repeat is one row. The filings are the only source of ESOPs and
 * preferential issues, and of most buybacks. A company can declare two dividends on one ex-date (an
 * interim and a special), so the value that separates them joins the key; rows with no value of
 * their own still collapse onto each other. `families` narrows the result to, say, just results
 * dates; `labelSymbols` names each row's stock for a list of several.
 */
export function buildCorporateActions({
  symbols,
  dividends,
  events,
  history,
  filings,
  families,
  labelSymbols = false,
}: CorporateActionFeeds): CorporateActionEntry[] {
  const wanted = new Set(symbols.map(symbol => symbol.toUpperCase()));
  const keep = (family: ActionFamily): boolean =>
    families === undefined || families.includes(family);
  const single = symbols.length === 1 ? symbols[0]?.toUpperCase() : undefined;
  const out: CorporateActionEntry[] = [];
  const seen = new Set<string>();
  const keyCounts = new Map<string, number>();
  const claim = (
    symbol: string,
    date: string,
    family: ActionFamily,
    distinct?: number | null,
  ): boolean => {
    const key = `${symbol}|${dayOf(date)}|${family}|${distinct ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };
  const push = (symbol: string, entry: CorporateActionEntry): void => {
    // Two dividends the events feed dates to one day share its key; the key is the list's
    // identity, so the second is numbered rather than colliding.
    const count = keyCounts.get(entry.key) ?? 0;
    keyCounts.set(entry.key, count + 1);
    const key = count === 0 ? entry.key : `${entry.key}~${count + 1}`;
    out.push(labelSymbols ? {...entry, key, symbol} : {...entry, key});
  };

  if (keep('dividend')) {
    for (const dividend of dividends ?? []) {
      const symbol = (dividend.stock_symbol ?? '').toUpperCase();
      if (!wanted.has(symbol)) continue;
      const title = trimmed(dividend.dividend_type);
      const amount = dividend.dividend_amount;
      const value: ActionValue | undefined =
        amount == null ? undefined : {kind: 'perShare', amount};
      const base = dividendKey(dividend);

      if (
        isValidDate(dividend.ex_date) &&
        claim(symbol, dividend.ex_date, 'dividend', amount)
      ) {
        push(
          symbol,
          entryOf({
            key: `${base}-ex`,
            date: dividend.ex_date,
            family: 'dividend',
            title,
            subtitle: 'exDate',
            value,
          }),
        );
      }
      const summary = trimmed(dividend.announcement_summary);
      const announcement = trimmed(dividend.announcement_title);
      if (
        isValidDate(dividend.announcement_date) &&
        (summary !== null || announcement !== null)
      ) {
        push(
          symbol,
          entryOf({
            key: `${base}-ann`,
            date: dividend.announcement_date,
            family: 'dividend',
            title,
            subtitle: 'announced',
            detail: summary ?? announcement,
            value,
            href: trimmed(dividend.announcement_link),
          }),
        );
      }
      if (
        isValidDate(dividend.payment_date) &&
        claim(symbol, dividend.payment_date, 'dividend', amount)
      ) {
        push(
          symbol,
          entryOf({
            key: `${base}-pay`,
            date: dividend.payment_date,
            family: 'dividend',
            title,
            subtitle: 'paymentDate',
            value,
          }),
        );
      }
    }
  }

  for (const event of events ?? []) {
    const symbol = (event.symbol ?? '').toUpperCase();
    if (!wanted.has(symbol) || !isValidDate(event.event_date)) continue;
    const label = trimmed(event.label);
    const family = familyOf(`${event.category} ${label ?? event.category}`);
    if (!keep(family) || !claim(symbol, event.event_date, family, event.amount))
      continue;
    const ratio: ActionValue | undefined =
      event.ratio1 != null && event.ratio2 != null && event.ratio2 !== 0
        ? {kind: 'ratio', ratio1: event.ratio1, ratio2: event.ratio2}
        : undefined;
    const amount: ActionValue | undefined =
      event.amount != null && family === 'dividend'
        ? {kind: 'perShare', amount: event.amount}
        : undefined;
    push(
      symbol,
      entryOf({
        key: `corp-${symbol}-${event.category}-${event.event_date}`,
        date: event.event_date,
        family,
        title: label,
        subtitle: hasOwnPhrase(event.category) ? event.category : family,
        detail: trimmed(event.detail),
        value: ratio ?? amount,
      }),
    );
  }

  if (single !== undefined) {
    for (const row of history ?? []) {
      const date = row.ex_date ?? row.sdate ?? row.ef_from_date ?? null;
      const action = (row.corp_action ?? '').trim();
      if (action === '' || !isValidDate(date)) continue;
      const family = familyOf(action);
      if (!keep(family) || !claim(single, date, family, row.amount)) continue;
      push(
        single,
        entryOf({
          key: `hist-${row.corpact_id ?? action}-${date}`,
          date,
          family,
          title: historyTitle(action),
          subtitle: historyStage(action) ?? family,
          detail: trimmed(row.subject),
          value: historyValue(row),
        }),
      );
    }

    for (const filing of filings ?? []) {
      if (!isValidDate(filing.datetime)) continue;
      const family: ActionFamily =
        filing.category === 'merger' && /de-?merger/i.test(filing.caption)
          ? 'demerger'
          : filing.category;
      if (!keep(family) || !claim(single, filing.datetime, family)) continue;
      const title = filingTitle(filing.caption);
      push(
        single,
        entryOf({
          key: `filing-${filing.news_id}`,
          date: filing.datetime,
          family,
          title,
          subtitle: family,
          detail: detailBeyond(filing.details, title),
          href: trimmed(filing.attachment_url),
        }),
      );
    }
  }

  return newestFirst(out);
}

/**
 * One stock's exchange filings that are not already a row of its corporate actions, newest first.
 *
 * A buyback or ESOP filing is already in the calendar, classified. On the day a dividend was
 * announced the filing is that announcement, but only the dividend's own announcement row can
 * duplicate one: an ex or payment date landing on the same day is a different event.
 */
export function buildExchangeFilings({
  announcements,
  corporateFilings,
  actions,
}: {
  announcements: readonly AnnouncementRow[] | null | undefined;
  corporateFilings: readonly CorporateFiling[] | null | undefined;
  actions: readonly CorporateActionEntry[];
}): ExchangeFilingEntry[] {
  const announced = new Set(
    actions
      .filter(
        action =>
          action.family === 'dividend' && action.subtitle === 'announced',
      )
      .map(action => dayOf(action.date)),
  );
  const classified = new Set(
    (corporateFilings ?? []).map(filing => filing.news_id),
  );

  const out: ExchangeFilingEntry[] = [];
  for (const row of announcements ?? []) {
    if (!isValidDate(row.datetime)) continue;
    const caption = (row.caption ?? '').trim();
    if (
      caption === '' ||
      classified.has(row.news_id) ||
      announced.has(dayOf(row.datetime))
    ) {
      continue;
    }
    const title = filingTitle(caption, row.announcement_type);
    // `details` is the substance the caption's statute reference hides: "participates in White
    // House Signing Ceremony" against "Press Release".
    const detail = detailBeyond(row.details, title);
    const href = trimmed(row.attachment_url);
    out.push({
      key: `filing-${row.news_id}`,
      date: row.datetime,
      title,
      kind: filingKind(row.announcement_type),
      ...(detail === null ? {} : {detail}),
      ...(href === null ? {} : {href}),
    });
  }
  return newestFirst(out);
}

/** The actions that change the share count, and so explain a year's row of share capital. */
export const CAPITAL_FAMILIES: readonly ActionFamily[] = [
  'bonus',
  'split',
  'rights',
  'buyback',
  'esop',
  'preferential',
  'merger',
  'demerger',
];

export interface CapitalAction {
  group: ActionGroupKey;
  /** The ratio it was struck at, when its row carries one. */
  ratio?: {ratio1: number; ratio2: number};
}

// A YYYYMM year-end as the instant its financial year opened and the one it closed.
const yearWindow = (period: number): {from: number; to: number} => {
  const year = Math.floor(period / 100);
  const month = period % 100;
  return {from: Date.UTC(year - 1, month, 1), to: Date.UTC(year, month, 1)};
};

/**
 * The capital actions filed inside each financial year, keyed by its YYYYMM year-end and newest
 * first: what a year's change in share count came from, each kind and ratio named once.
 */
export function capitalActionsByYear(
  actions: readonly CorporateActionEntry[],
  periods: readonly number[],
): Map<number, CapitalAction[]> {
  const capital = actions.filter(action =>
    CAPITAL_FAMILIES.includes(action.family),
  );
  return new Map(
    periods.map(period => {
      const {from, to} = yearWindow(period);
      const said = new Set<string>();
      const found: CapitalAction[] = [];
      for (const action of capital) {
        const time = eventTime(action.date);
        if (time < from || time >= to) continue;
        const group = actionGroupOf(action.family);
        const ratio =
          action.value?.kind === 'ratio'
            ? {ratio1: action.value.ratio1, ratio2: action.value.ratio2}
            : undefined;
        const mention =
          ratio === undefined
            ? group
            : `${group} ${ratio.ratio1}:${ratio.ratio2}`;
        if (said.has(mention)) continue;
        said.add(mention);
        found.push(ratio === undefined ? {group} : {group, ratio});
      }
      return [period, found];
    }),
  );
}
