export type RelatedPartySource = 'exchange_rpt' | 'annual_report';

export interface RelatedPartySourceRef {
  period_end: number;
  months: number;
  source: RelatedPartySource;
  url: string;
}

/** One fiscal year, or a lone half-year when the other half is unfiled. */
export interface RelatedPartyColumn {
  key: string;
  label: string;
  /** YYYYMM of the period's last month. */
  period_end: number;
  months: 6 | 12;
  source: RelatedPartySource;
  /** Read from an annual report by a model rather than filed as data. */
  experimental: boolean;
  /** Only one half of the fiscal year was disclosed. */
  partial: boolean;
  sources: RelatedPartySourceRef[];
}

export interface RelatedPartyTxnRow {
  type: string;
  /** ₹ crore, aligned to `columns`; null where nothing was disclosed. */
  values: (number | null)[];
}

export interface RelatedPartyRow {
  name: string;
  relationship: string;
  /** Sum of absolute amounts across every column; the sort key. */
  total: number;
  values: (number | null)[];
  txns: RelatedPartyTxnRow[];
}

export interface RelatedPartyResponse {
  symbol: string;
  company_name: string;
  fincode: number;
  basis: 'C' | 'S' | 'mixed';
  columns: RelatedPartyColumn[];
  parties: RelatedPartyRow[];
  experimental: boolean;
}
