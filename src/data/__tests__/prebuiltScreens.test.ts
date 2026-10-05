import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  decodeScreen,
  EMPTY_SCREEN,
  encodeScreen,
  isActiveFilter,
  splitFieldId,
  visibleColumns,
} from '../../screener/screenModel.ts';
import {PREBUILT_SCREENS} from '../prebuiltScreens.ts';

test('each prebuilt screen has its own id and name', () => {
  assert.equal(PREBUILT_SCREENS.length, 30);
  const ids = PREBUILT_SCREENS.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(PREBUILT_SCREENS.map(s => s.name)).size, ids.length);
});

test('every condition a prebuilt screen sets narrows something, on the daily chart', () => {
  for (const screen of PREBUILT_SCREENS) {
    assert.ok(screen.filters.length > 0, screen.id);
    for (const filter of screen.filters) {
      assert.ok(isActiveFilter(filter), `${screen.id} ${filter.field}`);
      assert.equal(splitFieldId(filter.field).tf, '1d', filter.field);
    }
  }
});

test('a pattern screen says how far back the formation may be', () => {
  const patterns = PREBUILT_SCREENS.flatMap(s => s.filters).filter(f =>
    f.field.startsWith('pat.'),
  );
  assert.deepEqual(patterns, [
    {field: 'pat.bullish_engulfing', flag: true, max: 0},
    {field: 'pat.ascending_triangle_breakout', flag: true, max: 29},
  ]);
});

test('opening a prebuilt screen keeps its columns and survives a shared link', () => {
  for (const screen of PREBUILT_SCREENS) {
    const state = {
      ...EMPTY_SCREEN,
      universes: screen.universes ?? [],
      filters: screen.filters,
      columns: screen.columns ?? [],
      sort: screen.sort ?? EMPTY_SCREEN.sort,
      preset: screen.id,
    };
    const columns = visibleColumns(state);
    for (const key of screen.columns ?? []) assert.ok(columns.includes(key));
    assert.deepEqual(decodeScreen(encodeScreen(state)), state, screen.id);
  }
});

test('the ESF screens rank by the score, except the PEG screen, which opens cheapest first', () => {
  const esf = PREBUILT_SCREENS.filter(s => s.id.startsWith('esf-'));
  assert.deepEqual(
    esf.map(s => s.id),
    [
      'esf-leaders',
      'esf-growth-leaders',
      'esf-big-money',
      'esf-ready-to-rise',
      'esf-fair-price',
      'esf-graham',
      'esf-strong-health',
    ],
  );
  for (const screen of esf) {
    assert.equal(screen.filters.length, 1, screen.id);
    assert.equal(screen.filters[0]?.flag, true, screen.id);
    assert.ok(screen.sort, screen.id);
  }
  assert.deepEqual(
    PREBUILT_SCREENS.find(s => s.id === 'esf-fair-price')?.sort,
    {key: 'esf_peg', dir: 'asc'},
  );
  assert.deepEqual(PREBUILT_SCREENS.find(s => s.id === 'esf-big-money')?.sort, {
    key: 'esf_volume_score',
    dir: 'desc',
  });
});

test('a screen that carries a sort sorts by a column it shows', () => {
  for (const screen of PREBUILT_SCREENS) {
    if (!screen.sort) continue;
    const state = {
      ...EMPTY_SCREEN,
      universes: screen.universes ?? [],
      filters: screen.filters,
      columns: screen.columns ?? [],
      sort: screen.sort,
      preset: screen.id,
    };
    assert.ok(visibleColumns(state).includes(screen.sort.key), screen.id);
  }
});
