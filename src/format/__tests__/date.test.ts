import assert from 'node:assert/strict';
import {test} from 'node:test';

import {istDayKey, parseApiDate} from '../date.ts';

test('istDayKey is the IST calendar day, not the UTC one', () => {
  // 20:00 UTC on the 31st is 01:30 IST on the 1st.
  assert.equal(
    istDayKey(new Date(Date.UTC(2026, 7, 31, 20, 0, 0))),
    '2026-09-01',
  );
  assert.equal(
    istDayKey(new Date(Date.UTC(2026, 7, 31, 12, 0, 0))),
    '2026-08-31',
  );
});

test('parseApiDate reads the Postgres text form Hermes rejects', () => {
  assert.equal(
    parseApiDate('2026-08-31 20:00:24+00')?.toISOString(),
    '2026-08-31T20:00:24.000Z',
  );
  assert.equal(
    parseApiDate('2026-08-31T20:00:24Z')?.toISOString(),
    '2026-08-31T20:00:24.000Z',
  );
  assert.equal(parseApiDate('garbage'), null);
  assert.equal(parseApiDate(null), null);
});
