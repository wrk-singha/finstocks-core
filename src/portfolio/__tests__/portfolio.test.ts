import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  calculateHoldTime,
  calculatePNL,
  deriveHoldingSymbols,
  extractStrategyId,
  filterTradesForMode,
  formatDateString,
  formatTradeTime,
  getExecutionStrategyDisplay,
  getExecutionStrategyName,
  getLogBadgeColor,
  getPnlBasisLabel,
  getStrategyNumber,
  getTradeEntryPrice,
  getTradePremium,
  getTradeQuantityDisplay,
  intradayStrategyIdSet,
  isFnOStrategy,
  isHoldingTrade,
  isManualTrade,
  isPositionTrade,
  isSameDayBuy,
  isShortPosition,
  matchesSegment,
  matchesTradeMode,
} from '../portfolio.ts';
import {formatAllocation, formatMarketCap} from '../../format/number.ts';
import {isFnOSymbol} from '../../market/symbols.ts';
import {trade} from './fixtures.ts';

const STRAT_ID = '0f2a1c3e-9b8d-4e7f-a6b5-c4d3e2f1a0b9';

test('getTradePremium reads every spelling the backend has used and caches by string', () => {
  const payload = JSON.stringify({
    buy_premium: 54,
    sell_premium: 60,
    trigger_price: 50,
  });
  const first = getTradePremium(payload);
  assert.deepEqual(first, {buyPremium: 54, sellPremium: 60, triggerPrice: 50});
  assert.equal(getTradePremium(payload), first);

  assert.equal(
    getTradePremium(JSON.stringify({buyPremium: 12})).buyPremium,
    12,
  );
  assert.equal(getTradePremium(JSON.stringify({premium: 7})).buyPremium, 7);
  assert.equal(
    getTradePremium(JSON.stringify({trigger_price: 0})).triggerPrice,
    null,
  );
  assert.deepEqual(getTradePremium('not json'), {
    buyPremium: null,
    sellPremium: null,
    triggerPrice: null,
  });
  assert.equal(getTradePremium(undefined).buyPremium, null);
});

test('isShortPosition reads either flag and survives bad JSON', () => {
  assert.equal(isShortPosition(JSON.stringify({is_short: true})), true);
  assert.equal(
    isShortPosition(JSON.stringify({transaction_type: 'SELL'})),
    true,
  );
  assert.equal(
    isShortPosition(JSON.stringify({transaction_type: 'BUY'})),
    false,
  );
  assert.equal(isShortPosition('{'), false);
  assert.equal(isShortPosition(null), false);
});

test('isFnOSymbol anchors on the contract suffix so an ETF never files as F&O', () => {
  assert.equal(isFnOSymbol('NIFTY'), true);
  assert.equal(isFnOSymbol('NIFTY 50'), true);
  assert.equal(isFnOSymbol('RELIANCE24JULFUT'), true);
  assert.equal(isFnOSymbol('NIFTY2681824400PE'), true);
  assert.equal(isFnOSymbol('banknifty24jul50000ce'), true);
  assert.equal(isFnOSymbol('BSE500IETF'), false);
  assert.equal(isFnOSymbol('RELIANCE'), false);
  assert.equal(isFnOSymbol(undefined), false);
  assert.equal(isFnOSymbol(null), false);
});

test('getTradeEntryPrice recognises an index-scale buy_price on an F&O leg', () => {
  assert.equal(
    getTradeEntryPrice({buy_price: 24132, stock_symbol: 'RELIANCE'}),
    24132,
  );
  assert.equal(
    getTradeEntryPrice({
      buy_price: 24132,
      stock_symbol: 'NIFTY2681824400PE',
      execution_payload: JSON.stringify({buy_premium: 54}),
    }),
    54,
  );
  assert.equal(
    getTradeEntryPrice({
      buy_price: 24132,
      stock_symbol: 'NIFTY2681824400PE',
      execution_payload: JSON.stringify({trigger_price: 52}),
    }),
    52,
  );
  assert.equal(
    getTradeEntryPrice(
      {buy_price: 24132, stock_symbol: 'NIFTY2681824400PE'},
      60,
    ),
    60,
  );
  assert.equal(
    getTradeEntryPrice({buy_price: 55, stock_symbol: 'NIFTY2681824400PE'}, 60),
    55,
  );
  assert.equal(getTradeEntryPrice({buy_price: null}), 0);
});

