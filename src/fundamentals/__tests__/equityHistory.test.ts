import assert from 'node:assert/strict';
import {test} from 'node:test';

import {buildEquityHistory} from '../equityHistory.ts';
import {round, series} from './filings.ts';

test('the share count is paid-up capital over face value, newest year first', () => {
  const history = buildEquityHistory(
    series([202603, 202503, 202403, 202303, 202203], {
      // A 2:1 split in FY26 halves the face value; a 1:1 bonus in FY25
      // doubles the paid-up capital.
      FACE_VALUE: [5, 10, 10, 10, 10],
      EQUITY_PAIDUP: [200, 200, 100, null, null],
      Share_Capital: [200, 200, 100, 95, null],
      Equity_Authorised: [500, 500, 250, 250, 250],
    }),
  );
  assert.deepEqual(
    history.map(y => ({...y, change: round([y.change])[0]})),
    [
      {
        period: 202603,
        faceValue: 5,
        paidUp: 200,
        authorised: 500,
        shares: 4e8,
        change: 100,
      },
      {
        period: 202503,
        faceValue: 10,
        paidUp: 200,
        authorised: 500,
        shares: 2e8,
        change: 100,
      },
      {
        period: 202403,
        faceValue: 10,
        paidUp: 100,
        authorised: 250,
        shares: 1e8,
        change: round([((1e8 - 9.5e7) / 9.5e7) * 100])[0],
      },
      // Paid-up read off share capital where the vendor has no paid-up line;
      // FY22 filed neither, so it has no row and FY23 no change.
      {
        period: 202303,
        faceValue: 10,
        paidUp: 95,
        authorised: 250,
        shares: 9.5e7,
        change: null,
      },
    ],
  );
});

test('without a face value the capital shows but the share count does not', () => {
  const history = buildEquityHistory(
    series([202603, 202503], {Share_Capital: [200, 100]}),
  );
  assert.deepEqual(history, [
    {
      period: 202603,
      faceValue: null,
      paidUp: 200,
      authorised: null,
      shares: null,
      change: null,
    },
    {
      period: 202503,
      faceValue: null,
      paidUp: 100,
      authorised: null,
      shares: null,
      change: null,
    },
  ]);
  assert.deepEqual(buildEquityHistory(undefined), []);
  assert.deepEqual(buildEquityHistory(series([], {})), []);
});
