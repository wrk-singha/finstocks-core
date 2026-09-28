import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  chatApi,
  chatCategoryParam,
  chatResumeStreamPath,
  chatStreamPath,
  chatStreamRequest,
  chatWsPath,
} from '../chat.ts';
import {queryKeys} from '../../queryKeys.ts';
import {fakeHttp} from './fakeHttp.ts';

test('chatCategoryParam is order-independent and empty when nothing is selected', () => {
  assert.equal(chatCategoryParam([]), '');
  assert.equal(chatCategoryParam(['order']), 'order');
  assert.equal(
    chatCategoryParam(['strategy', 'order', 'research']),
    'order,research,strategy',
  );
  assert.equal(
    chatCategoryParam(['research', 'strategy', 'order']),
    chatCategoryParam(['order', 'strategy', 'research']),
  );
  const selection = ['strategy', 'autopilot'] as const;
  const tapped = [...selection];
  chatCategoryParam(tapped);
  assert.deepEqual(tapped, selection);
});

test('a category search sends the param and keys on the same value', async () => {
  const {http, last} = fakeHttp();
  const category = chatCategoryParam(['portfolio', 'autopilot']);
  await chatApi(http).getAllChats({surface: 'chart', q: 'nifty', category});
  assert.equal(
    last().path,
    '/chats?surface=chart&q=nifty&category=autopilot%2Cportfolio',
  );
  assert.deepEqual(queryKeys.chatsSearch('nifty', 'chart', category), [
    'chats',
    'search',
    'nifty',
    'chart',
    'autopilot,portfolio',
    null,
  ]);
  assert.deepEqual(queryKeys.chatsSearch('nifty', 'chart'), [
    'chats',
    'search',
    'nifty',
    'chart',
    '',
    null,
  ]);
});

test('an activity window is sent only when set, and keys its own entry in the search family', async () => {
  const {http, calls} = fakeHttp();
  const api = chatApi(http);
  await api.getAllChats({category: 'strategy', days: 7});
  await api.getAllChats({days: null});
  await api.getAllChats({days: 0});
  await api.getAllChats({limit: 30, days: 1});
  assert.deepEqual(
    calls.map(call => call.path),
    [
      '/chats?category=strategy&days=7',
      '/chats',
      '/chats',
      '/chats?limit=30&days=1',
    ],
  );
  const week = queryKeys.chatsSearch('', '', 'strategy', 7);
  assert.deepEqual(week, ['chats', 'search', '', '', 'strategy', 7]);
  assert.notDeepEqual(week, queryKeys.chatsSearch('', '', 'strategy', 30));
  assert.notDeepEqual(week, queryKeys.chatsSearch('', '', 'strategy'));
  assert.deepEqual(week.slice(0, 2), queryKeys.chatsSearch('', '').slice(0, 2));
});

test('an empty string param is left out like an unset one, as web sends the list', async () => {
  const {http, calls} = fakeHttp();
  const api = chatApi(http);
  await api.getAllChats({
    cursor: '',
    surface: '',
    symbol: '',
    q: '',
    category: '',
    days: 3,
  });
  await api.getAllChats({
    limit: 30,
    surface: '',
    q: '',
    category: 'strategy',
    days: null,
  });
  await api.getAllChats({cursor: 'c2', limit: 30, surface: '', q: 'nifty'});
  assert.deepEqual(
    calls.map(call => call.path),
    [
      '/chats?days=3',
      '/chats?limit=30&category=strategy',
      '/chats?cursor=c2&limit=30&q=nifty',
    ],
  );
});

test('the total rides on the first page and is optional on the wire', async () => {
  const {http} = fakeHttp([
    {chats: [], next_cursor: 'c2', has_more: true, total: 42},
    {chats: [], next_cursor: null, has_more: false},
  ]);
  const api = chatApi(http);
  const first = await api.getAllChats({days: 3});
  const second = await api.getAllChats({cursor: 'c2', days: 3});
  assert.equal(first.total, 42);
  assert.equal(second.total, undefined);
});

test('list queries only carry the params that were set', async () => {
  const {http, calls} = fakeHttp();
  const api = chatApi(http);
  await api.getAllChats();
  await api.getAllChats({
    cursor: null,
    limit: 20,
    surface: 'chart',
    symbol: 'TCS',
    q: 'x y',
    category: 'a,b',
  });
  await api.getPinnedChats();
  assert.equal(calls[0]?.path, '/chats');
  assert.equal(
    calls[1]?.path,
    '/chats?limit=20&surface=chart&symbol=TCS&q=x%20y&category=a%2Cb',
  );
  assert.equal(calls[2]?.path, '/chats?pinned=true');
});

test('mutations use the right verb, path and body', async () => {
  const {http, calls} = fakeHttp();
  const api = chatApi(http);
  await api.createChat({title: 't'} as never);
  await api.deleteChat('c1');
  await api.pinChat('c1', true);
  await api.updateChatTitle('c1', 'New');
  await api.likeMessage('m1', 1);
  await api.shareChat({chat_id: 'c1'});
  await api.forkChat({share_id: 's1'});
  await api.stopStream('c1');
  await api.startVoiceSession('c1');
  await api.reportHeard('m1', 1234.6);
  assert.deepEqual(
    calls.map(c => [c.path, c.init?.method, c.init?.body]),
    [
      ['/chats', 'POST', {title: 't'}],
      ['/chats/c1', 'DELETE', undefined],
      ['/chats/c1/pin', 'PUT', {pinned: true}],
      ['/chats/c1/title', 'PUT', {title: 'New'}],
      ['/chats/like', 'POST', {message_id: 'm1', like_status: 1}],
      ['/share/chat', 'POST', {chat_id: 'c1'}],
      ['/share/chat/fork', 'POST', {share_id: 's1'}],
      ['/chats/stream/stop', 'POST', {chat_id: 'c1'}],
      ['/voice/session', 'POST', {chat_id: 'c1'}],
      [
        '/chats/heard',
        'POST',
        {message_id: 'm1', heard: '', audio_end_ms: 1235},
      ],
    ],
  );
  for (const call of calls) assert.equal(call.init?.anonymous, undefined);
});

test('shared chat is public; stream paths are bare', async () => {
  const {http, last} = fakeHttp();
  await chatApi(http).getSharedChat('abc');
  assert.equal(last().path, '/share/chat/abc');
  assert.equal(last().init?.anonymous, true);
  assert.equal(chatStreamPath, '/chats/stream/sse');
  assert.equal(chatResumeStreamPath('c1'), '/chats/c1/stream');
  assert.equal(chatWsPath('t k'), '/chats/ws?token=t%20k');
});

test('stream request body mirrors both transports', () => {
  assert.deepEqual(
    chatStreamRequest({
      chatId: 'c1',
      message: 'hi',
      market: 'IN',
      isMock: true,
    }),
    {
      chat_id: 'c1',
      message: 'hi',
      model: 'default',
      market: 'IN',
      is_mock: true,
    },
  );
  assert.deepEqual(
    chatStreamRequest({
      chatId: 'c1',
      message: 'hi',
      market: 'IN',
      isMock: false,
      strategyId: 's1',
      surface: 'chart',
      mode: 'research',
      voice: true,
      pageContext: {symbol: 'TCS'},
    }),
    {
      chat_id: 'c1',
      message: 'hi',
      model: 'default',
      market: 'IN',
      is_mock: false,
      strategy_id: 's1',
      surface: 'chart',
      mode: 'research',
      voice: true,
      page_context: {symbol: 'TCS'},
    },
  );
});
