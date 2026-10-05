import type {Strategy} from '../../types/trade.ts';
import type {TradeData} from '../../types/user.ts';

export const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const UUID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const UUID_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
export const UUID_E = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

export const strategy = (
  o: Partial<Strategy> & {strategy_id: string},
): Strategy => ({
  user_id: 1,
  symbol: 'TCS',
  status: 'RUNNING',
  is_mock: false,
  created_at: '2026-06-30T12:00:00Z',
  shard_id: 0,
  market: 'IN',
  timeframe: '15m',
  execution_mode: 'LOOP',
  original_query: 'Buy when RSI < 30',
  target_scope: null,
  budget_config: {val: 100000, mode: 'AMOUNT'},
  fsm: {states: {}, variables: [], initial_state: 'IDLE'},
  is_parent: false,
  is_intraday: false,
  is_backtest: false,
  is_fno: false,
  ...o,
});

/**
 * An Athena script ("C") strategy as is-alive sends it (`athenaSummary`, backend
 * feat/athena-integration): no fsm, rules, take_profit, stop_loss, is_parent, shard_id or
 * target_scope, no indicators, and the engine's budget passed through - `val` the total capital,
 * `allocate` each position's share of it. Parsed off the wire, as the app gets it, because the
 * Strategy type still promises fields this row does not carry.
 */
export const athenaRow = (o: Record<string, unknown> = {}): Strategy =>
  JSON.parse(
    JSON.stringify({
      strategy_id: UUID_E,
      user_id: 1,
      is_mock: true,
      status: 'ACTIVE',
      market: 'IN',
      timeframe: '15m',
      execution_mode: 'LOOP',
      original_query: 'Buy the 20-day breakout, sell below the 10-day low',
      symbol: 'RELIANCE',
      budget_config: {val: 200000, type: 'AMOUNT', allocate: '25%'},
      created_at: '2026-07-07T12:00:00Z',
      indicators: [],
      strategy_hname: 'Breakout script',
      ...o,
    }),
  ) as Strategy;

/**
 * The least is-alive can send for a script row: the backend drops every empty or false field, and
 * a script with no symbols yet has no `symbol`.
 */
export const sparseRow = (o: Record<string, unknown> = {}): Strategy =>
  JSON.parse(
    JSON.stringify({
      strategy_id: UUID_E,
      is_mock: true,
      status: 'ACTIVE',
      budget_config: null,
      created_at: '2026-07-07T12:00:00Z',
      indicators: [],
      ...o,
    }),
  ) as Strategy;

export const trade = (
  o: Partial<TradeData> & {id: string; stock_symbol: string},
): TradeData => ({
  timestamp: '2026-06-30T12:00:00Z',
  quantity: 1,
  buy_price: null,
  sell_price: null,
  buy_time: null,
  sell_time: null,
  status: 'LIVE',
  user_id: '1',
  execution_strategy: null,
  ...o,
});
