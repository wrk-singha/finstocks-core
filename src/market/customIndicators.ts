import type {
  CustomIndicator,
  CustomIndicatorDefinition,
  CustomIndicatorDraft,
  SaveCustomIndicatorRequest,
} from '../types/customIndicator.ts';

/**
 * What a draft saves: its definition alone. The lists are read defensively because the card's
 * payload is what the model sent, and a draft with nothing to say leaves them out.
 */
export function customIndicatorDefinition(
  draft: CustomIndicatorDraft,
): CustomIndicatorDefinition {
  return {
    pane: draft.pane,
    inputs: draft.inputs ?? [],
    plots: draft.plots ?? [],
    ...(draft.levels === undefined ? {} : {levels: draft.levels}),
    ...(draft.skipped === undefined ? {} : {skipped: draft.skipped}),
    spec: draft.spec ?? {},
  };
}

/** The body that keeps a draft; `chatId` files it under the thread it was built in. */
export function customIndicatorSaveRequest(
  draft: CustomIndicatorDraft,
  chatId?: string,
): SaveCustomIndicatorRequest {
  return {
    draft_id: draft.draft_id,
    name: draft.name,
    description: draft.description,
    source_format: draft.source_format,
    ...(draft.source_label === undefined
      ? {}
      : {source_label: draft.source_label}),
    definition: customIndicatorDefinition(draft),
    ...(chatId === undefined ? {} : {chat_id: chatId}),
  };
}

const byCodeUnit = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

// Postgres jsonb does not keep key order, so the saved copy is compared with its keys sorted —
// otherwise every reload would read as "changed since saved".
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => byCodeUnit(a, b)),
        )
      : inner,
  );

/**
 * Whether `saved` is this version of the draft: the same name and the same definition. A saved row
 * with the draft's id that is not this version is an earlier one, which saving this would replace.
 */
export const isSavedVersion = (
  saved: CustomIndicator,
  draft: CustomIndicatorDraft,
): boolean =>
  saved.name === draft.name &&
  stableJson(saved.definition) === stableJson(customIndicatorDefinition(draft));

/** The saved row for a card's draft, if that draft has been saved. */
export const savedCustomIndicator = (
  rows: readonly CustomIndicator[],
  draftId: string,
): CustomIndicator | undefined => rows.find(row => row.draft_id === draftId);

/**
 * The list after a save: the row on top, since the list reads newest first, in place of any copy
 * of it — a saved refinement replaces its row rather than adding one.
 */
export const upsertCustomIndicator = (
  rows: readonly CustomIndicator[],
  row: CustomIndicator,
): CustomIndicator[] => [row, ...rows.filter(entry => entry.id !== row.id)];

/** The list after a rename: the row keeps its place. */
export const replaceCustomIndicator = (
  rows: readonly CustomIndicator[],
  row: CustomIndicator,
): CustomIndicator[] => rows.map(entry => (entry.id === row.id ? row : entry));

/** The Custom tab's search: the name or the description holds what was typed, in any case. */
export function customIndicatorMatches(
  row: CustomIndicator,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  return (
    needle === '' ||
    row.name.toLocaleLowerCase().includes(needle) ||
    row.description.toLocaleLowerCase().includes(needle)
  );
}
