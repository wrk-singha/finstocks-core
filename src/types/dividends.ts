export interface GetDividendsParams {
  market: 'IN';
}

export interface GetDividendsResponse {
  id: number;
  stock_symbol: string;
  stock_name: string | null;
  dividend_type: string | null;
  dividend_amount: number | null;
  dividend_percentage: number | null;
  record_date: string | null;
  ex_date: string | null;
  payment_date: string | null;
  announcement_date: string | null;
  announcement_title: string | null;
  announcement_link: string | null;
  announcement_summary: string | null;
  fetched_at: string;
  created_at: string;
}
