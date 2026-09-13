import assert from 'node:assert/strict';
import {test} from 'node:test';

import {memoryApi, memoryDownloadPath} from '../memory.ts';
import {fakeHttp} from './fakeHttp.ts';

test('memory document endpoints send the confirmation literals', async () => {
  const {http, calls} = fakeHttp();
  const api = memoryApi(http);
  await api.getMemory();
  await api.updateMemory({memory_text: 'x', expected_version: 3});
  await api.resetLearnedBehavior();
  await api.deleteMemory();
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/memory', undefined, undefined],
      ['/memory', 'PUT', {memory_text: 'x', expected_version: 3}],
      ['/memory/behavior', 'DELETE', {confirmation: 'RESET_LEARNED_BEHAVIOR'}],
      ['/memory', 'DELETE', {confirmation: 'DELETE_MY_MEMORY'}],
    ],
  );
  assert.equal(memoryDownloadPath, '/memory/download');
});
