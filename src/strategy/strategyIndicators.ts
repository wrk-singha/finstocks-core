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
 *
 * drift resolved 2026-09-19: web won again. `$target_profit` and `$stop_loss` are gone and seven
 * others take their place - the engine sets an opening range, a pullback low, a trailing stop and a
 * trade count, and none of them could be picked. Web dropped the two in `87fa20b9` (2026-09-13) and
 * the old app followed in `9488c13` three days later, so both clients agree and core was the last
 * holdout. Nothing outside core referenced either name. The cost is bounded and real: a saved rule
 * written against `$target_profit` still runs, but `valueHint` no longer has a label for it, so it
 * reads back as the raw expression rather than a phrase.
 */
const CONTEXT_VARS: IndicatorPickerOption[] = [
  {value: '$entry_price', label: 'Entry price', group: 'Position context'},
  {value: '$entry_time', label: 'Entry time', group: 'Position context'},
  {value: '$trailing_stop', label: 'Trailing stop', group: 'Position context'},
  {value: '$pullback_low', label: 'Pullback low', group: 'Position context'},
  {
    value: '$opening_range_high',
    label: 'Opening range high',
    group: 'Position context',
  },
  {
    value: '$opening_range_low',
    label: 'Opening range low',
    group: 'Position context',
  },
  {
    value: '$candle_size',
    label: 'Opening range size',
    group: 'Position context',
  },
  {value: '$trade_count', label: 'Trades today', group: 'Position context'},
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
 * Groups worth opening on. Web's picker fits about nine of its collapsed group headers and the
 * phone's list a handful of rows, so ordering decides what a reader finds without scrolling; the
 * rest follow in their source order.
 */
const LEAD_SECTIONS: readonly string[] = [
  'Momentum Indicators',
  'Price & Moving Averages',
  'OHLCV Data',
  'Volume & Stochastic',
  'Volatility & Trend',
];

const sectionRank = (group: string): number => {
  const lead = LEAD_SECTIONS.indexOf(group);
  return lead === -1 ? LEAD_SECTIONS.length : lead;
};

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
 *
 * Ordered by LEAD_SECTIONS since web de4023e9 (2026-09-18); the list used to open on the eight
 * position-context variables.
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
].sort((a, b) => sectionRank(a.group) - sectionRank(b.group));
