import assert from 'node:assert/strict';
import {test} from 'node:test';

import type {IndustryNode} from '../../types/industries.ts';
import {
  indexTree,
  matchingNodes,
  nodeName,
  nodeState,
  selectedCount,
  toggleNode,
} from '../industrySelection.ts';

const node = (
  id: string,
  name: string,
  count: number,
  children?: IndustryNode[],
): IndustryNode => ({
  id,
  name,
  level: id.split('/').length,
  count,
  ...(children ? {children} : {}),
});

const FIN = 'financial-services';
const BANKS = `${FIN}/banks`;
const PRIVATE = `${BANKS}/private-sector-bank`;
const PUBLIC = `${BANKS}/public-sector-bank`;
const NBFC = `${FIN}/finance`;
const IT = 'information-technology';

const tree = indexTree([
  node(FIN, 'Financial Services', 9, [
    node(BANKS, 'Banks', 6, [
      node(PRIVATE, 'Private Sector Bank', 4),
      node(PUBLIC, 'Public Sector Bank', 2),
    ]),
    node(NBFC, 'Finance', 3),
  ]),
  node(IT, 'Information Technology', 5),
]);

test('the index knows every node, its parent and its depth', () => {
  assert.equal(tree.byId.size, 6);
  assert.deepEqual(tree.byId.get(PRIVATE)?.parent, BANKS);
  assert.equal(tree.byId.get(PRIVATE)?.depth, 2);
  assert.equal(tree.byId.get(FIN)?.parent, null);
  assert.equal(tree.roots.length, 2);
  assert.equal(indexTree(undefined).byId.size, 0);
});

test('choosing every child stands the parent in for them, level by level', () => {
  let selected = toggleNode(tree, [], PRIVATE);
  assert.deepEqual(selected, [PRIVATE]);
  selected = toggleNode(tree, selected, PUBLIC);
  assert.deepEqual(selected, [BANKS]);
  selected = toggleNode(tree, selected, NBFC);
  assert.deepEqual(selected, [FIN]);
  assert.equal(selectedCount(tree, selected), 9);
});

test('unchecking one industry inside a chosen sector keeps the rest of it', () => {
  assert.deepEqual(toggleNode(tree, [FIN, IT], PUBLIC), [IT, NBFC, PRIVATE]);
  assert.deepEqual(toggleNode(tree, [FIN], FIN), []);
});

test('choosing a parent replaces the children already chosen under it', () => {
  assert.deepEqual(toggleNode(tree, [PRIVATE, IT], FIN), [IT, FIN]);
});

test('a node reads on, partial or off from the chosen set', () => {
  assert.equal(nodeState(tree, [BANKS], PRIVATE), 'on');
  assert.equal(nodeState(tree, [BANKS], BANKS), 'on');
  assert.equal(nodeState(tree, [BANKS], FIN), 'partial');
  assert.equal(nodeState(tree, [BANKS], NBFC), 'off');
  assert.equal(nodeState(tree, [PRIVATE], FIN), 'partial');
  assert.equal(nodeState(tree, [], 'unknown'), 'off');
});

test('the count covers the chosen nodes, and a name falls back to its id', () => {
  assert.equal(selectedCount(tree, [BANKS, IT]), 11);
  assert.equal(selectedCount(tree, ['gone']), 0);
  assert.equal(nodeName(tree, BANKS), 'Banks');
  assert.equal(nodeName(tree, 'gone'), 'gone');
});

test('a search keeps each match with the ancestors that place it', () => {
  assert.deepEqual(
    [...matchingNodes(tree, ' private ')].sort(),
    [FIN, BANKS, PRIVATE].sort(),
  );
  assert.deepEqual(
    [...matchingNodes(tree, 'BANK')].sort(),
    [FIN, BANKS, PRIVATE, PUBLIC].sort(),
  );
  assert.equal(matchingNodes(tree, '  ').size, 0);
});

test('a tree that repeats an id cannot hang the walk up it', () => {
  // The later copies win the index, so 'a' and 'b' end up each other's parent.
  const looped = indexTree([
    node('a', 'A', 2, [
      node('b', 'B', 2, [node('a', 'A', 1, [node('b', 'B', 1)])]),
    ]),
  ]);
  assert.equal(looped.byId.get('a')?.parent, 'b');
  assert.equal(looped.byId.get('b')?.parent, 'a');
  assert.equal(nodeState(looped, [], 'a'), 'off');
  assert.equal(nodeState(looped, ['b'], 'a'), 'on');
  assert.deepEqual(toggleNode(looped, [], 'b'), ['a']);
  assert.deepEqual([...matchingNodes(looped, 'a')].sort(), ['a', 'b']);
});
