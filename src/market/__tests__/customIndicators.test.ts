import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  CustomIndicator,
  CustomIndicatorDraft,
} from '../../types/customIndicator.ts';
import {
  customIndicatorDefinition,
  customIndicatorMatches,
  customIndicatorSaveRequest,
  isSavedVersion,
  replaceCustomIndicator,
  savedCustomIndicator,
  upsertCustomIndicator,
} from '../customIndicators.ts';

const draft: CustomIndicatorDraft = {
  draft_id: 'sample-vwrsi',
  name: 'Volume-weighted RSI',
  description: 'RSI of a volume-weighted average of the close.',
  source_format: 'pine',
  source_label: 'Pine Script v5',
  status: 'ready',
  pane: 'separate',
  inputs: [
    {id: 'length', label: 'Length', type: 'integer', default: 14, min: 2},
  ],
  plots: [{id: 'vwrsi', label: 'VW RSI', style: 'line', color: '#7E57C2'}],
  levels: [{value: 70, label: 'Overbought'}],
  spec: {
    v: 1,
    plots: {vwrsi: {fn: 'rsi', args: [{src: 'close'}, {input: 'length'}]}},
  },
};

const savedFrom = (
  source: CustomIndicatorDraft,
  id = 'ci-1',
  createdAt = '2026-09-25T10:00:00Z',
): CustomIndicator => ({
  id,
  draft_id: source.draft_id,
  name: source.name,
  description: source.description,
  source_format: source.source_format,
  source_label: source.source_label ?? '',
  definition: customIndicatorDefinition(source),
  chat_id: 'chat-1',
  created_at: createdAt,
  updated_at: createdAt,
});

test('a draft saves its definition alone, with the lists it left out filled in', () => {
  assert.deepEqual(customIndicatorDefinition(draft), {
    pane: 'separate',
    inputs: draft.inputs,
    plots: draft.plots,
    levels: draft.levels,
    spec: draft.spec,
  });
  const bare = {
    ...draft,
    inputs: undefined,
    plots: undefined,
    levels: undefined,
    spec: undefined,
    skipped: [{what: 'alertcondition()', why: 'not supported'}],
  } as unknown as CustomIndicatorDraft;
  assert.deepEqual(customIndicatorDefinition(bare), {
    pane: 'separate',
    inputs: [],
    plots: [],
    skipped: [{what: 'alertcondition()', why: 'not supported'}],
    spec: {},
  });
});

test('the save body carries the draft’s identity and names its chat only when there is one', () => {
  assert.deepEqual(customIndicatorSaveRequest(draft, 'chat-9'), {
    draft_id: 'sample-vwrsi',
    name: 'Volume-weighted RSI',
    description: 'RSI of a volume-weighted average of the close.',
    source_format: 'pine',
    source_label: 'Pine Script v5',
    definition: customIndicatorDefinition(draft),
    chat_id: 'chat-9',
  });
  const english: CustomIndicatorDraft = {...draft, source_format: 'english'};
  delete english.source_label;
  const body = customIndicatorSaveRequest(english);
  assert.equal('source_label' in body, false);
  assert.equal('chat_id' in body, false);
});

test('the saved version is this one whatever order the server kept its keys in', () => {
  const saved = savedFrom(draft);
  assert.equal(isSavedVersion(saved, draft), true);

  // What Postgres jsonb hands back: every object's keys in its own order, arrays untouched.
  const reordered: CustomIndicator = {
    ...saved,
    definition: JSON.parse(
      '{"spec":{"plots":{"vwrsi":{"args":[{"src":"close"},{"input":"length"}],"fn":"rsi"}},"v":1},' +
        '"plots":[{"style":"line","label":"VW RSI","id":"vwrsi","color":"#7E57C2"}],' +
        '"pane":"separate","levels":[{"label":"Overbought","value":70}],' +
        '"inputs":[{"type":"integer","min":2,"label":"Length","id":"length","default":14}]}',
    ) as CustomIndicator['definition'],
  };
  assert.equal(isSavedVersion(reordered, draft), true);
});

test('a refinement or a rename is an earlier version, not this one', () => {
  const saved = savedFrom(draft);
  const longer: CustomIndicatorDraft = {
    ...draft,
    inputs: draft.inputs.map(input => ({...input, default: 21})),
  };
  assert.equal(isSavedVersion(saved, longer), false);
  assert.equal(isSavedVersion({...saved, name: 'My RSI'}, draft), false);
  // Order inside an array is meaning (the plots are drawn in it), so it is not sorted away.
  const twoPlots: CustomIndicatorDraft = {
    ...draft,
    plots: [
      {id: 'a', label: 'A', style: 'line'},
      {id: 'b', label: 'B', style: 'mark_below'},
    ],
  };
  const swapped = savedFrom({
    ...twoPlots,
    plots: [...twoPlots.plots].reverse(),
  });
  assert.equal(isSavedVersion(swapped, twoPlots), false);
});

test('a draft finds its saved row by draft id', () => {
  const rows = [
    savedFrom(draft),
    savedFrom({...draft, draft_id: 'other'}, 'ci-2'),
  ];
  assert.equal(savedCustomIndicator(rows, 'sample-vwrsi')?.id, 'ci-1');
  assert.equal(savedCustomIndicator(rows, 'missing'), undefined);
});

test('a save puts its row on top in place of any copy, and a rename keeps its place', () => {
  const first = savedFrom(draft, 'ci-1');
  const second = savedFrom({...draft, draft_id: 'd-2'}, 'ci-2');
  const third = savedFrom({...draft, draft_id: 'd-3'}, 'ci-3');
  const rows = [third, second, first];

  const updated = {...first, name: 'Updated'};
  assert.deepEqual(
    upsertCustomIndicator(rows, updated).map(row => row.id),
    ['ci-1', 'ci-3', 'ci-2'],
  );
  const fresh = savedFrom({...draft, draft_id: 'd-4'}, 'ci-4');
  assert.deepEqual(
    upsertCustomIndicator(rows, fresh).map(row => row.id),
    ['ci-4', 'ci-3', 'ci-2', 'ci-1'],
  );

  const renamed = {...second, name: 'Renamed'};
  const after = replaceCustomIndicator(rows, renamed);
  assert.deepEqual(
    after.map(row => row.id),
    ['ci-3', 'ci-2', 'ci-1'],
  );
  assert.equal(after[1]?.name, 'Renamed');
});

test('the search matches the name or the description, trimmed and in any case', () => {
  const row = savedFrom(draft);
  assert.equal(customIndicatorMatches(row, ''), true);
  assert.equal(customIndicatorMatches(row, '   '), true);
  assert.equal(customIndicatorMatches(row, ' volume-WEIGHTED '), true);
  assert.equal(customIndicatorMatches(row, 'average of the'), true);
  assert.equal(customIndicatorMatches(row, 'macd'), false);
});
