import {indicatorSections} from '../data/indicatorsConfig.ts';

/**
 * One rule-editor pick. `group` is the section it came from; the web renders it as the option's
 * tag and the mobile picker as its subtitle line (a tag there replaces the selected-dot).
 */
export interface IndicatorPickerOption {
  value: string;
  label: string;
  group: string;
}

/**
 * FSM runtime context variables. Not columns in in_technicals - the strategy
 * engine sets these via UPDATE_CONTEXT actions, so they resolve per-position
 * rather than per-bar. Exit rules are written against them constantly
 * ("$entry_price * 1.05"), so they belong in the picker despite not being data.
 */
const CONTEXT_VARS: IndicatorPickerOption[] = [
  {value: '$entry_price', label: 'Entry price', group: 'Position context'},
  {value: '$target_profit', label: 'Target profit', group: 'Position context'},
  {value: '$stop_loss', label: 'Stop loss', group: 'Position context'},
];

/** Fundamental fields come from in_fundamentals (not in_technicals), so they are declared here. */
const FUNDAMENTAL_OPTIONS: IndicatorPickerOption[] = [
  {value: 'pe_ttm', label: 'PE Ratio', group: 'Valuation'},
  {value: 'pb_mrq', label: 'PB Ratio', group: 'Valuation'},
  {value: 'ev_ebitda', label: 'EV/EBITDA', group: 'Valuation'},
  {
    value: 'price_to_cash_flow',
    label: 'Price to Cash Flow',
    group: 'Valuation',
  },
  {value: 'market_cap', label: 'Market Cap (₹Cr)', group: 'Valuation'},
  {value: 'roe', label: 'ROE', group: 'Profitability'},
  {value: 'roa', label: 'ROA', group: 'Profitability'},
  {value: 'roce', label: 'ROCE', group: 'Profitability'},
  {value: 'net_margin', label: 'Net Profit Margin', group: 'Profitability'},
  {
    value: 'operating_margin',
    label: 'Operating Margin',
    group: 'Profitability',
  },
  {value: 'eps_growth', label: 'EPS Growth', group: 'Growth'},
  {value: 'revenue_growth', label: 'Revenue Growth', group: 'Growth'},
  {value: 'eps_basic', label: 'EPS', group: 'Per Share'},
  {value: 'bvps', label: 'Book Value / Share', group: 'Per Share'},
  {value: 'revenue_per_share', label: 'Revenue / Share', group: 'Per Share'},
  {value: 'debt_equity', label: 'Debt / Equity', group: 'Leverage'},
  {value: 'current_ratio', label: 'Current Ratio', group: 'Leverage'},
  {value: 'asset_turnover', label: 'Asset Turnover', group: 'Leverage'},
  {value: 'inventory_turnover', label: 'Inventory Turnover', group: 'Leverage'},
  {
    value: 'dividend_yield',
    label: 'Dividend Yield',
    group: 'Dividends & Holdings',
  },
  {value: 'payout_ratio', label: 'Payout Ratio', group: 'Dividends & Holdings'},
  {value: 'promoter', label: 'Promoter Holding', group: 'Dividends & Holdings'},
  {value: 'fii', label: 'FII Holding', group: 'Dividends & Holdings'},
  {value: 'mf', label: 'MF Holding', group: 'Dividends & Holdings'},
];

/**
 * Every indicator a strategy rule can reference, derived from the same indicatorSections the
 * stock-detail panel renders. That config is kept 1:1 with the producer
 * (refresher/database/column_defs.py) and the SQL allowlist, so deriving here means a
 * newly-computed column shows up in the rule editor without a second list to update - and a
 * column that was never computed can't be picked. The same join screenerIndicators does for the
 * screener.
 *
 * drift resolved 2026-09-13: web won - it appends the in_fundamentals fields, which the mobile
 * picker had not yet grown; the UI DropdownOption (`tag` on web, `description` on mobile) became
 * the plain `group` the apps map.
 */
export const STRATEGY_INDICATOR_OPTIONS: IndicatorPickerOption[] = [
  ...CONTEXT_VARS,
  ...indicatorSections.flatMap(section =>
    section.fields.map(field => ({
      value: field.key,
      label: field.label,
      group: section.title,
    })),
  ),
  ...FUNDAMENTAL_OPTIONS,
];
