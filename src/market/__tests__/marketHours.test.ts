import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  addMarketDays,
  isMarketOpen,
  isTradingDay,
  lastSessionOpen,
  MARKET_TIMEZONE,
  marketDateString,
  marketDaysUntil,
  marketMinutesNow,
  marketToday,
  nextTradingDay,
  SESSION_CLOSE,
  SESSION_OPEN,
} from '../marketHours.ts';

// 2026-09-11 is a Friday; 2026-09-14 (Monday) is an exchange holiday.
const fridayOpen = new Date('2026-09-11T05:00:00Z'); // 10:30 IST
const fridayEvening = new Date('2026-09-11T11:00:00Z'); // 16:30 IST
const fridayPreOpen = new Date('2026-09-11T03:00:00Z'); // 08:30 IST
const saturday = new Date('2026-09-12T05:00:00Z');

test('session bounds and the market clock are in IST minutes', () => {
  assert.equal(MARKET_TIMEZONE, 'Asia/Kolkata');
  assert.equal(SESSION_OPEN, 555);
  assert.equal(SESSION_CLOSE, 930);
  assert.equal(marketMinutesNow(fridayOpen), 630);
  // 23:30 UTC is 05:00 IST the next day: the date rolls, the hour reads 5.
  assert.equal(marketMinutesNow(new Date('2026-09-11T23:30:00Z')), 300);
  assert.equal(
    marketDateString(marketToday(new Date('2026-09-11T23:30:00Z'))),
    '2026-09-12',
  );
});

test('market days are UTC-midnight dates that shift without drifting', () => {
  const today = marketToday(fridayOpen);
  assert.equal(today.toISOString(), '2026-09-11T00:00:00.000Z');
  assert.equal(marketDateString(addMarketDays(today, 3)), '2026-09-14');
  assert.equal(marketDaysUntil('2026-09-16', fridayOpen), 5);
  assert.equal(marketDaysUntil('2026-09-01', fridayOpen), -10);
  assert.equal(marketDaysUntil('nope', fridayOpen), null);
});

test('trading days exclude weekends and the holiday table', () => {
  assert.equal(isTradingDay(new Date('2026-09-11T00:00:00Z')), true);
  assert.equal(isTradingDay(new Date('2026-09-12T00:00:00Z')), false);
  assert.equal(isTradingDay(new Date('2026-09-14T00:00:00Z')), false);
  assert.equal(isTradingDay(new Date('2026-09-14T00:00:00Z'), 'XX'), true);
});

test('the market is open only inside the session on a trading day', () => {
  assert.equal(isMarketOpen('IN', fridayOpen), true);
  assert.equal(isMarketOpen('IN', fridayEvening), false);
  assert.equal(isMarketOpen('IN', fridayPreOpen), false);
  assert.equal(isMarketOpen('IN', saturday), false);
  assert.equal(isMarketOpen('IN', new Date('2026-09-14T05:00:00Z')), false);
});

test('the last session open walks back over pre-open, weekends and holidays', () => {
  assert.equal(
    lastSessionOpen('IN', fridayOpen).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', fridayPreOpen).toISOString(),
    '2026-09-10T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', saturday).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
  assert.equal(
    lastSessionOpen('IN', new Date('2026-09-14T05:00:00Z')).toISOString(),
    '2026-09-11T03:45:00.000Z',
  );
});

test('the next trading day counts today only while its session is ahead', () => {
  assert.equal(nextTradingDay('IN', fridayOpen), '2026-09-11');
  assert.equal(nextTradingDay('IN', fridayEvening), '2026-09-15');
  assert.equal(nextTradingDay('IN', saturday), '2026-09-15');
});