test('calculatePNL is premium-aware, short-aware, and null when it cannot know', () => {
  assert.equal(calculatePNL(trade({sell_price: 110})), 100);
  assert.equal(calculatePNL(trade()), null);
  assert.equal(calculatePNL(trade(), 90), -100);
  assert.equal(calculatePNL(trade({buy_price: 0, sell_price: 10})), null);
  assert.equal(
    calculatePNL(
      trade({
        sell_price: 90,
        execution_payload: JSON.stringify({transaction_type: 'SELL'}),
      }),
    ),
    100,
  );
  // Sell premium is the yardstick that exposes an index-scale buy_price.
  assert.equal(
    calculatePNL(
      trade({
        stock_symbol: 'NIFTY2681824400PE',
        buy_price: 24132,
        quantity: 50,
        execution_payload: JSON.stringify({
          trigger_price: 50,
          sell_premium: 60,
        }),
      }),
    ),
    500,
  );
});

test('segment and mode predicates', () => {
  assert.equal(matchesSegment('fno', true), true);
  assert.equal(matchesSegment('equity', true), false);
  assert.equal(isFnOStrategy({is_fno: true, symbol: 'RELIANCE'}), true);
  assert.equal(isFnOStrategy({symbol: 'RELIANCE24JULFUT'}), true);
  assert.equal(isFnOStrategy({symbol: 'RELIANCE'}), false);
  assert.equal(matchesTradeMode({status: 'SIMULATION'}, true), true);
  assert.equal(matchesTradeMode({status: 'LIVE'}, true), false);
  assert.equal(matchesTradeMode({}, false), true);
  assert.equal(matchesTradeMode({}, true), false);
  assert.deepEqual(
    filterTradesForMode(
      [
        trade({id: 'a', status: 'LIVE'}),
        trade({id: 'b', status: 'SIMULATION'}),
      ],
      true,
    ).map(t => t.id),
    ['b'],
  );
});

test('intradayStrategyIdSet accepts the bare array or the {strategies} envelope', () => {
  const strategies = [
    {strategy_id: 'x', is_intraday: true},
    {strategy_id: 7, is_intraday: false},
    {strategy_id: 'y', is_intraday: true},
  ];
  assert.deepEqual([...intradayStrategyIdSet(strategies)], ['x', 'y']);
  assert.deepEqual([...intradayStrategyIdSet({strategies})], ['x', 'y']);
  assert.deepEqual([...intradayStrategyIdSet(undefined)], []);
  assert.deepEqual([...intradayStrategyIdSet({strategies: null})], []);
});

test('positions vs holdings: F&O, T1 and intraday-strategy trades are positions', () => {
  const intraday = new Set([STRAT_ID]);
  const today = new Date().toISOString();

  assert.equal(isSameDayBuy(today), true);
  assert.equal(isSameDayBuy('2020-01-01T04:00:00Z'), false);
  assert.equal(isSameDayBuy('garbage'), false);

  assert.equal(
    isPositionTrade(trade({stock_symbol: 'NIFTY24JULFUT'}), intraday),
    true,
  );
  assert.equal(isPositionTrade(trade({buy_time: today}), intraday), true);
  assert.equal(
    isPositionTrade(trade({execution_strategy: `STRAT${STRAT_ID}`}), intraday),
    true,
  );
  assert.equal(isPositionTrade(trade(), intraday), false);

  assert.equal(isHoldingTrade(trade(), intraday), true);
  assert.equal(isHoldingTrade(trade({buy_time: today}), intraday), false);
  // A squared-off intraday trade stays a holding: its realised P&L is history.
  assert.equal(
    isHoldingTrade(trade({buy_time: today, sell_time: today}), intraday),
    true,
  );
});

test('deriveHoldingSymbols dedupes through the injected price-symbol mapper', () => {
  const symbols = deriveHoldingSymbols(
    [
      trade({stock_symbol: 'RELIANCE-EQ'}),
      trade({stock_symbol: 'RELIANCE'}),
      trade({stock_symbol: 'NIFTY24JULFUT'}),
    ],
    new Set(),
    s => s.replace(/-EQ$/, ''),
  );
  assert.deepEqual(symbols, ['RELIANCE']);
});

