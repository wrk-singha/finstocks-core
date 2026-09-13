import assert from 'node:assert/strict';
import {test} from 'node:test';

import {formatNextBatch} from '../market.ts';

const utc = (y: number, mo: number, d: number, h: number, mi: number): Date =>
  new Date(Date.UTC(y, mo - 1, d, h, mi));

test('formatNextBatch names the next trading day, not the next calendar day', () => {
  // Fri 11 Sep 2026, 08:00 IST: the 09:10 batch is still ahead today.
  assert.equal(formatNextBatch('09:10', utc(2026, 9, 11, 2, 30)), '9:10 AM');
  // Fri 11 Sep, 10:00 IST: Sat, Sun and the Mon 14 Sep holiday are skipped.
  assert.equal(
    formatNextBatch('09:10', utc(2026, 9, 11, 4, 30)),
    '9:10 AM Tuesday',
  );
  // Thu 10 Sep, 10:00 IST: the next session is tomorrow.
  assert.equal(
    formatNextBatch('09:10', utc(2026, 9, 10, 4, 30)),
    '9:10 AM tomorrow',
  );
  // Sat 12 Sep, early morning: a closed day never claims the batch for itself.
  assert.equal(
    formatNextBatch('09:10', utc(2026, 9, 12, 1, 0)),
    '9:10 AM Tuesday',
  );
  assert.equal(
    formatNextBatch('00:05', utc(2026, 9, 10, 4, 30)),
    '12:05 AM tomorrow',
  );
  assert.equal(formatNextBatch('15:30', utc(2026, 9, 10, 4, 30)), '3:30 PM');
  assert.equal(formatNextBatch('', utc(2026, 9, 10, 4, 30)), null);
  assert.equal(formatNextBatch('noon', utc(2026, 9, 10, 4, 30)), null);
  assert.equal(formatNextBatch(undefined), null);
  // Under a market key with no holiday table only the weekend gates: Mon 14 Sep is a session.
  assert.equal(
    formatNextBatch('09:10', utc(2026, 9, 11, 4, 30), 'XX'),
    '9:10 AM Monday',
  );
});
