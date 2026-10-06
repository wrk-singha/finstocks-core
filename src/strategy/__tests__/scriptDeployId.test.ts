import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';

import {
  scriptDeployId,
  sha1,
  uuidV5,
  type ScriptDeployIdentity,
} from '../scriptDeployId.ts';

const bytes = (text: string): number[] => [...Buffer.from(text, 'utf8')];
const sha1Hex = (text: string): string =>
  sha1(bytes(text))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

test('SHA-1 matches the published vectors, across one block and two', () => {
  assert.equal(sha1Hex(''), 'da39a3ee5e6b4b0d3255bfef95601890afd80709');
  assert.equal(sha1Hex('abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
  assert.equal(
    sha1Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
  );
  // And Node's own, over lengths around the padding boundary and text outside ASCII.
  for (const text of [
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(119),
    'chat-1\u0000₹ 50,000\u0000🙂',
  ]) {
    assert.equal(
      sha1Hex(text),
      createHash('sha1').update(text, 'utf8').digest('hex'),
      `${String(text.length)} chars`,
    );
  }
});

test('a version 5 UUID matches the RFC’s example', () => {
  // RFC 9562 appendix A.4: "www.example.com" in the DNS namespace.
  assert.equal(
    uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
    '2ed6657d-e927-568b-95e1-2665a8aea6a2',
  );
});

const card: ScriptDeployIdentity = {
  messageId: '0f9a1c2e-4b5d-4e6f-8a7b-9c0d1e2f3a4b',
  cardKey: 'plan-0',
  kind: 'live',
};

test('a card’s deploy id is a UUID, the same every time, and differs by message, place and kind', () => {
  const id = scriptDeployId(card);
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  // The formula, pinned: a change would orphan every row named before it.
  assert.equal(
    id,
    uuidV5(
      ['c-card', card.messageId, 'plan-0', 'live'].join('\u0000'),
      '3f0e6a52-9c1d-4b7e-8a25-6d4c1b9e7f30',
    ),
  );
  assert.equal(scriptDeployId({...card}), id);
  const others = [
    {...card, kind: 'forward' as const},
    {...card, cardKey: 'plan-1'},
    {...card, messageId: '0f9a1c2e-4b5d-4e6f-8a7b-9c0d1e2f3a4c'},
  ].map(scriptDeployId);
  assert.equal(new Set([id, ...others]).size, 4);
  // The parts are joined so that no two different cards read as the same name.
  assert.notEqual(
    scriptDeployId({...card, messageId: 'a', cardKey: 'bc'}),
    scriptDeployId({...card, messageId: 'ab', cardKey: 'c'}),
  );
});

test('neither the chat nor the code names the row: a card whose code changes deploys to the same one', () => {
  // The identity takes neither; an edit of the code in place meets the replace prompt there.
  assert.deepEqual(Object.keys(card).sort(), ['cardKey', 'kind', 'messageId']);
});
