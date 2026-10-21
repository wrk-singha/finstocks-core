import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

import type {GraphDataPoint, StockGraphData} from '../../types/graphData.ts';
import type {IndustryTree} from '../../types/industries.ts';
import {
  buildReplay,
  DEFAULT_REPLAY_INTERVAL,
  REPLAY_INTERVALS,
  replayClock,
  replayIntervalOf,
  replayReturns,
  sliceReplay,
  spansDays,
  withReplayReturns,
  type ReplayFrames,
  type ReplayInterval,
} from '../heatReplay.ts';
import {buildHeatModel} from '../sectorHeatmap.ts';

const bar = (time: string, close: number): GraphDataPoint => ({
  time,
  open: close,
  high: close,
  low: close,
  close,
});

const DAY = '2026-10-16';
const at = (hhmm: string, day = DAY) => `${day} ${hhmm}:00`;

// HDFCBANK skips 09:20; TCS first trades at 09:20; BAD never has a usable close; EMPTY has no bars.
const SERIES: StockGraphData = {
  hdfcbank: [bar(at('09:15'), 100), bar(at('09:25'), 102)],
  TCS: [bar(at('09:20'), 50), bar(at('09:25'), 49)],
  BAD: [bar(at('09:15'), 0), bar(at('09:20'), Number.NaN)],
  EMPTY: [],
};

const near = (actual: number | null | undefined, expected: number): void => {
  assert.ok(
    actual != null && Math.abs(actual - expected) < 1e-9,
    `${String(actual)} is not ${expected}`,
  );
};

const built = (
  series: StockGraphData,
  prev: Record<string, number> | undefined,
): ReplayFrames => buildReplay(series, prev) ?? assert.fail('no frames');

test('each close carries forward over the steps a stock did not trade, and is NaN before its first', () => {
  const frames = built(SERIES, {HDFCBANK: 98});
  assert.deepEqual(frames.times, [at('09:15'), at('09:20'), at('09:25')]);
  assert.deepEqual([...(frames.closes.get('HDFCBANK') ?? [])], [100, 100, 102]);
  const tcs = [...(frames.closes.get('TCS') ?? [])];
  assert.ok(Number.isNaN(tcs[0]));
  assert.deepEqual(tcs.slice(1), [50, 49]);
  // Symbols are upper-cased; a stock with no usable close and no previous close is left out.
  assert.deepEqual([...frames.closes.keys()].sort(), ['HDFCBANK', 'TCS']);
});

test("a stock's change is from its previous close, else from its first bar", () => {
  const frames = built(SERIES, {HDFCBANK: 98});
  assert.equal(frames.base.get('HDFCBANK'), 98);
  assert.equal(frames.base.get('TCS'), 50);
  const open = replayReturns(frames, 0);
  near(open.get('HDFCBANK'), (100 / 98 - 1) * 100);
  assert.equal(open.get('TCS'), null);
  const last = replayReturns(frames, 2);
  near(last.get('HDFCBANK'), (102 / 98 - 1) * 100);
  near(last.get('TCS'), -2);
  // Steps clamp to the tape.
  assert.deepEqual(replayReturns(frames, 99), last);
  assert.deepEqual(replayReturns(frames, -3), open);

  // No previous close at all: every stock measures from its own first bar.
  const own = built(SERIES, undefined);
  assert.equal(own.base.get('HDFCBANK'), 100);
  near(replayReturns(own, 2).get('HDFCBANK'), 2);
});

test('a previous close of zero falls back to the first bar instead of dropping the stock', () => {
  // Web anchored on any number the server sent, so this stock went grey for the whole replay.
  const frames = built(SERIES, {TCS: 0, HDFCBANK: Number.NaN});
  assert.equal(frames.base.get('TCS'), 50);
  assert.equal(frames.base.get('HDFCBANK'), 100);
});

test('fewer than two stamps, or no stock left, is no replay', () => {
  assert.equal(buildReplay({A: [bar(at('09:15'), 1)]}, {}), null);
  assert.equal(buildReplay({}, {}), null);
  assert.equal(
    buildReplay({BAD: [bar(at('09:15'), 0), bar(at('09:20'), -1)]}, {}),
    null,
  );
});

const TWO_DAYS = built(
  {
    A: [
      bar(at('09:15', '2026-10-15'), 200),
      bar(at('15:25', '2026-10-15'), 210),
      bar(at('09:15'), 220),
      bar(at('09:20'), 231),
      bar(at('09:25'), 242),
    ],
    LATE: [bar(at('09:25'), 10)],
  },
  {A: 190},
);

