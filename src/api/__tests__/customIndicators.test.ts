import assert from 'node:assert/strict';
import {test} from 'node:test';

import {queryKeys} from '../../queryKeys.ts';
import type {
  CustomIndicator,
  SaveCustomIndicatorRequest,
} from '../../types/customIndicator.ts';
import {customIndicatorsApi} from '../customIndicators.ts';
import {fakeHttp} from './fakeHttp.ts';

const row: CustomIndicator = {
  id: 'ci/1',
  draft_id: 'd-1',
  name: 'VW RSI',
  description: 'RSI of a volume-weighted close.',
  source_format: 'pine',
  source_label: 'Pine Script v5',
  definition: {pane: 'separate', inputs: [], plots: [], spec: {v: 1}},
  chat_id: 'chat-1',
  created_at: '2026-09-25T10:00:00Z',
  updated_at: '2026-09-25T10:00:00Z',
};

test('the list, save, rename and delete hit /custom-indicators with web’s bodies', async () => {
  const {http, calls} = fakeHttp([{indicators: [row]}]);
  const api = customIndicatorsApi(http);
  const save: SaveCustomIndicatorRequest = {
    draft_id: 'd-1',
    name: 'VW RSI',
    description: 'RSI of a volume-weighted close.',
    source_format: 'pine',
    definition: row.definition,
  };
  assert.deepEqual(await api.getCustomIndicators(), [row]);
  await api.saveCustomIndicator(save);
  await api.renameCustomIndicator({id: 'ci/1', name: 'Volume RSI'});
  await api.deleteCustomIndicator('ci/1');
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/custom-indicators', undefined, undefined],
      ['/custom-indicators', 'POST', save],
      ['/custom-indicators/ci%2F1', 'PATCH', {name: 'Volume RSI'}],
      ['/custom-indicators/ci%2F1', 'DELETE', undefined],
    ],
  );
});

test('an account with nothing saved reads as an empty list, however Go writes it', async () => {
  const {http} = fakeHttp([{indicators: null}, null]);
  const api = customIndicatorsApi(http);
  assert.deepEqual(await api.getCustomIndicators(), []);
  assert.deepEqual(await api.getCustomIndicators(), []);
});

test('the chat card and the picker share one cache key, web’s array', () => {
  assert.deepEqual(queryKeys.customIndicators(), ['custom-indicators']);
});
