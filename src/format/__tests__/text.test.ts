import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  cleanProse,
  deriveChatTitle,
  emptyChatsMessage,
  getUserInitials,
  humanizeLabel,
  isShortDirection,
  pluralCount,
  sourceDomain,
  splitRationaleSource,
  stripCitations,
  stripHtml,
} from '../text.ts';

test('isShortDirection is case- and null-insensitive', () => {
  assert.equal(isShortDirection('SHORT'), true);
  assert.equal(isShortDirection('short'), true);
  assert.equal(isShortDirection('long'), false);
  assert.equal(isShortDirection(null), false);
  assert.equal(isShortDirection(undefined), false);
});

test('deriveChatTitle collapses whitespace and slices without an ellipsis', () => {
  assert.equal(
    deriveChatTitle('  Buy   RELIANCE\n\ttoday '),
    'Buy RELIANCE today',
  );
  assert.equal(deriveChatTitle('abcdef ghij', 7), 'abcdef');
  assert.equal(deriveChatTitle('short'), 'short');
});

test('getUserInitials takes first and last initials', () => {
  assert.equal(getUserInitials('rohit singha'), 'RS');
  assert.equal(getUserInitials('  ada   lovelace   byron '), 'AL');
  assert.equal(getUserInitials('ada'), 'A');
  assert.equal(getUserInitials('   '), 'U');
  assert.equal(getUserInitials(null), 'U');
  assert.equal(getUserInitials(undefined), 'U');
});

test('pluralCount picks the noun form', () => {
  assert.equal(pluralCount(1, 'leg'), '1 leg');
  assert.equal(pluralCount(3, 'leg'), '3 legs');
  assert.equal(pluralCount(0, 'match', 'matches'), '0 matches');
});

test('humanizeLabel turns a slug into a sentence-case label', () => {
  assert.equal(humanizeLabel('CAUTIOUSLY_OPTIMISTIC'), 'Cautiously optimistic');
  assert.equal(humanizeLabel('mean-reversion'), 'Mean reversion');
  assert.equal(humanizeLabel(''), '');
  assert.equal(humanizeLabel(null), '');
});

test('stripCitations and cleanProse flatten LLM narrative', () => {
  assert.equal(
    stripCitations('Rates fell[2][4] sharply [7]'),
    'Rates fell sharply',
  );
  assert.equal(stripCitations(null), '');
  assert.equal(
    cleanProse('**Rates** fell [sharply](https://x.y)[1] on `RBI` __news__'),
    'Rates fell sharply on RBI news',
  );
  assert.equal(cleanProse(undefined), '');
});

test('sourceDomain shows the publisher, or the input when it is not a URL', () => {
  assert.equal(
    sourceDomain('https://www.moneycontrol.com/news/x'),
    'moneycontrol.com',
  );
  assert.equal(
    sourceDomain('https://economictimes.indiatimes.com/a'),
    'economictimes.indiatimes.com',
  );
  assert.equal(sourceDomain('not a url'), 'not a url');
});

test('splitRationaleSource separates the thesis from its citation', () => {
  assert.deepEqual(
    splitRationaleSource(
      '[2026-08-09] Strong Q1 beat. — (Source: Mint — "RIL posts record quarter" (https://livemint.com/a?b=1))',
    ),
    {
      text: 'Strong Q1 beat.',
      sourceName: 'Mint',
      sourceUrl: 'https://livemint.com/a?b=1',
    },
  );
  assert.deepEqual(
    splitRationaleSource('Momentum intact. (https://example.com/x)'),
    {
      text: 'Momentum intact.',
      sourceName: null,
      sourceUrl: 'https://example.com/x',
    },
  );
  assert.deepEqual(splitRationaleSource('Plain thesis, no source.'), {
    text: 'Plain thesis, no source.',
    sourceName: null,
    sourceUrl: null,
  });
  assert.deepEqual(splitRationaleSource('   '), {
    text: '',
    sourceName: null,
    sourceUrl: null,
  });
  assert.deepEqual(splitRationaleSource(null), {
    text: '',
    sourceName: null,
    sourceUrl: null,
  });
});

test('stripHtml flattens vendor markup to plain text without a DOM', () => {
  assert.equal(
    stripHtml(
      '<div>Board approved the dividend.</div><div>The record date is&nbsp;12 Aug.</div>',
    ),
    'Board approved the dividend. The record date is 12 Aug.',
  );
  assert.equal(stripHtml('Profit<br/>up 12%<br>YoY'), 'Profit up 12% YoY');
  assert.equal(
    stripHtml('<b>R&amp;D</b> spend &gt; &#8377;5 Cr &#x20B9;'),
    'R&D spend > ₹5 Cr ₹',
  );
  assert.equal(stripHtml('&lt;b&gt;not bold&lt;/b&gt;'), '<b>not bold</b>');
  assert.equal(
    stripHtml('&amp;lt; stays escaped once'),
    '&lt; stays escaped once',
  );
  assert.equal(
    stripHtml(
      '<p>Hello<script>alert(1)</script><!-- note --></p>\n\t<p>world &unknown; &copy;</p>',
    ),
    'Hello world &unknown; ©',
  );
  assert.equal(
    stripHtml('a <span class="x" title="1 > 0">b</span> c'),
    'a b c',
  );
  assert.equal(stripHtml(''), '');
  assert.equal(stripHtml(null), '');
});

test('emptyChatsMessage composes the empty state from the active filters', () => {
  const base = {
    isError: false,
    query: '',
    categoryLabels: [],
    noChats: 'No chats yet',
  };
  assert.equal(emptyChatsMessage(base), 'No chats yet');
  assert.equal(
    emptyChatsMessage({...base, isError: true}),
    "Couldn't load your chats. Check your connection and try again.",
  );
  assert.equal(
    emptyChatsMessage({...base, query: 'nifty'}),
    'No chats matching "nifty"',
  );
  assert.equal(
    emptyChatsMessage({...base, categoryLabels: ['Research', 'Orders']}),
    'No Research, Orders chats yet',
  );
  assert.equal(
    emptyChatsMessage({...base, query: 'nifty', categoryLabels: ['Strategy']}),
    'No Strategy chats matching "nifty"',
  );
});
