import assert from 'node:assert/strict';
import {test} from 'node:test';

import {PREBUILT_SCREENS} from '../../data/prebuiltScreens.ts';
import type {PrebuiltScreen} from '../../data/prebuiltScreens.ts';
import type {ScreenFilter} from '../../types/screen.ts';
import {
  decodeScreen,
  EMPTY_SCREEN,
  encodeScreen,
  isActiveFilter,
  type ScreenState,
} from '../screenModel.ts';
import {
  describeSavedScreen,
  footerFields,
  isBookmarkCopy,
  latestMatch,
  matchesQuery,
  prebuiltScreenState,
  rawCondition,
  rawConditionParts,
  savedScreenParts,
  screenFields,
  searchScreens,
  splitFilterText,
  stockScreenKey,
  stockScreenKeyOf,
  uniqueName,
} from '../screenerHome.ts';

const preset = (id: string): PrebuiltScreen => {
  const found = PREBUILT_SCREENS.find(s => s.id === id);
  assert.ok(found, id);
  return found;
};

test('a prebuilt screen opens as its own filters, columns and sort, marked with its id', () => {
  assert.deepEqual(prebuiltScreenState(preset('golden-cross')), {
    ...EMPTY_SCREEN,
    universes: [],
    filters: preset('golden-cross').filters,
    columns: preset('golden-cross').columns ?? [],
    sort: preset('golden-cross').sort ?? EMPTY_SCREEN.sort,
    preset: 'golden-cross',
  });
  const esf = prebuiltScreenState(preset('esf-fair-price'));
  assert.deepEqual(esf.sort, {key: 'esf_peg', dir: 'asc'});
  assert.deepEqual(esf.columns, ['esf_peg', 'esf_score']);
});

test('search: every word, any order, name or blurb, case and accents aside', () => {
  const text = 'Golden cross · The 50-day average crossed above';
  assert.ok(matchesQuery(text, 'golden'));
  assert.ok(matchesQuery(text, 'ABOVE golden'));
  assert.ok(matchesQuery('Café growers', 'cafe'));
  assert.ok(!matchesQuery('Golden cross', 'golden death'));
  assert.ok(
    !matchesQuery('Golden cross', '   '),
    'an empty query is no search, not every screen',
  );
  const ids = (q: string) => searchScreens(PREBUILT_SCREENS, q).map(s => s.id);
  assert.deepEqual(ids('golden'), ['golden-cross']);
  assert.ok(ids('52-week high').includes('52w-breakout'));
  assert.ok(ids('promoter').includes('promoter-buying'), 'matches the name');
  assert.ok(ids('greenblatt').includes('magic-formula'), 'matches the blurb');
  assert.deepEqual(ids('nothing like this'), []);
});

test('card footer: the fields asked, compared-with ones too, first three then +N more', () => {
  assert.deepEqual(screenFields(preset('ema-stack-up').filters), [
    'close',
    'ema20',
    'ema50',
    'ema200',
    'traded_value20',
  ]);
  assert.deepEqual(
    screenFields(preset('stoch-oversold-turn').filters),
    ['stoch_k', 'ind.stochastic_d_3', 'traded_value20'],
    'a field asked twice counts once',
  );
  assert.deepEqual(
    footerFields(['Close', 'EMA 20', 'EMA 50', 'EMA 200', 'Avg Value']),
    {shown: ['Close', 'EMA 20', 'EMA 50'], more: 2},
  );
  assert.deepEqual(footerFields(['RSI', 'Avg Value']), {
    shown: ['RSI', 'Avg Value'],
    more: 0,
  });
  assert.deepEqual(
    footerFields(['RSI', 'RSI', 'Profit'], 1),
    {shown: ['RSI'], more: 1},
    'a repeated name counts once',
  );
  assert.deepEqual(footerFields(['', ' ', 'RSI']), {shown: ['RSI'], more: 0});
  assert.deepEqual(footerFields([]), {shown: [], more: 0});
});

