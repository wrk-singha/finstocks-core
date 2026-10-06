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

test('the strategy library list and detail, the id escaped', async () => {
  const {http, calls} = fakeHttp();
  const api = templatesApi(http);
  await api.getStrategyLibrary();
  await api.getStrategyLibraryDetail('krishna');
  await api.getStrategyLibraryDetail('a b');
  assert.deepEqual(
    calls.map(c => c.path),
    [
      '/templates/strategy-library',
      '/templates/strategy-library/krishna',
      '/templates/strategy-library/a%20b',
    ],
  );
});
