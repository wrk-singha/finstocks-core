import assert from 'node:assert/strict';
import {test} from 'node:test';

import {holidaysFor} from '../data/holidayTable.ts';
import {normCdf} from '../market/greeks.ts';
import {isMarketOpen} from '../market/marketHours.ts';

// Each module is published under its own subpath as well as through its folder's index, so a web
// build can import one module without the index's other modules becoming reachable from it (Rollup
// places a module by what can reach it, and an index reaches all of its folder). Both ways must be
// the same module: one holiday table, not two.
test('a module imported by its own subpath is the module the folder index exports', async () => {
  const greeks = await import('@finstocks/core/market/greeks');
  const hours = await import('@finstocks/core/market/marketHours');
  const table = await import('@finstocks/core/data/holidayTable');
  const market = await import('@finstocks/core/market');
  assert.equal(greeks.normCdf, normCdf);
  assert.equal(hours.isMarketOpen, isMarketOpen);
  assert.equal(table.holidaysFor, holidaysFor);
  assert.equal(market.normCdf, normCdf);
  assert.equal(market.holidaysFor, holidaysFor);
});
