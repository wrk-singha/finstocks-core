import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  isManualPagePath,
  manualPageSlug,
  manualPageTitle,
  manualPageUrl,
} from '../manualPages.ts';

test('manual pages are told apart from routes and read back to a slug, title and URL', () => {
  assert.equal(isManualPagePath('/manuals/banking-field-manual.html'), true);
  assert.equal(isManualPagePath('/manuals/index.html'), true);
  assert.equal(isManualPagePath('/manuals/'), false);
  assert.equal(isManualPagePath('/manuals/../index.html'), false);
  assert.equal(isManualPagePath('/manuals/a/b.html'), false);
  assert.equal(isManualPagePath('/market#sector-strength'), false);
  assert.equal(isManualPagePath(null), false);
  assert.equal(
    manualPageSlug('/manuals/banking-field-manual.html'),
    'banking-field-manual',
  );
  assert.equal(manualPageSlug('/manuals/index.html?x=1#top'), 'index');
  assert.equal(
    manualPageUrl('https://finstocks.ai/', 'banking-field-manual'),
    'https://finstocks.ai/manuals/banking-field-manual.html',
  );
  assert.equal(manualPageTitle('banking-field-manual'), 'Banking field manual');
  assert.equal(manualPageTitle('index'), 'Index');
  assert.equal(manualPageTitle(''), '');
});
