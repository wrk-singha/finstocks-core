// Contract for /api/news/fundamentals/detail.
//
// Unlike GetFundamentalsResponse, whose every field is a rename of one vendor
// key, this carries the filing as filed: `items` is keyed by Accord's own
// spelling and holds every line the company reported. The label, the grouping
// and the disclosure tier live on the reading side, so a line nobody has
// written a label for still reaches the reader rather than being dropped in
// transit.
import type {OwnershipHolder} from './ownership.ts';

export type StatementBasis = 'S' | 'C';

export type FundamentalsSection =
  'statements' | 'quarterly' | 'ownership' | 'deliverables' | 'documents';

export interface GetFundamentalsDetailRequest {
  symbol: string;
  sections?: string;
  basis?: StatementBasis;
  periods?: number;
  limit?: number;
}

// Periods run newest-first. Each item array is index-aligned to `periods`, and
// null means the company did not file that line that period — which is not the
// same as filing a zero, and must not render as one.
export interface FundamentalsSeries {
  periods: number[];
  unit?: string;
  items: Record<string, (number | null)[]>;
}

export interface FundamentalsStatements {
  basis: StatementBasis;
  basis_available: StatementBasis[];
  profit_loss?: FundamentalsSeries;
  balance_sheet?: FundamentalsSeries;
  cash_flow?: FundamentalsSeries;
  ratios?: FundamentalsSeries;
  // The basis the cash flow was actually filed on. A group files only its
  // consolidated cash flow, so a standalone view comes back "C"; label the
  // section with this rather than with `basis`.
  cash_flow_basis?: StatementBasis;
}

export interface OwnershipCategory {
  code: string;
  pct?: (number | null)[];
  shares?: (number | null)[];
  holders?: (number | null)[];
  pledge_pct?: (number | null)[];
  pledge_shares?: (number | null)[];
}

export interface FundamentalsOwnership {
  quarters: number[];
  // Null on the wire when no category carried a measure; the fetcher fills it
  // so readers can iterate without a guard.
  categories: OwnershipCategory[];
  // The newest quarter's register, in the shape /news/ownership already serves.
  top_holders?: OwnershipHolder[];
  holders_as_of?: string;
}

export interface DeliverableRow {
  date: string;
  volume?: number | null;
  delv_volume?: number | null;
  delv_pct?: number | null;
}

// The vendor's statement layout. A bank files Interest Earned / Advances /
// Deposits where a manufacturer files Net Sales / Inventory, so this decides
// which schema renders the statements, not a guess from the sector name.
export interface StatementFormat {
  financials?: string;
  results?: string;
}

export interface ResultFiling {
  url: string;
  caption: string;
  date: string;
}

// The quarterly table on the basis actually served (the one asked for, else
// the one filed), with each quarter's results filing keyed by period.
export interface QuarterlyResults extends FundamentalsSeries {
  basis: StatementBasis;
  basis_available: StatementBasis[];
  filings?: Record<string, ResultFiling>;
}

// The kinds the backend classifies a filing into. Absent on the rest: only
// about a tenth of the feed is one of these, so a row without a category is
// the normal case rather than a gap.
export type DocumentCategory =
  | 'transcript'
  | 'presentation'
  | 'recording'
  | 'credit_rating'
  | 'annual_report';

// One filing in the announcements feed.
//
// `subtype` is the filer's own Reg 30 declaration — a clean label like
// "Analyst / Investor Meet - Intimation" — but only about a third of rows carry
// one, because it postdates the taxonomy. `caption` is always there and runs to
// 200-odd characters of statute-first prose, so it is the fallback, not the
// lead. `url` is absent on filings the exchange never attached a PDF to.
export interface DocumentFiling {
  date: string;
  caption: string;
  subtype?: string;
  category?: DocumentCategory;
  url?: string;
}

// `fiscal_year` is omitted rather than guessed when neither the caption nor the
// filing date supports one, so the row is titled by its date in that case.
export interface AnnualReport {
  date: string;
  fiscal_year?: number;
  caption: string;
  url?: string;
}

// Two thirds of rating filings name no agency in a form that can be read
// without guessing, so `agency` is a bonus on the row, never its subject.
export interface CreditRating {
  date: string;
  agency?: string;
  caption: string;
  url?: string;
}

// One quarter's earnings call, grouped by the month its material was filed —
// transcript and presentation land days apart and the month pairs them. Any of
// the three URLs may be missing; a group exists as long as one of them does.
export interface Concall {
  month: string;
  date: string;
  transcript_url?: string;
  presentation_url?: string;
  recording_url?: string;
}

// Every list is always present and empty rather than null, so readers iterate
// without a guard. The `documents` key itself is absent for a company with no
// scripcode, which is the endpoint's way of saying "nothing on file".
export interface FundamentalsDocuments {
  announcements: DocumentFiling[];
  annual_reports: AnnualReport[];
  credit_ratings: CreditRating[];
  concalls: Concall[];
}

export interface GetFundamentalsDetailResponse {
  symbol: string;
  fincode?: number;
  company_name: string;
  format: StatementFormat;
  sections: FundamentalsSection[];
  statements?: FundamentalsStatements;
  quarterly?: QuarterlyResults;
  ownership?: FundamentalsOwnership;
  deliverables?: DeliverableRow[];
  documents?: FundamentalsDocuments;
}
