import type {TradeData} from '../../types/user.ts';

let seq = 0;

export const trade = (overrides: Partial<TradeData> = {}): TradeData => ({
  id: `t${++seq}`,
  timestamp: '2026-08-03T04:00:00Z',
  stock_symbol: 'RELIANCE',
  quantity: 10,
  buy_price: 100,
  sell_price: null,
  buy_time: '2026-08-03T04:00:00Z',
  sell_time: null,
  status: 'LIVE',
  user_id: 'u1',
  execution_strategy: null,
  ...overrides,
});

export const HOUR = 3_600_000;
export const DAY = 86_400_000;
