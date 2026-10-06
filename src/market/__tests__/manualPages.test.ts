import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  isManualPagePath,
  manualPageSlug,
  manualPageSlugOfUrl,
  manualPageTitle,
  manualPageUrl,
} from '../manualPages.ts';

test('manual pages are told apart from routes and read back to a slug, title and URL', () => {
  assert.equal(isManualPagePath('/manuals/banking-field-manual.html'), true);
  assert.equal(isManualPagePath('/manuals/index.html'), true);
  assert.equal(isManualPagePath('/manuals/'), false);
  assert.equal(isManualPagePath('/manuals/../index.html'), false);
  assert.equal(isManualPagePath('/manuals/a/b.html'), false);
  // An encoded or a literal `..`, an upper-case or an underscored name: no page is named so.
  assert.equal(isManualPagePath('/manuals/%2e%2e/index.html'), false);
  assert.equal(isManualPagePath('/manuals/%2e%2e%2findex.html'), false);
  assert.equal(isManualPagePath('/manuals/..'), false);
  assert.equal(isManualPagePath('/manuals/Banking.html'), false);
  assert.equal(isManualPagePath('/manuals/a_b.html'), false);
  assert.equal(isManualPagePath('/manuals/.html'), false);
  assert.equal(isManualPagePath('/market#sector-strength'), false);
  assert.equal(isManualPagePath(null), false);
  assert.equal(
    manualPageSlug('/manuals/banking-field-manual.html'),
    'banking-field-manual',
  );
  assert.equal(manualPageSlug('/manuals/index.html?x=1#top'), 'index');
  assert.equal(manualPageSlug('/manuals/%2e%2e/x.html'), '');
  assert.equal(
    manualPageUrl('https://finstocks.ai/', 'banking-field-manual'),
    'https://finstocks.ai/manuals/banking-field-manual.html',
  );
  assert.equal(manualPageTitle('banking-field-manual'), 'Banking field manual');
  assert.equal(manualPageTitle('index'), 'Index');
  assert.equal(manualPageTitle(''), '');
});

test('a full URL reads back to its manual slug only when it is served from the web origin', () => {
  const origin = 'https://finstocks.ai';
  assert.equal(
    manualPageSlugOfUrl(
      origin,
      'https://finstocks.ai/manuals/banking-field-manual.html',
    ),
    'banking-field-manual',
  );
  assert.equal(
    manualPageSlugOfUrl(
      `${origin}/`,
      'https://finstocks.ai/manuals/index.html#top',
    ),
    'index',
  );
  assert.equal(
    manualPageSlugOfUrl(origin, 'https://finstocks.ai/market'),
    null,
  );
  assert.equal(
    manualPageSlugOfUrl(origin, 'https://www.bseindia.com/manuals/x.html'),
    null,
  );
  assert.equal(
    manualPageSlugOfUrl(
      origin,
      'https://finstocks.ai.evil.example/manuals/x.html',
    ),
    null,
  );
  assert.equal(
    manualPageSlugOfUrl(origin, 'https://finstocks.ai/manuals/%2e%2e/x.html'),
    null,
  );
});