test('getTradeQuantityDisplay pluralises shares and calls contracts quantities', () => {
  assert.deepEqual(getTradeQuantityDisplay({quantity: 1}), {
    value: 1,
    label: 'share',
  });
  assert.deepEqual(getTradeQuantityDisplay({quantity: 3}), {
    value: 3,
    label: 'shares',
  });
  assert.deepEqual(
    getTradeQuantityDisplay({quantity: 50, stock_symbol: 'NIFTY24JULFUT'}),
    {value: 50, label: 'quantities'},
  );
  assert.equal(getPnlBasisLabel(true), 'Realised');
});

test('formatTradeTime prints the IST leg time, midnight included', () => {
  assert.equal(formatTradeTime('2026-08-31T04:30:00Z'), 'Aug 31 10:00 AM');
  assert.equal(formatTradeTime('2026-08-05T18:30:00Z'), 'Aug 06 12:00 AM');
  assert.equal(formatTradeTime('2026-08-31 04:30:00+00'), 'Aug 31 10:00 AM');
  assert.equal(formatTradeTime(null), 'N/A');
  assert.equal(formatTradeTime('garbage'), 'N/A');
});

test('formatDateString is the local YYYY-MM-DD key', () => {
  assert.equal(formatDateString(new Date(2026, 0, 5)), '2026-01-05');
});

test('calculateHoldTime picks the coarsest unit that is non-zero', () => {
  const start = '2026-08-01T00:00:00Z';
  assert.equal(calculateHoldTime(start, '2026-08-03T05:00:00Z'), '2d 5h');
  assert.equal(calculateHoldTime(start, '2026-08-01T03:15:00Z'), '3hr 15min');
  assert.equal(calculateHoldTime(start, '2026-08-01T00:07:00Z'), '7min');
  assert.equal(calculateHoldTime(null), 'N/A');
});

test('execution_strategy decoding', () => {
  const tagged = `IN_STRAT${STRAT_ID}_x`;
  assert.equal(extractStrategyId(tagged), STRAT_ID);
  assert.equal(extractStrategyId('IN_MANUAL'), null);
  assert.equal(getExecutionStrategyName(tagged), `${STRAT_ID.slice(0, 8)}...`);
  assert.equal(
    getExecutionStrategyName('swing model long term hold'),
    'Argus Autopilot',
  );
  assert.equal(getExecutionStrategyName('IN_MANUAL_2'), 'Manual Trade');
  assert.equal(getExecutionStrategyName(null), 'N/A');
  assert.equal(isManualTrade('IN_SYNC'), true);
  assert.equal(isManualTrade('swing model'), false);
  assert.equal(getExecutionStrategyDisplay(null), 'MANUAL');
  assert.equal(getExecutionStrategyDisplay(tagged), 'STRATEGY');
  assert.equal(getExecutionStrategyDisplay('IN_MANUAL'), 'MANUAL');
  assert.equal(getExecutionStrategyDisplay('swing model'), 'AUTOPILOT');
});

test('getStrategyNumber is stable across duplicates and order', () => {
  assert.equal(getStrategyNumber('b', ['c', 'b', 'a', 'b']), 2);
  assert.equal(getStrategyNumber('zzz', ['a']), 0);
});

test('getLogBadgeColor maps levels onto the injected palette', () => {
  const colors = {
    status: {error: '#e00', warning: '#fa0', success: '#0a0'},
    brand: {primary: '#00f'},
  };
  assert.deepEqual(getLogBadgeColor('sell', colors), {
    bg: '#e0020',
    text: '#e00',
  });
  assert.deepEqual(getLogBadgeColor('BUY', colors), {
    bg: '#0a020',
    text: '#0a0',
  });
  assert.deepEqual(getLogBadgeColor('info', colors), {
    bg: '#00f20',
    text: '#00f',
  });
});

test('formatAllocation and formatMarketCap', () => {
  assert.equal(formatAllocation(10, 'QTY'), '10 qty');
  assert.equal(formatAllocation(100000, 'AMOUNT'), '₹1,00,000');
  assert.equal(formatAllocation(null), '₹0');
  assert.equal(formatMarketCap(1.5e12), '₹1.50T');
  assert.equal(formatMarketCap(2.25e9), '₹2.25B');
  assert.equal(formatMarketCap(3e6), '₹3.00M');
  assert.equal(formatMarketCap(999), '₹999.00');
});