test("a screen's key is what it asks: it survives a link, ignores columns and sort, and sees a changed bound", () => {
  const key = (state: ScreenState) =>
    stockScreenKey(state, state.filters.filter(isActiveFilter));
  for (const screen of PREBUILT_SCREENS) {
    const state = prebuiltScreenState(screen);
    const back = decodeScreen(encodeScreen(state));
    assert.ok(back, screen.id);
    assert.equal(key(back), key(state), screen.id);
    assert.equal(stockScreenKeyOf(state), key(state), screen.id);
    assert.equal(
      key({
        ...state,
        columns: ['pe'],
        sort: {key: 'pe', dir: 'asc'},
        preset: undefined,
      }),
      key(state),
    );
  }
  const growers = prebuiltScreenState(preset('quarterly-growers'));
  const loosened = {
    ...growers,
    filters: growers.filters.map((f, i) => (i === 0 ? {...f, min: 10} : f)),
  };
  assert.notEqual(key(loosened), key(growers));
  const reordered = {
    ...growers,
    filters: growers.filters.map((f): ScreenFilter => ({
      min: f.min,
      field: f.field,
    })),
  };
  assert.equal(
    key(reordered),
    key(growers),
    "the order of a filter's own keys does not matter",
  );
  const withBlank = {...growers, filters: [...growers.filters, {field: 'pe'}]};
  assert.equal(
    key(withBlank),
    key(growers),
    'a filter with no bound asks nothing',
  );
  assert.notEqual(key({...growers, universes: ['nifty50']}), key(growers));
  assert.notEqual(key({...growers, industries: ['banks']}), key(growers));
  assert.notEqual(
    stockScreenKey({universes: [], industries: [], symbols: ['TCS']}, []),
    stockScreenKey({universes: [], industries: [], symbols: ['INFY']}, []),
  );
  assert.equal(
    stockScreenKey({universes: [], industries: []}, []),
    stockScreenKey({universes: [], industries: [], symbols: []}, []),
    'no fixed list is an empty one',
  );
});

test('a bookmark never overwrites another screen of the same name', () => {
  assert.equal(uniqueName('Golden cross', []), 'Golden cross');
  assert.equal(
    uniqueName('Golden cross', ['golden CROSS']),
    'Golden cross (2)',
  );
  assert.equal(
    uniqueName('Golden cross', ['Golden cross', 'Golden cross (2)']),
    'Golden cross (3)',
  );
});

test("a card's bookmark removes only the copy it made, never one the reader named", () => {
  assert.ok(isBookmarkCopy('Golden cross', 'Golden cross'));
  assert.ok(isBookmarkCopy('golden CROSS ', 'Golden cross'));
  assert.ok(
    isBookmarkCopy('Golden cross (2)', 'Golden cross'),
    'the numbered fallback uniqueName gives',
  );
  assert.ok(
    isBookmarkCopy(
      uniqueName('Golden cross', ['Golden cross']),
      'Golden cross',
    ),
  );
  assert.ok(!isBookmarkCopy('My golden cross', 'Golden cross'));
  assert.ok(!isBookmarkCopy('Golden cross weekly', 'Golden cross'));
  assert.ok(!isBookmarkCopy('Golden cross (copy)', 'Golden cross'));
  assert.ok(!isBookmarkCopy('Golden', 'Golden cross'));
});

test('of several saved copies, the one saved last names the page', () => {
  const saved = [
    {id: 'a', savedAt: 1, ok: true},
    {id: 'b', savedAt: 3, ok: true},
    {id: 'c', savedAt: 5, ok: false},
  ];
  assert.equal(latestMatch(saved, s => s.ok)?.id, 'b');
  assert.equal(
    latestMatch(saved, () => false),
    undefined,
  );
  assert.equal(
    latestMatch(
      [
        {id: 'x', savedAt: 2},
        {id: 'y', savedAt: 2},
      ],
      () => true,
    )?.id,
    'y',
    'of two saved at once, the later in the list',
  );
});

