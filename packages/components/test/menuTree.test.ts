import { describe, expect, it } from 'vitest';
import { buildMenuTree, isExpanded, isOnLineage, parentPath, type MenuNode } from '../src/widgets/menuTree';

const fv = (value: string, count: number) => ({ value, count, selected: false });

const RESPONSE = [
  fv('Men', 40),
  fv('Men >>> Shoes', 25),
  fv('Men >>> Shoes >>> Trail', 10),
  fv('Men >>> Shoes >>> Road', 15),
  fv('Men >>> Jackets', 15),
  fv('Women', 30),
  fv('Women >>> Dresses', 30),
];

function find(nodes: MenuNode[], label: string): MenuNode {
  const node = nodes.find((n) => n.label === label);
  expect(node, `node ${label}`).toBeDefined();
  return node!;
}

describe('buildMenuTree — structure', () => {
  it('builds a nested tree from delimited paths', () => {
    const tree = buildMenuTree(RESPONSE);
    expect(tree.map((n) => n.label)).toEqual(['Men', 'Women']);
    const men = find(tree, 'Men');
    expect(men.children.map((n) => n.label)).toEqual(['Shoes', 'Jackets']);
    const shoes = find(men.children, 'Shoes');
    expect(shoes.children.map((n) => n.label)).toEqual(['Road', 'Trail']);
  });

  it('keeps the RAW facet value on every data-backed node (filtering contract)', () => {
    const tree = buildMenuTree([fv('Men>>>Shoes', 5), fv('Men', 9)]); // no spaces around separator
    const shoes = find(find(tree, 'Men').children, 'Shoes');
    expect(shoes.value).toBe('Men>>>Shoes'); // exactly as the index knows it
    expect(shoes.synthesized).toBe(false);
  });

  it('sorts by count desc then label asc at every level', () => {
    const tree = buildMenuTree(RESPONSE);
    expect(tree.map((n) => n.label)).toEqual(['Men', 'Women']); // 40 > 30
    const shoes = find(find(tree, 'Men').children, 'Shoes');
    expect(shoes.children.map((n) => n.count)).toEqual([15, 10]); // Road 15, Trail 10
  });

  it('handles flat (separator-free) values as a single-level tree', () => {
    const tree = buildMenuTree([fv('Sale', 7), fv('New', 3)]);
    expect(tree.map((n) => `${n.label}:${n.count}`)).toEqual(['Sale:7', 'New:3']);
    expect(tree.every((n) => n.children.length === 0)).toBe(true);
  });

  it('supports custom separators', () => {
    const tree = buildMenuTree([fv('A / B', 4), fv('A', 6)], { separator: '/' });
    expect(find(tree, 'A').children[0]!.label).toBe('B');
  });
});

describe('buildMenuTree — counts and synthesis', () => {
  it('synthesizes missing intermediate levels with count = sum of children', () => {
    const tree = buildMenuTree([
      fv('Men >>> Shoes >>> Trail', 10),
      fv('Men >>> Shoes >>> Road', 15),
    ]);
    const men = find(tree, 'Men');
    expect(men.synthesized).toBe(true);
    expect(men.count).toBe(25);
    const shoes = find(men.children, 'Shoes');
    expect(shoes.synthesized).toBe(true);
    expect(shoes.count).toBe(25);
  });

  it('explicit (disjunctive) counts always win over child sums', () => {
    // Multi-category items make parent counts ≠ child sums — never "correct" them.
    const tree = buildMenuTree([fv('Men', 40), fv('Men >>> Shoes', 25), fv('Men >>> Jackets', 20)]);
    expect(find(tree, 'Men').count).toBe(40); // not 45
  });

  it('drops paths deeper than maxDepth and empty values', () => {
    const tree = buildMenuTree(
      [fv('A >>> B >>> C >>> D', 5), fv('A', 9), fv('', 3), fv(' >>> ', 2)],
      { maxDepth: 3 },
    );
    expect(tree.map((n) => n.label)).toEqual(['A']);
    expect(find(tree, 'A').children).toEqual([]);
  });

  it('trims whitespace around segments when deriving labels', () => {
    const tree = buildMenuTree([fv('  Men   >>>   Shoes  ', 5)]);
    const men = find(tree, 'Men');
    expect(find(men.children, 'Shoes').value).toBe('  Men   >>>   Shoes  '); // raw preserved
  });
});

describe('lineage / expansion / parent', () => {
  it('isOnLineage matches self and ancestors only', () => {
    expect(isOnLineage('Men', 'Men')).toBe(true);
    expect(isOnLineage('Men', 'Men >>> Shoes >>> Trail')).toBe(true);
    expect(isOnLineage('Men >>> Shoes', 'Men >>> Shoes >>> Trail')).toBe(true);
    expect(isOnLineage('Men >>> Shoes >>> Trail', 'Men >>> Shoes')).toBe(false); // descendant, not ancestor
    expect(isOnLineage('Women', 'Men >>> Shoes')).toBe(false);
    expect(isOnLineage('Men', null)).toBe(false);
    // segment-boundary safety: "Me" is not an ancestor of "Men"
    expect(isOnLineage('Me', 'Men >>> Shoes')).toBe(false);
  });

  it('lineage comparison is separator-spacing-insensitive', () => {
    expect(isOnLineage('Men>>>Shoes', 'Men >>> Shoes >>> Trail')).toBe(true);
  });

  it('isExpanded: only lineage nodes with children expand', () => {
    const tree = buildMenuTree(RESPONSE);
    const men = find(tree, 'Men');
    const women = find(tree, 'Women');
    expect(isExpanded(men, 'Men >>> Shoes')).toBe(true);
    expect(isExpanded(women, 'Men >>> Shoes')).toBe(false);
    expect(isExpanded(men, null)).toBe(false);
    const trail = find(find(men.children, 'Shoes').children, 'Trail');
    expect(isExpanded(trail, 'Men >>> Shoes >>> Trail')).toBe(false); // no children
  });

  it('parentPath walks up one level; null at root', () => {
    expect(parentPath('Men >>> Shoes >>> Trail')).toBe('Men >>> Shoes');
    expect(parentPath('Men')).toBeNull();
    expect(parentPath('A/B', '/')).toBe('A');
  });
});