test('slicing keeps the bars inside the window, inclusive, and re-anchors a window that starts late', () => {
  // The latest day from its open: the change stays measured from the previous close.
  const day = sliceReplay(TWO_DAYS, at('09:15'), `${DAY} 15:30:59`, true);
  assert.ok(day);
  assert.deepEqual(day.times, [at('09:15'), at('09:20'), at('09:25')]);
  assert.equal(day.base.get('A'), 190);
  assert.deepEqual([...(day.closes.get('A') ?? [])], [220, 231, 242]);

  // A later start measures change since its own first bar.
  const late = sliceReplay(TWO_DAYS, at('09:20'), `${DAY} 15:30:59`, false);
  assert.ok(late);
  assert.deepEqual(late.times, [at('09:20'), at('09:25')]);
  assert.equal(late.base.get('A'), 231);
  assert.equal(replayReturns(late, 1).get('A'), (242 / 231 - 1) * 100);
  assert.equal(late.base.get('LATE'), 10);

  // Two days: change since the first bar of the window.
  const both = sliceReplay(
    TWO_DAYS,
    at('09:15', '2026-10-15'),
    `${DAY} 15:30:59`,
    false,
  );
  assert.equal(both?.base.get('A'), 200);
  // A stock with no close in the window is left out of it.
  const early = sliceReplay(
    TWO_DAYS,
    at('09:15', '2026-10-15'),
    at('15:25', '2026-10-15'),
    false,
  );
  assert.deepEqual([...(early?.closes.keys() ?? [])], ['A']);
});

test('the whole tape from the open is returned as is; a window under two bars is none', () => {
  assert.equal(
    sliceReplay(
      TWO_DAYS,
      at('00:00', '2026-10-01'),
      at('23:59', '2026-10-31'),
      true,
    ),
    TWO_DAYS,
  );
  assert.equal(
    sliceReplay(TWO_DAYS, at('09:25'), `${DAY} 15:30:59`, false),
    null,
  );
  assert.equal(
    sliceReplay(
      TWO_DAYS,
      at('09:15', '2026-11-02'),
      at('10:00', '2026-11-02'),
      true,
    ),
    null,
  );
});

test('each bound compares at its own length, so a date-only end keeps that whole day', () => {
  const daily = built(
    {
      A: [
        bar('2026-10-14', 100),
        bar('2026-10-15', 101),
        bar('2026-10-16', 102),
      ],
    },
    {},
  );
  const span = sliceReplay(daily, '2026-10-15', '2026-10-16', false);
  assert.deepEqual(span?.times, ['2026-10-15', '2026-10-16']);
  assert.equal(span?.base.get('A'), 101);

  const stamped = built(
    {A: [bar('2026-10-15 00:00:00', 1), bar('2026-10-16 00:00:00', 2)]},
    {},
  );
  assert.deepEqual(
    sliceReplay(stamped, '2026-10-15', '2026-10-16', false)?.times,
    ['2026-10-15 00:00:00', '2026-10-16 00:00:00'],
  );
  // Web compared the end at the start's length, which dropped the last day here.
  assert.deepEqual(sliceReplay(TWO_DAYS, at('09:20'), DAY, false)?.times, [
    at('09:20'),
    at('09:25'),
  ]);
});

const NOW = new Date('2026-10-21T06:00:00Z');

test('the clock reads the time, the day too when the replay spans days, and the day alone for daily bars', () => {
  const day = sliceReplay(TWO_DAYS, at('09:15'), `${DAY} 15:30:59`, true);
  assert.ok(day);
  assert.equal(spansDays(day), false);
  assert.equal(replayClock(day, 1, NOW), '09:20');
  assert.equal(replayClock(day, 99, NOW), '09:25');
  assert.equal(replayClock(day, -1, NOW), '09:15');

  assert.equal(spansDays(TWO_DAYS), true);
  assert.equal(replayClock(TWO_DAYS, 0, NOW), '15 Oct · 09:15');
  assert.equal(replayClock(TWO_DAYS, 3, NOW), '16 Oct · 09:20');

  const daily = built({A: [bar('2026-09-01', 1), bar('2026-09-02', 2)]}, {});
  assert.equal(replayClock(daily, 1, NOW), '2 Sep');
  const stamped = built(
    {A: [bar('2025-12-31 00:00:00', 1), bar('2026-01-01 00:00:00', 2)]},
    {},
  );
  assert.equal(replayClock(stamped, 0, NOW), '31 Dec 2025');
  assert.equal(replayClock(stamped, 1, NOW), '1 Jan');
});

test('the bar sizes and how many sessions each may span', () => {
  assert.deepEqual(
    REPLAY_INTERVALS.map(i => [i.key, i.label, i.maxSessions, i.intraday]),
    [
      ['1m', '1m', 2, true],
      ['5m', '5m', 10, true],
      ['15m', '15m', 20, true],
      ['1h', '1h', 60, true],
      ['1d', 'Daily', 250, false],
    ],
  );
  assert.equal(DEFAULT_REPLAY_INTERVAL, '5m');
  assert.equal(replayIntervalOf('1h').maxSessions, 60);
  assert.equal(replayIntervalOf('2m' as ReplayInterval).key, '5m');
});

