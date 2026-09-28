import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  CHART_INTERVAL_LABEL,
  CHART_INTERVAL_RESOLUTION,
  type ChartInterval,
  fetchIntervalFor,
  initialPeriodForInterval,
  type PresetChartInterval,
} from '../../types/graphData.ts';
import {
  chartIntervalLabel,
  chartIntervalMinutes,
  chartIntervalToResolution,
  isChartInterval,
  isPresetChartInterval,
  makeChartInterval,
  parseChartInterval,
  resolutionToChartInterval,
} from '../chartInterval.ts';

// The chart's own dropdown ladder: TradingView's minutes, hours named in
// minutes, then days, weeks and months.
const LADDER = [
  '1',
  '2',
  '3',
  '5',
  '10',
  '15',
  '20',
  '30',
  '45',
  '60',
  '120',
  '180',
  '240',
  '1D',
  '2D',
  '3D',
  '1W',
  '2W',
  '1M',
  '3M',
  '6M',
  '12M',
];

const NEW_RUNGS: readonly (readonly [ChartInterval, string, string])[] = [
  ['20m', '20', '20m'],
  ['45m', '45', '45m'],
  ['3h', '180', '3h'],
  ['2d', '2D', '2D'],
  ['3d', '3D', '3D'],
  ['2w', '2W', '2W'],
  ['3M', '3M', '3M'],
  ['6M', '6M', '6M'],
  ['12M', '12M', '12M'],
];

const presets = Object.keys(CHART_INTERVAL_RESOLUTION) as PresetChartInterval[];

test('a count of a unit parses; anything else does not', () => {
  assert.deepEqual(parseChartInterval('45m'), {count: 45, unit: 'm'});
  assert.deepEqual(parseChartInterval('12M'), {count: 12, unit: 'M'});
  for (const valid of ['7m', '3h', '2d', '2w', '999m']) {
    assert.equal(isChartInterval(valid), true, valid);
  }
  for (const invalid of [
    '0m',
    '1000m',
    '1.5m',
    '-1m',
    '7',
    '7x',
    ' 7m',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isChartInterval(invalid), false, String(invalid));
  }
});

test('a custom count is canonical: whole hours of minutes are hours', () => {
  assert.equal(makeChartInterval(90, 'm'), '90m');
  assert.equal(makeChartInterval(120, 'm'), '2h');
  assert.equal(makeChartInterval(60, 'm'), '1h');
  assert.equal(makeChartInterval(1200, 'm'), '20h');
  assert.equal(makeChartInterval(7, 'd'), '7d');
  assert.equal(makeChartInterval(0, 'm'), null);
  assert.equal(makeChartInterval(1.5, 'h'), null);
  assert.equal(makeChartInterval(1000, 'd'), null);
  assert.equal(makeChartInterval(60_000, 'm'), null);
});

test('the presets are the picker ladder; the new rungs are drawable but not presets', () => {
  assert.equal(presets.length, 13);
  for (const preset of presets) {
    assert.equal(isChartInterval(preset), true, preset);
    assert.equal(isPresetChartInterval(preset), true, preset);
  }
  for (const [interval] of NEW_RUNGS) {
    assert.equal(isChartInterval(interval), true, interval);
    assert.equal(isPresetChartInterval(interval), false, interval);
  }
});

test('the new rungs spell their resolution and label, and presets agree with their tables', () => {
  for (const [interval, resolution, label] of NEW_RUNGS) {
    assert.equal(chartIntervalToResolution(interval), resolution, interval);
    assert.equal(chartIntervalLabel(interval), label, interval);
  }
  for (const preset of presets) {
    assert.equal(
      chartIntervalToResolution(preset),
      CHART_INTERVAL_RESOLUTION[preset],
      preset,
    );
    assert.equal(chartIntervalLabel(preset), CHART_INTERVAL_LABEL[preset]);
  }
  assert.equal(chartIntervalToResolution('1.5m'), '1');
});

test('every rung of the chart ladder maps back to an interval and round-trips', () => {
  for (const resolution of LADDER) {
    const interval = resolutionToChartInterval(resolution);
    assert.notEqual(interval, null, resolution);
    if (interval !== null) {
      assert.equal(chartIntervalToResolution(interval), resolution);
    }
  }
  assert.equal(resolutionToChartInterval('45'), '45m');
  assert.equal(resolutionToChartInterval('180'), '3h');
  assert.equal(resolutionToChartInterval('2D'), '2d');
  assert.equal(resolutionToChartInterval('12M'), '12M');
});

test('every spelling the library emits is read; what it cannot draw is null', () => {
  assert.equal(resolutionToChartInterval('7'), '7m');
  assert.equal(resolutionToChartInterval('3H'), '3h');
  assert.equal(resolutionToChartInterval('D'), '1d');
  assert.equal(resolutionToChartInterval('W'), '1w');
  assert.equal(resolutionToChartInterval('M'), '1M');
  assert.equal(resolutionToChartInterval('1440'), '24h');
  for (const unsupported of ['5S', '1T', '100R', '', '0', '1000', 'x7']) {
    assert.equal(resolutionToChartInterval(unsupported), null, unsupported);
  }
});

test('day and longer come off the daily series and open on its window; the rest off minutes', () => {
  for (const interval of ['2d', '3d', '2w', '3M', '6M', '12M'] as const) {
    assert.equal(fetchIntervalFor(interval), '1d', interval);
    assert.equal(
      initialPeriodForInterval(
        fetchIntervalFor(interval),
        chartIntervalMinutes(interval),
      ),
      '3y',
    );
  }
  for (const interval of ['20m', '45m', '3h', '7m'] as const) {
    assert.equal(fetchIntervalFor(interval), '1m', interval);
  }
  // A week of minute bars is too few candles at 45m or 3h, so those open on the
  // three-month window; 20m still fills a chart from one week.
  const minutePeriod = (interval: ChartInterval) =>
    initialPeriodForInterval('1m', chartIntervalMinutes(interval));
  assert.equal(minutePeriod('20m'), '1w');
  assert.equal(minutePeriod('45m'), '3m');
  assert.equal(minutePeriod('3h'), '3m');
  assert.equal(chartIntervalMinutes('3h'), 180);
  assert.equal(chartIntervalMinutes('2d'), 2880);
  assert.equal(chartIntervalMinutes('bogus'), 0);
});
