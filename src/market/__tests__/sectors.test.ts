import assert from 'node:assert/strict';
import {test} from 'node:test';

import {mapSector, SECTOR_CHIPS} from '../sectors.ts';

test('fine-grained data sectors map to the seven coarse chips', () => {
  assert.equal(SECTOR_CHIPS.length, 7);
  assert.equal(mapSector('Software & Programming'), 'IT');
  assert.equal(mapSector('Oil & Gas Refining'), 'Energy');
  assert.equal(mapSector('Private Sector Bank'), 'Financials');
  assert.equal(mapSector('Auto Ancillaries'), 'Auto');
  assert.equal(mapSector('Pharmaceuticals'), 'Healthcare');
  assert.equal(mapSector('Consumer Food'), 'FMCG');
  assert.equal(mapSector('Cement & Construction'), 'Infrastructure');
  assert.equal(mapSector('Media & Entertainment'), null);
  assert.equal(mapSector(null), null);
});

test('the first matching bucket wins when keywords overlap', () => {
  assert.equal(mapSector('Power Generation Equipment'), 'Energy');
  assert.equal(mapSector('Electric Utilities'), 'Energy');
});
