import assert from 'node:assert/strict';
import {test} from 'node:test';

import {emptyChatsMessage} from '../../format/text.ts';
import {CHAT_CATEGORIES, chatCategoryLabels} from '../chatCategories.ts';

test('category keys are unique and chart is not offered', () => {
  const keys = CHAT_CATEGORIES.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes('chart' as never), false);
});

test('chatCategoryLabels follows the picker order, not the tap order', () => {
  assert.deepEqual(chatCategoryLabels([]), []);
  assert.deepEqual(chatCategoryLabels(['order']), ['Orders']);
  assert.deepEqual(chatCategoryLabels(['order', 'research', 'autopilot']), [
    'Research',
    'Autopilot',
    'Orders',
  ]);
  assert.deepEqual(
    chatCategoryLabels([
      'portfolio',
      'order',
      'autopilot',
      'strategy',
      'research',
    ]),
    ['Research', 'Strategy', 'Autopilot', 'Portfolio', 'Orders'],
  );
});

test('labels feed emptyChatsMessage the copy the category search shows', () => {
  const message = (
    query: string,
    categories: Parameters<typeof chatCategoryLabels>[0],
  ) =>
    emptyChatsMessage({
      isError: false,
      query,
      categoryLabels: chatCategoryLabels(categories),
      noChats: "Start a conversation and it'll show up here.",
    });
  assert.equal(message('', []), "Start a conversation and it'll show up here.");
  assert.equal(message('nifty', []), 'No chats matching "nifty"');
  assert.equal(
    message('', ['order', 'research']),
    'No Research, Orders chats yet',
  );
  assert.equal(
    message('nifty', ['portfolio', 'strategy']),
    'No Strategy, Portfolio chats matching "nifty"',
  );
  assert.equal(
    emptyChatsMessage({
      isError: true,
      query: 'nifty',
      categoryLabels: chatCategoryLabels(['order']),
      noChats: '',
    }),
    "Couldn't load your chats. Check your connection and try again.",
  );
});
