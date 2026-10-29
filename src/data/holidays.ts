// Exchange holidays by market and year (ISO dates), as bundled: the table the calendar starts from
// (holidayTable.ts) until a client hands it the backend's. Kept as TypeScript, not JSON, because
// Node's type stripping cannot import JSON without an attribute. 2025 as web corrected it
// (926a6407): 26 Feb (Mahashivratri) and 22 Oct (Balipratipada) were shut, 4 Nov traded (Guru Nanak
// Jayanti fell on 5 Nov); the backend's own backtest data agrees.
export const HOLIDAYS: Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
> = {
  IN: {
    '2025': [
      '2025-01-26',
      '2025-02-26',
      '2025-03-14',
      '2025-03-31',
      '2025-04-10',
      '2025-04-14',
      '2025-04-18',
      '2025-05-01',
      '2025-08-15',
      '2025-08-27',
      '2025-10-02',
      '2025-10-21',
      '2025-10-22',
      '2025-11-01',
      '2025-11-05',
      '2025-12-25',
    ],
    '2026': [
      '2026-01-15',
      '2026-01-26',
      '2026-03-03',
      '2026-03-26',
      '2026-03-31',
      '2026-04-03',
      '2026-04-14',
      '2026-05-01',
      '2026-05-28',
      '2026-06-26',
      '2026-09-14',
      '2026-10-02',
      '2026-10-20',
      '2026-11-10',
      '2026-11-24',
      '2026-12-25',
    ],
  },
};
