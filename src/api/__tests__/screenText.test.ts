import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ScreenResult, ScreenRow} from '../../types/screen.ts';
import {marketApi} from '../market.ts';
import {fakeHttp} from './fakeHttp.ts';

// A screen's text columns (backend `screenoptions.go` futureText): the most-traded future's name
// and expiry, beside the figures. The screen is passed through as the server answers it, so a text
// column reaches the apps as `ScreenRow.text`, and a row the server gave none has none.

test('a text column rides on its row, keyed by column id, and a row without one has no text', async () => {
  const answer: ScreenResult = {
    total: 2,
    scanned: 2,
    columns: ['fut_price_chg_pct', 'fut_symbol'],
    rows: [
      {
        symbol: 'RELIANCE',
        ticker: 'RELIANCE',
        name: 'Reliance Industries',
        industry: 'Refineries',
        values: {fut_price_chg_pct: 1.2},
        text: {fut_symbol: 'RELIANCE26OCTFUT', fut_expiry: '2026-10-27'},
      },
      {
        symbol: 'ZENTEC',
        ticker: 'ZENTEC',
        name: 'Zen Technologies',
        industry: 'Defence',
        values: {},
      },
    ],
  };
  const {http, calls} = fakeHttp([answer]);
  const result = await marketApi(http).runScreen({
    universes: ['fno'],
    columns: ['fut_price_chg_pct', 'fut_symbol'],
  });
  assert.equal(calls[0]?.path, '/news/screen');
  const [reliance, zentec] = result.rows as [ScreenRow, ScreenRow];
  assert.equal(reliance.text?.fut_symbol, 'RELIANCE26OCTFUT');
  assert.equal(reliance.text?.fut_expiry, '2026-10-27');
  assert.equal(zentec.text?.fut_symbol, undefined);
  assert.equal(zentec.text, undefined);
});
