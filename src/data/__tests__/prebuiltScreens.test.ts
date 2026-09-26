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
  assert.equal(PREBUILT_SCREENS.length, 23);
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
      preset: screen.id,
    };
    const columns = visibleColumns(state);
    for (const key of screen.columns ?? []) assert.ok(columns.includes(key));
    assert.deepEqual(decodeScreen(encodeScreen(state)), state, screen.id);
  }
});
