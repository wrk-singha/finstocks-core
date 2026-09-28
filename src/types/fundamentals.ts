export interface GetFundamentalsRequest {
  symbols: string[];
  market: 'IN';
  /** "summary" drops the per-period arrays for peer comparison lookups. */
  fields?: 'summary';
}

// The in_fundamentals metric groups arrive as nested JSON objects. Every field
// is optional/nullable — the refresher can leave any group NULL.

export interface FundamentalsMarketSnapshot {
  market_cap?: number | null;
  price?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  face_value?: number | null;
  ev?: number | null;
  latest_equity?: number | null;
  latest_reserve?: number | null;
  no_shares_subscribed?: number | null;
}

export interface FundamentalsValuation {
  pe_ttm?: number | null;
  pe_mry?: number | null;
  pe_normalized?: number | null;
  adj_pe?: number | null;
  pb_mrq?: number | null;
  pb_mry?: number | null;
  ev_ebitda?: number | null;
  ev_sales?: number | null;
  price_to_sales?: number | null;
  price_to_fcf?: number | null;
  mcap_sales?: number | null;
  dividend_yield?: number | null;
  net_debt?: number | null;
  eps_ttm?: number | null;
  ceps_ttm?: number | null;
  price_to_ceps?: number | null;
}

export interface FundamentalsProfitability {
  roe?: number | null;
  roa?: number | null;
  roce?: number | null;
  roic?: number | null;
  net_margin?: number | null;
  pat_margin?: number | null;
  operating_margin?: number | null;
  ebit_margin?: number | null;
  gross_margin?: number | null;
  tax_rate?: number | null;
}

export interface FundamentalsPerShare {
  eps_basic?: number | null;
  reported_eps?: number | null;
  adj_eps?: number | null;
  bvps?: number | null;
  book_nav_share?: number | null;
  dps?: number | null;
  ceps?: number | null;
  cfps?: number | null;
  revenue_per_share?: number | null;
}

export interface FundamentalsLeverage {
  debt_equity?: number | null;
  debt_ta?: number | null;
  current_ratio?: number | null;
  quick_ratio?: number | null;
  interest_cover?: number | null;
  payout_ratio?: number | null;
}

export interface FundamentalsShareholding {
  promoter?: number | null;
  fii?: number | null;
  dii?: number | null;
  mf?: number | null;
  insurance?: number | null;
  public_individual?: number | null;
  other?: number | null;
  promoter_pledge_pct?: number | null;
}

export interface FundamentalsIncomeStatement {
  unit?: string | null;
  net_sales?: number | null;
  gross_sales?: number | null;
  total_income?: number | null;
  ebitda?: number | null;
  operating_profit?: number | null;
  profit_after_tax?: number | null;
  profit_before_tax?: number | null;
  reported_eps?: number | null;
  adj_eps?: number | null;
  interest?: number | null;
  depreciation?: number | null;
  taxation?: number | null;
}

export interface FundamentalsDividendMetrics {
  dps?: number | null;
  yield_ltm?: number | null;
  payout_ratio?: number | null;
}

// Some vendor rows report the current role as a rich object instead of a
// plain string — only `Value` (the human-readable title) is worth showing.
export interface FundamentalsDirectorDesignation {
  Value?: string | null;
}

export interface FundamentalsDirector {
  name?: string | null;
  designation?: string | FundamentalsDirectorDesignation | null;
  independent?: string | null;
}

export interface FundamentalsPeer {
  symbol?: string | null;
  company_name?: string | null;
}

// Groups consumed only as raw pass-through (charts/tables render them dynamically).
export type MetricBag = Record<string, number | string | null>;

// One reporting period, already scaled to crore by the API. `period_end` is the
// vendor's YYYYMM.
export interface FinancialPeriodRow {
  period_end: number;
  consolidated: boolean;
  metrics: Record<string, number>;
}

/**
 * One dated corporate action from the vendor's history. Most rows carry only
 * a date and an action name — `ex_date`, `amount` and the ratio pair are the
 * exception (7, 5 and 7 of 50 on ADANIENT), so every consumer must treat them
 * as optional rather than assuming a dividend-shaped row.
 */
export interface FundamentalsCorporateAction {
  corpact_id?: number | null;
  corp_action?: string | null;
  sdate?: string | null;
  ex_date?: string | null;
  record_date?: string | null;
  ef_from_date?: string | null;
  amount?: number | null;
  ratio1?: number | null;
  ratio2?: number | null;
  offer_price?: number | null;
  dividend_type?: string | null;
  subject?: string | null;
  caption?: string | null;
}

export interface GetFundamentalsResponse {
  stock_symbol: string;
  is_fno?: boolean;
  company_name?: string | null;
  industry?: string | null;
  sector?: string | null;
  house?: string | null;
  isin_id?: string | null;
  exchange_code_nse?: string | null;
  website?: string | null;
  company_description?: string | null;
  /** Year of incorporation, as filed — a four-digit string, not a number. */
  inc_year?: string | null;
  year_end?: number | null;
  created_at?: string | null;
  updated_at?: string | null;

  market_snapshot?: FundamentalsMarketSnapshot | null;
  valuation?: FundamentalsValuation | null;
  profitability?: FundamentalsProfitability | null;
  per_share?: FundamentalsPerShare | null;
  growth?: MetricBag | null;
  leverage?: FundamentalsLeverage | null;
  efficiency?: MetricBag | null;
  income_statement?: FundamentalsIncomeStatement | null;
  balance_sheet?: MetricBag | null;
  cash_flow?: MetricBag | null;
  quarterly?: MetricBag | null;
  shareholding?: FundamentalsShareholding | null;
  dividend_metrics?: FundamentalsDividendMetrics | null;
  corporate_actions?: MetricBag | null;
  banking?: MetricBag | null;
  dupont?: MetricBag | null;
  directors?: FundamentalsDirector[] | null;
  peers?: FundamentalsPeer[] | null;
  index_membership?: string[] | null;

  annual_periods?: FinancialPeriodRow[] | null;
  quarterly_periods?: FinancialPeriodRow[] | null;

  // drift resolved 2026-09-13: the mobile typed this `unknown`; the web's row shape is the contract.
  corporate_actions_history?: FundamentalsCorporateAction[] | null;

  // Raw history groups the mobile drawer passes through untyped.
  balance_sheet_history?: unknown;
  profit_loss_history?: unknown;
  cash_flow_history?: unknown;
  quarterly_history?: unknown;
  ratios_history?: unknown;
  insider_trading?: unknown;
}
