import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {ContractSeries} from '../../types/graphData.ts';
import {
  arrangeFnoReplay,
  buildFnoReplay,
  buildupFrom,
  fnoReplayFigures,
  type FnoReplayFrames,
  type FnoReplayWindow,
} from '../fnoHeatReplay.ts';

// The F&O heatmap's replay: frames, figures and the tiles at a step. Web's
// scripts/fnoHeatReplay.test.mjs, test for test.

const near = (actual: number | null | undefined, expected: number): void => {
  assert.ok(
    actual != null && Math.abs(actual - expected) < 1e-9,
    `${String(actual)} ≠ ${expected}`,
  );
};
const pct = (now: number, base: number) => (now / base - 1) * 100;

type Bar = readonly [time: string, close: number, oi: number | null];

// Newest first, as graph-data sends a contract's bars.
const series = (
  bars: readonly Bar[],
  extra: Partial<ContractSeries> = {},
): ContractSeries => ({
  t: bars.map(b => b[0]).reverse(),
  c: bars.map(b => b[1]).reverse(),
  oi: bars.map(b => b[2]).reverse(),
  ...extra,
});

const RIL = 'RELIANCE26OCTFUT';
const TCS = 'TCS26OCTFUT';
const raw: Record<string, ContractSeries> = {
  [RIL]: series(
    [
      ['2026-10-23 15:25:00', 100, 1000],
      ['2026-10-24 09:15:00', 101, 1100],
      ['2026-10-24 09:20:00', 99, 1200],
      ['2026-10-24 09:25:00', 98, 1250],
    ],
    {pc: 100.5, poi: 1050},
  ),
  // Keyed in another case than asked; no 09:15 bar, and an OI the feed left out at 09:25.
  tcs26octfut: series([
    ['2026-10-23 15:25:00', 49, 520],
    ['2026-10-24 09:20:00', 50, 500],
    ['2026-10-24 09:25:00', 50, null],
  ]),
};
const HOURS = {open: '09:15', close: '15:30'};
const DAY: FnoReplayWindow = {
  start: '2026-10-24 09:15:00',
  end: '2026-10-24 15:30:59',
  fromOpen: true,
  day: '2026-10-24',
  hours: HOURS,
};

const built = (
  bars: Record<string, ContractSeries>,
  contracts: readonly string[],
  window: FnoReplayWindow,
): FnoReplayFrames =>
  buildFnoReplay(bars, contracts, window) ?? assert.fail('no frames');

const figuresOf = (frames: FnoReplayFrames, step: number, contract: string) =>
  fnoReplayFigures(frames, step).get(contract) ?? assert.fail(contract);

test('build-ups read price and open interest together, and either one flat is none', () => {
  assert.equal(buildupFrom(1, 2), 'long_buildup');
  assert.equal(buildupFrom(-1, 2), 'short_buildup');
  assert.equal(buildupFrom(1, -2), 'short_covering');
  assert.equal(buildupFrom(-1, -2), 'long_unwinding');
  assert.equal(buildupFrom(0, 2), null);
  assert.equal(buildupFrom(1, 0), null);
  assert.equal(buildupFrom(null, 2), null);
  assert.equal(buildupFrom(1, null), null);
});

test("a day from the open steps every stamp, measured from the server's base for that day", () => {
  const frames = built(raw, [RIL, TCS], DAY);
  assert.deepEqual(frames.times, [
    '2026-10-24 09:15:00',
    '2026-10-24 09:20:00',
    '2026-10-24 09:25:00',
  ]);
  assert.equal(frames.basePrice.get(RIL), 100.5);
  assert.equal(frames.baseOi.get(RIL), 1050);
  // No pc or poi: the last bar before the open is the base.
  assert.equal(frames.basePrice.get(TCS), 49);
  assert.equal(frames.baseOi.get(TCS), 520);

  const open = figuresOf(frames, 0, RIL);
  near(open.change, pct(101, 100.5));
  near(open.oiChange, pct(1100, 1050));
  assert.equal(open.buildup, 'long_buildup');
  // Not traded yet: where it stood at the last close, so flat.
  assert.deepEqual(figuresOf(frames, 0, TCS), {
    change: 0,
    oiChange: 0,
    buildup: null,
  });

  assert.equal(figuresOf(frames, 1, RIL).buildup, 'short_buildup');
  near(figuresOf(frames, 1, TCS).change, pct(50, 49));
  assert.equal(figuresOf(frames, 1, TCS).buildup, 'short_covering');
  // A bar with no OI carries the last one forward.
  near(figuresOf(frames, 2, TCS).oiChange, pct(500, 520));
  // A step past the end reads the last one.
  assert.deepEqual(fnoReplayFigures(frames, 99), fnoReplayFigures(frames, 2));
});

test('a window that starts after the open measures from its own first bar', () => {
  const frames = built(raw, [RIL, TCS], {
    ...DAY,
    start: '2026-10-24 09:20:00',
    fromOpen: false,
  });
  assert.deepEqual(frames.times, [
    '2026-10-24 09:20:00',
    '2026-10-24 09:25:00',
  ]);
  assert.equal(frames.basePrice.get(RIL), 99);
  assert.equal(frames.baseOi.get(RIL), 1200);
  const end = figuresOf(frames, 1, RIL);
  near(end.change, pct(98, 99));
  assert.equal(end.buildup, 'short_buildup');
  assert.equal(figuresOf(frames, 1, TCS).change, 0);
});

