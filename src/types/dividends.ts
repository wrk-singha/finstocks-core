export interface GetDividendsParams {
  market: 'IN';
  /** One stock's dividends, history included, rather than the market's feed. */
  symbol?: string;
  /** Only dividends whose ex-date has not passed. */
  upcoming?: boolean;
}

/**
 * One dividend as both backends send it: main's `dividendEventsQuery`
 * (`internal/repository/news/queries.go`) and dev's Doom `DividendEvent`
 * (`marketdata/dividends.go`). Neither sends an `id`, `fetched_at` or `created_at`; key a row with
 * `dividendKey`.
 */
export interface GetDividendsResponse {
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
}