test("the Filters pane cuts each chip's words into a label and a value", () => {
  assert.deepEqual(splitFilterText('RSI (14) < 35', 'RSI (14)', false), {
    label: 'RSI (14)',
    value: '< 35',
  });
  assert.deepEqual(
    splitFilterText('RSI (14) · Oversold < 30', 'RSI (14)', false),
    {label: 'RSI (14)', value: 'Oversold < 30'},
  );
  assert.deepEqual(splitFilterText('Above SMA 200', 'Above SMA 200', true), {
    label: 'Above SMA 200',
    value: 'Yes',
  });
  assert.deepEqual(
    splitFilterText('Not above sma 200', 'Above SMA 200', true),
    {label: 'Above SMA 200', value: 'No'},
  );
  assert.deepEqual(splitFilterText('EMA 20 > EMA 50', 'EMA 20', false), {
    label: 'EMA 20',
    value: '> EMA 50',
  });
  assert.deepEqual(
    splitFilterText(
      'Bullish engulfing · latest bar',
      'Bullish engulfing',
      false,
    ),
    {label: 'Bullish engulfing', value: 'latest bar'},
  );
  // Words it cannot cut cleanly are shown whole, never reworded.
  assert.deepEqual(
    splitFilterText(
      'No Bullish engulfing · last 30 bars',
      'Bullish engulfing',
      false,
    ),
    {label: 'Bullish engulfing', value: 'No Bullish engulfing · last 30 bars'},
  );
});

test("only a yes/no field's bare name reads Yes; an unnamed field shows its stored condition", () => {
  // With the catalogue failed, filterLabel returns the raw id for both the name and the whole chip.
  assert.deepEqual(splitFilterText('qtr_sales_var', 'qtr_sales_var', false), {
    label: 'qtr_sales_var',
    value: 'qtr_sales_var',
  });
  assert.equal(rawCondition({field: 'qtr_sales_var', min: 15}), '> 15');
  assert.equal(rawCondition({field: 'rsi14', max: 30}), '< 30');
  assert.equal(rawCondition({field: 'dist_ema20', min: 0, max: 2}), '0 – 2');
  assert.equal(
    rawCondition({field: 'ema20', op: 'gt', ref: 'ema50', factor: 1}),
    '> ema50',
  );
  assert.equal(
    rawCondition({
      field: 'cash_and_bank',
      op: 'gt',
      ref: 'market_cap',
      factor: 0.2,
    }),
    '> 0.2 × market_cap',
  );
  assert.equal(
    rawCondition({field: 'close', op: 'lt', ref: 'ema20'}),
    '< ema20',
  );
  assert.equal(rawCondition({field: 'golden_cross', flag: true}), 'Yes');
  assert.equal(rawCondition({field: 'golden_cross', flag: false}), 'No');
  assert.equal(
    rawCondition({field: 'pat.bullish_engulfing', flag: true, max: 0}),
    'Condition could not be loaded',
    "a pattern's window is not guessed",
  );
  assert.equal(rawCondition({field: 'pe'}), 'Incomplete — choose a value');
  assert.deepEqual(
    rawConditionParts({field: 'ema20', op: 'lt', ref: 'ema50', factor: 0.98}),
    {kind: 'compare', op: 'lt', factor: 0.98, ref: 'ema50'},
  );
  for (const screen of PREBUILT_SCREENS) {
    for (const f of screen.filters) {
      if (f.flag == null || f.ref || f.min != null || f.max != null) {
        assert.notEqual(rawCondition(f), 'Yes', `${screen.id} ${f.field}`);
      }
    }
  }
});

test('a saved screen describes itself by its filters, or by the names the chat saved', () => {
  const state = {...EMPTY_SCREEN, filters: [{field: 'pe', max: 20}]};
  assert.equal(describeSavedScreen({state}), '1 filter');
  assert.equal(
    describeSavedScreen({
      state: {...state, filters: [...state.filters, {field: 'roe', min: 15}]},
    }),
    '2 filters',
  );
  assert.equal(
    describeSavedScreen({state: {...EMPTY_SCREEN, symbols: ['TCS', 'INFY']}}),
    '2 stocks saved from the chat',
  );
  assert.deepEqual(
    savedScreenParts({state: {...EMPTY_SCREEN, symbols: ['TCS']}}),
    {
      kind: 'fixedList',
      count: 1,
    },
  );
  assert.deepEqual(
    savedScreenParts({state: EMPTY_SCREEN, options: {filters: [1, 2, 3]}}),
    {kind: 'filters', count: 3},
    "an options screen counts the options screen's filters",
  );
});