test("a range runs from the session before it, and the server's one-day base is not used for it", () => {
  const ril = raw[RIL] ?? assert.fail(RIL);
  const bars: Bar[] = ril.t.map((t, i) => [
    t,
    ril.c[i] ?? Number.NaN,
    ril.oi?.[i] ?? null,
  ]);
  const raw2 = {
    [RIL]: series([['2026-10-22 15:25:00', 95, 900], ...bars.reverse()], {
      pc: 100.5,
      poi: 1050,
    }),
  };
  const frames = built(raw2, [RIL], {
    start: '2026-10-23 09:15:00',
    end: '2026-10-24 15:30:59',
    fromOpen: true,
    day: null,
    hours: HOURS,
  });
  assert.equal(frames.basePrice.get(RIL), 95);
  assert.equal(frames.baseOi.get(RIL), 900);
});

test('a contract that did not trade on the day is not measured from a base the server set for another day', () => {
  const stale = {
    ...raw,
    ITC26OCTFUT: series([['2026-10-23 15:25:00', 60, 300]], {
      pc: 70,
      poi: 400,
    }),
  };
  const frames = built(stale, [RIL, 'ITC26OCTFUT'], DAY);
  assert.equal(frames.basePrice.get('ITC26OCTFUT'), 60);
  assert.deepEqual(figuresOf(frames, 2, 'ITC26OCTFUT'), {
    change: 0,
    oiChange: 0,
    buildup: null,
  });
});

test('one bar is no replay, and a contract the answer left out is skipped', () => {
  assert.equal(
    buildFnoReplay(raw, [RIL], {
      ...DAY,
      start: '2026-10-24 09:25:00',
      fromOpen: false,
    }),
    null,
  );
  const frames = built(raw, [RIL, 'ABC26OCTFUT'], DAY);
  assert.equal(frames.price.has('ABC26OCTFUT'), false);
  assert.equal(buildFnoReplay({}, [RIL], DAY), null);
  // A series short of its columns, or no series at all, is a contract with no bars.
  assert.equal(
    buildFnoReplay({[RIL]: {c: [1]}, [TCS]: null}, [RIL, TCS], DAY),
    null,
  );
});

test('tiles hold the order the window closed in, fade outside the filter, and show nothing without bars', () => {
  const frames = built(raw, [RIL, TCS], DAY);
  const tile = (symbol: string, contract: string | null) => ({
    symbol,
    ticker: symbol,
    change: 0,
    oiChange: 0,
    buildup: null,
    contract,
  });
  const tiles = [
    tile('RELIANCE', RIL),
    tile('ITC', null),
    tile('TCS', TCS.toLowerCase()),
  ];
  const shown = arrangeFnoReplay(
    tiles,
    fnoReplayFigures(frames, 1),
    fnoReplayFigures(frames, 2),
    'short_buildup',
    'desc',
  );
  assert.deepEqual(
    shown.map(t => t.symbol),
    ['TCS', 'RELIANCE', 'ITC'],
  );
  assert.deepEqual(
    shown.map(t => t.buildup),
    ['short_covering', 'short_buildup', null],
  );
  assert.deepEqual(
    shown.map(t => t.faded),
    [true, false, true],
  );
  assert.equal(shown[2]?.change, null);
  assert.deepEqual(
    shown.map(t => t.missing),
    [false, false, true],
  );

  const low = arrangeFnoReplay(
    tiles,
    fnoReplayFigures(frames, 1),
    fnoReplayFigures(frames, 2),
    'all',
    'asc',
  );
  assert.deepEqual(
    low.map(t => t.symbol),
    ['RELIANCE', 'TCS', 'ITC'],
  );
  assert.ok(low.every(t => !t.faded));
});

test('minutes the feed stored past the close are neither steps nor the base', () => {
  const late = {
    [RIL]: series([
      ['2026-10-22 15:30:00', 100, 1000],
      // A print after the close: not the session's last price.
      ['2026-10-22 15:39:00', 90, 900],
      ['2026-10-23 09:15:00', 101, 1010],
      ['2026-10-23 15:30:00', 102, 1020],
      ['2026-10-23 15:36:00', 80, 800],
      ['2026-10-24 09:15:00', 103, 1030],
      ['2026-10-24 09:16:00', 104, 1040],
    ]),
  };
  const day = built(late, [RIL], {
    ...DAY,
    start: '2026-10-23 09:15:00',
    end: '2026-10-23 15:30:59',
    day: '2026-10-23',
  });
  assert.deepEqual(day.times, ['2026-10-23 09:15:00', '2026-10-23 15:30:00']);
  assert.equal(day.basePrice.get(RIL), 100);
  assert.equal(day.baseOi.get(RIL), 1000);
  const range = built(late, [RIL], {
    ...DAY,
    start: '2026-10-23 09:15:00',
    day: null,
  });
  assert.equal(range.times.includes('2026-10-23 15:36:00'), false);
  assert.equal(range.times.length, 4);
});