const TREE: IndustryTree = {
  total: 0,
  nodes: [
    {
      id: 'fs',
      name: 'Financial Services',
      level: 0,
      count: 0,
      children: [
        {
          id: 'fs/fs',
          name: 'Financial Services',
          level: 1,
          count: 0,
          children: [{id: 'fs/fs/banks', name: 'Banks', level: 2, count: 0}],
        },
      ],
    },
  ],
};

test('a replay step sets the day only; a stock the replay did not read turns grey', () => {
  const model = buildHeatModel(
    [
      {
        symbol: 'HDFCBANK',
        name: 'HDFC Bank',
        industry: 'Banks',
        values: {market_cap: 300, return_1d: 5, return_1w: 1},
      },
      {
        symbol: 'icicibank',
        name: 'ICICI Bank',
        industry: 'Banks',
        values: {market_cap: 100, return_1d: 5, return_1w: 3},
      },
      {
        symbol: 'SBIN',
        name: 'SBI',
        industry: 'Banks',
        values: {market_cap: 100, return_1d: 5, return_1w: 2},
      },
    ],
    TREE,
    'top500',
  );
  // SBIN was not among the symbols read; ICICIBANK was, under its upper-cased key, but had not traded yet.
  const replayed = withReplayReturns(
    model,
    new Map([
      ['HDFCBANK', -1],
      ['ICICIBANK', null],
    ]),
  );
  assert.equal(replayed.stockBySymbol.get('HDFCBANK')?.returns['1d'], -1);
  assert.equal(replayed.stockBySymbol.get('icicibank')?.returns['1d'], null);
  assert.equal(replayed.stockBySymbol.get('SBIN')?.returns['1d'], null);
  // The longer periods, sizes and membership are the live model's.
  assert.equal(replayed.stockBySymbol.get('SBIN')?.returns['1w'], 2);
  assert.equal(replayed.stockBySymbol.get('SBIN')?.mcap, 100);
  assert.equal(replayed.signature, model.signature);
  // The sector's day is weighted over the stocks that have one: HDFCBANK alone.
  const sector = replayed.sectorById.get('fs/fs');
  assert.equal(sector?.returns['1d'], -1);
  assert.equal(
    sector?.returns['1w'],
    model.sectorById.get('fs/fs')?.returns['1w'],
  );
  assert.equal(replayed.sectors[0], sector);
  // The live model is untouched.
  assert.equal(model.stockBySymbol.get('HDFCBANK')?.returns['1d'], 5);
  assert.equal(model.sectorById.get('fs/fs')?.returns['1d'], 5);
});

test('session helpers and the replay clock read the same west and east of UTC', () => {
  // A zone is fixed when the process starts, so each check runs in a process started in it.
  const hours = new URL('../marketHours.ts', import.meta.url).href;
  const replay = new URL('../heatReplay.ts', import.meta.url).href;
  const script = `
    const h = await import(${JSON.stringify(hours)});
    const r = await import(${JSON.stringify(replay)});
    const now = new Date('2026-10-21T02:00:00Z');
    const late = new Date('2026-12-31T19:00:00Z');
    const frames = r.buildReplay({
      A: [
        {time: '2026-10-15 15:25:00', open: 1, high: 1, low: 1, close: 1},
        {time: '2026-10-16 09:15:00', open: 2, high: 2, low: 2, close: 2},
      ],
    }, {});
    process.stdout.write(JSON.stringify([
      h.sessionFor('2026-10-16'),
      h.latestSession('IN', now),
      h.latestSession('IN', new Date('2026-10-16T12:00:00Z')),
      h.stepSession('2026-10-21', -1),
      h.stepSession('2026-10-01', 1),
      h.formatSessionDate('2026-12-31', late),
      h.formatSessionDate('2026-10-16 09:15:00', now),
      r.replayClock(frames, 1, now),
    ]));`;
  const run = (tz: string) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: {...process.env, TZ: tz},
      encoding: 'utf8',
    });
  const expected = JSON.stringify([
    {
      date: '2026-10-16',
      midnight: 1792089000,
      open: 1792122300,
      close: 1792144800,
    },
    {
      date: '2026-10-19',
      midnight: 1792348200,
      open: 1792381500,
      close: 1792404000,
    },
    {
      date: '2026-10-16',
      midnight: 1792089000,
      open: 1792122300,
      close: 1792144800,
    },
    '2026-10-19',
    '2026-10-05',
    '31 Dec 2026',
    '16 Oct',
    '16 Oct · 09:15',
  ]);
  for (const tz of [
    'America/New_York',
    'Pacific/Kiritimati',
    'Asia/Kolkata',
    'UTC',
  ]) {
    assert.equal(run(tz), expected, tz);
  }
});
