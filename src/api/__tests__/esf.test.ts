import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {EsfScore} from '../../types/esf.ts';
import {esfApi} from '../esf.ts';
import {fakeHttp} from './fakeHttp.ts';

const score: EsfScore = {
  symbol: 'TCS',
  as_of: '2026-10-02',
  universe_size: 850,
  score: 77,
  rank: 12,
  top_pct: 1.4,
  stage: '2A',
  warnings: ['market_not_confirmed'],
  pillars: {earnings: 82, momentum: 74, quality: 68, institutional: 79},
};

test('the score is read from /esf/score by symbol, and handed back as served', async () => {
  const {http, calls} = fakeHttp([score, score]);
  const api = esfApi(http);
  assert.deepEqual(await api.getScore('TCS'), score);
  await api.getScore('M&M');
  assert.deepEqual(
    calls.map(call => [call.path, call.init]),
    [
      ['/esf/score?symbol=TCS', undefined],
      ['/esf/score?symbol=M%26M', undefined],
    ],
  );
});

test('a symbol the endpoint has no score for fails rather than reading as empty', async () => {
  const notScored = new Error('Not found');
  const api = esfApi({request: () => Promise.reject(notScored)});
  await assert.rejects(api.getScore('NIFTY'), notScored);
});
