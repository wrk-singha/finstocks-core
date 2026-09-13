import type {Strategy} from '../../types/trade.ts';
import type {TradeData} from '../../types/user.ts';

export const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const UUID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const UUID_D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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
