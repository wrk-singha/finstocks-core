export type StockEventCategory =
  | 'dividend'
  | 'bonus'
  | 'split'
  | 'reverse_split'
  | 'rights'
  | 'merger'
  | 'demerger'
  | 'results'
  | 'agm'
  | 'book_closure'
  | 'announcement'
  | 'acquisition'
  | 'name_change'
  | 'delisting';

export type CapBand = 'large' | 'mid' | 'small';

export interface StockEvent {
  symbol: string;
  company_name: string;
  category: StockEventCategory;
  label: string;
  event_date: string | null;
  dividend_type?: string;
  detail: string;
  amount?: number;
  ratio1?: number;
  ratio2?: number;
  cap_band: CapBand;
}

export interface GetStockEventsResponse {
  events: StockEvent[];
  counts: Partial<Record<StockEventCategory, number>>;
  cap_counts: Partial<Record<CapBand, number>>;
  from: string;
  to: string;
}

export interface GetStockEventsRequest {
  from?: string;
  to?: string;
  category?: StockEventCategory[];
  cap?: CapBand[];
  symbol?: string[];
}

/**
 * The corporate action a row is about, whatever wording it arrived in. `esop`
 * and `preferential` come only from exchange filings; the vendor's corporate
 * events feed never carries them.
 */
export type ActionFamily =
  | 'dividend'
  | 'bonus'
  | 'split'
  | 'rights'
  | 'buyback'
  | 'esop'
  | 'preferential'
  | 'merger'
  | 'demerger'
  | 'results'
  | 'agm'
  | 'book_closure'
  | 'other';

/** An exchange filing about a capital action, tagged by the backend. */
export interface CorporateFiling {
  news_id: string;
  datetime: string | null;
  caption: string;
  details: string;
  attachment_url: string;
  category: Extract<
    ActionFamily,
    'buyback' | 'esop' | 'preferential' | 'merger'
  >;
}

/** The step of an action a feed dates its row by. */
export type ActionStage = 'exDate' | 'recordDate' | 'paymentDate' | 'announced';

/**
 * The short phrase under a row's title, as a key the app words: the stage the
 * row is dated by where its feed names one, the events feed's own category
 * where it has a phrase of its own, else the row's family.
 */
export type ActionSubtitle =
  ActionStage | ActionFamily | 'acquisition' | 'name_change' | 'delisting';

/** A row's figure as filed: the app formats the money and words the note. */
export type ActionValue =
  | {kind: 'perShare'; amount: number}
  | {kind: 'ratio'; ratio1: number; ratio2: number}
  | {kind: 'offerPrice'; amount: number};

/**
 * One dated corporate action, as data rather than copy: the feed's own words
 * where it had any, and keys for everything the app words itself.
 */
export interface CorporateActionEntry {
  key: string;
  /** The date the row is filed under, as its feed sent it. */
  date: string;
  family: ActionFamily;
  /** The feed's own wording; null when it had none, so the family names the row. */
  title: string | null;
  subtitle: ActionSubtitle;
  /** The long prose, a filing's own wording. */
  detail?: string;
  value?: ActionValue;
  /** The document behind the row, when its feed links one. */
  href?: string;
  /** Set when the list spans several stocks, so each row names its own. */
  symbol?: string;
}

/** How an exchange filing declares itself: a board outcome, an intimation, a compliance filing. */
export type FilingKind = 'outcome' | 'intimation' | 'compliance' | 'filing';

/** One exchange filing in a stock's archive, as data rather than copy. */
export interface ExchangeFilingEntry {
  key: string;
  /** When it was filed, as the feed sent it. */
  date: string;
  /** The filing's subject; null when neither its caption nor its type names one. */
  title: string | null;
  kind: FilingKind;
  /** The filing's own wording, only when it says more than the title. */
  detail?: string;
  href?: string;
}
