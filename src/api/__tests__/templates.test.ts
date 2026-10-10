import assert from 'node:assert/strict';
import {test} from 'node:test';

import {templatesApi} from '../templates.ts';
import {fakeHttp} from './fakeHttp.ts';

test('screener strategy list and detail', async () => {
  const {http, calls} = fakeHttp();
  const api = templatesApi(http);
  await api.getScreenerStrategies({page: 1, limit: 20});
  await api.getScreenerStrategies({
    page: 2,
    limit: 10,
    isIntraday: false,
    isPremium: true,
    isFno: false,
    hasTodaysPick: true,
  });
  await api.getScreenerStrategies({page: 1, limit: 5, hasTodaysPick: false});
  await api.getScreenerStrategyDetail(7, '1 m', 2026);
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/templates/screener-strategies?page=1&limit=20',
      '/templates/screener-strategies?page=2&limit=10&is_intraday=false&is_premium=true&is_fno=false&has_todays_pick=true',
      '/templates/screener-strategies?page=1&limit=5',
      '/templates/screener-strategies/7?timeframe=1%20m&year=2026',
    ],
  );
});

test('the strategy library list, detail and activity, by slug or id, the key escaped', async () => {
  const {http, calls} = fakeHttp();
  const api = templatesApi(http);
  await api.getStrategyLibrary();
  await api.getStrategyLibraryDetail('krishna');
  await api.getStrategyLibraryDetail('leader-breakout-swing');
  await api.getStrategyLibraryDetail('a b');
  await api.getStrategyLibraryActivity('kangto');
  await api.getStrategyLibraryActivity('a/b');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method ?? 'GET']),
    [
      ['/templates/strategy-library', 'GET'],
      ['/templates/strategy-library/krishna', 'GET'],
      ['/templates/strategy-library/leader-breakout-swing', 'GET'],
      ['/templates/strategy-library/a%20b', 'GET'],
      ['/templates/strategy-library/kangto/activity', 'GET'],
      ['/templates/strategy-library/a%2Fb/activity', 'GET'],
    ],
  );
  // The refresh is the service's and the source the LLM service's: no app ever calls either.
  assert.equal('refreshStrategyLibrary' in api, false);
  assert.equal('getStrategyLibrarySource' in api, false);
});
