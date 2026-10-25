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
import {
  PREBUILT_SCREENS,
  PREBUILT_THEMES,
  type PrebuiltGroup,
} from '../prebuiltScreens.ts';

test('each prebuilt screen has its own id and name', () => {
  assert.equal(PREBUILT_SCREENS.length, 67);
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

test('the options-regime screens close the row: a tilt either way, and a range with the premium melting', () => {
  const regime = PREBUILT_SCREENS.filter(s => s.id.startsWith('regime-'));
  assert.deepEqual(
    PREBUILT_SCREENS.slice(-3).map(s => s.id),
    ['regime-leaning-up', 'regime-leaning-down', 'regime-rangebound-melting'],
  );
  assert.deepEqual(
    regime.map(s => s.filters[0]?.field),
    ['regime_bullish', 'regime_bearish', 'regime_rangebound'],
  );
  assert.deepEqual(regime[2]?.filters, [
    {field: 'regime_rangebound', flag: true},
    {field: 'regime_straddle_chg_pct', max: -15},
    {field: 'regime_straddle_iv_chg', max: -0.0001},
  ]);
  for (const screen of regime) assert.equal(screen.sort, undefined, screen.id);
});

// RegimePulse is a preview on web: its screens are hidden where it is off.
const readsRegime = (screen: {filters: {field: string}[]}) =>
  screen.filters.some(f => f.field.startsWith('regime_'));

test('every screen is filed in a group, and every grouped screen has one theme from its group', () => {
  const groups: PrebuiltGroup[] = [
    'score',
    'fundamentals',
    'technicals',
    'fno',
  ];
  for (const screen of PREBUILT_SCREENS) {
    assert.ok(screen.group && groups.includes(screen.group), screen.id);
    const themes = PREBUILT_THEMES[screen.group];
    if (themes === undefined) {
      assert.equal(
        screen.theme,
        undefined,
        `${screen.id} is in a group without themes`,
      );
    } else {
      assert.ok(screen.theme && themes.includes(screen.theme), screen.id);
    }
  }
  assert.deepEqual(Object.keys(PREBUILT_THEMES), [
    'fundamentals',
    'technicals',
    'fno',
  ]);
});

test('every theme holds two screens or more, with or without the RegimePulse preview', () => {
  for (const isRegimeOn of [true, false]) {
    for (const [group, themes] of Object.entries(PREBUILT_THEMES)) {
      const shown = PREBUILT_SCREENS.filter(
        s => s.group === group && (isRegimeOn || !readsRegime(s)),
      );
      for (const theme of themes) {
        const n = shown.filter(s => s.theme === theme).length;
        // A theme whose every screen is hidden has no chip at all; one that shows, shows two or more.
        assert.ok(
          n === 0 ? !isRegimeOn : n >= 2,
          `${group} / ${theme}: ${String(n)} screens (regime ${String(isRegimeOn)})`,
        );
      }
    }
  }
});

test('the groups and theme counts', () => {
  const inGroup = (group: PrebuiltGroup) =>
    PREBUILT_SCREENS.filter(s => s.group === group);
  assert.equal(inGroup('score').length, 7);
  const counts = (group: 'fundamentals' | 'technicals' | 'fno') =>
    Object.fromEntries(
      (PREBUILT_THEMES[group] ?? []).map(theme => [
        theme,
        inGroup(group).filter(s => s.theme === theme).length,
      ]),
    );
  assert.deepEqual(counts('fundamentals'), {
    Growth: 5,
    Quality: 5,
    Value: 5,
    Turnarounds: 2,
    Ownership: 4,
    'Size & price': 3,
  });
  assert.deepEqual(counts('technicals'), {
    Breakouts: 3,
    'Near 52-week high / low': 3,
    Momentum: 2,
    Trend: 4,
    Crossovers: 3,
    Pullbacks: 4,
    Reversals: 2,
    'Overbought / oversold': 3,
    Volume: 2,
  });
  assert.deepEqual(counts('fno'), {
    'Futures buildup': 2,
    Volatility: 3,
    'Option activity': 2,
    'Options regime': 3,
  });
});
