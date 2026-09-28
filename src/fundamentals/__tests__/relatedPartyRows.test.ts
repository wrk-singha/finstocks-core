import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {
  RelatedPartyColumn,
  RelatedPartyResponse,
  RelatedPartyRow,
} from '../../types/relatedParty.ts';
import {
  buildRelatedPartyRows,
  RELATED_PARTY_TOP,
  relatedPartyHalf,
} from '../relatedPartyRows.ts';

const party = (
  name: string,
  relationship: string,
  txns: RelatedPartyRow['txns'] = [{type: 'Sale of goods', values: [10, 20]}],
): RelatedPartyRow => ({
  name,
  relationship,
  total: 30,
  values: [10, 20],
  txns,
});

const table = (parties: RelatedPartyRow[]): RelatedPartyResponse => ({
  symbol: 'RELIANCE',
  company_name: 'Reliance Industries',
  fincode: 100_325,
  basis: 'C',
  columns: [],
  parties,
  experimental: false,
});

const column = (periodEnd: number, partial: boolean): RelatedPartyColumn => ({
  key: String(periodEnd),
  label: String(periodEnd),
  period_end: periodEnd,
  months: partial ? 6 : 12,
  source: 'exchange_rpt',
  experimental: false,
  partial,
  sources: [],
});

test('each party reads as its name and relationship, whole crore, with what it traded behind the "+"', () => {
  const [row] = buildRelatedPartyRows(
    table([
      party('Aranya Commercials LLP', 'Promoter group', [
        {type: 'Dividend paid', values: [120, 130]},
        {type: 'Rent received', values: [null, 2]},
      ]),
    ]),
  );
  assert.deepEqual(row, {
    id: 'party-0',
    label: 'Aranya Commercials LLP · Promoter group',
    hint: 'Aranya Commercials LLP (Promoter group)',
    kind: 'count',
    values: [10, 20],
    children: [
      {
        id: 'party-0-0',
        label: 'Dividend paid',
        kind: 'count',
        values: [120, 130],
      },
      {
        id: 'party-0-1',
        label: 'Rent received',
        kind: 'count',
        values: [null, 2],
      },
    ],
  });
});

test('a long name is cut at 34 characters so the figures keep their place, and the hint keeps it whole', () => {
  const name = 'Nirmaan Infrastructure Investment Trust';
  const [row] = buildRelatedPartyRows(table([party(name, 'Associate')]));
  assert.equal(row?.label, 'Nirmaan Infrastructure Investment… · Associate');
  assert.equal(row?.hint, `${name} (Associate)`);
  const [exact] = buildRelatedPartyRows(
    table([party('A'.repeat(34), 'Associate')]),
  );
  assert.equal(exact?.label, `${'A'.repeat(34)} · Associate`);
});

test('a party with no relationship is its name alone, and one with nothing itemised offers no "+"', () => {
  const [row] = buildRelatedPartyRows(table([party('Anita Rao', '', [])]));
  assert.equal(row?.label, 'Anita Rao');
  assert.equal(row?.hint, 'Anita Rao');
  assert.equal(row !== undefined && 'children' in row, false);
});

test('the largest fifteen parties come first, in the order served, and a limit shows more', () => {
  const parties = Array.from({length: 18}, (_, i) =>
    party(`Party ${String(i + 1)}`, 'Associate'),
  );
  const top = buildRelatedPartyRows(table(parties));
  assert.equal(RELATED_PARTY_TOP, 15);
  assert.equal(top.length, 15);
  assert.equal(top[0]?.label, 'Party 1 · Associate');
  assert.equal(top.at(-1)?.label, 'Party 15 · Associate');
  assert.equal(
    buildRelatedPartyRows(table(parties), parties.length).length,
    18,
  );
  assert.deepEqual(buildRelatedPartyRows(table([])), []);
});

test('a lone half-year names its half and the fiscal year it falls in, which ends in March', () => {
  assert.equal(relatedPartyHalf(column(202603, false)), null);
  assert.deepEqual(relatedPartyHalf(column(202409, true)), {
    half: 1,
    fiscalYear: 2025,
  });
  assert.deepEqual(relatedPartyHalf(column(202503, true)), {
    half: 2,
    fiscalYear: 2025,
  });
  // A half closing in December still ends before the fiscal year's March.
  assert.deepEqual(relatedPartyHalf(column(202412, true)), {
    half: 1,
    fiscalYear: 2025,
  });
});
