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
