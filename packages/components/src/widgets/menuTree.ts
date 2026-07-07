import type { FacetValue } from '@sparq/search-core';

/**
 * Pure logic behind <sparq-menu> — hierarchical facet paths ("Men >>> Shoes
 * >>> Trail") into a drill-down tree. Unit-tested in isolation.
 *
 * Data convention (same as store-ui/Algolia): each item's facet attribute
 * carries its FULL ancestor chain ("Men", "Men >>> Shoes", "Men >>> Shoes >>>
 * Trail"), so selecting any node filters by exact facet value and counts for
 * every level arrive in the one facet response.
 */

export interface MenuNode {
  /** Display label: the last path segment. */
  label: string;
  /**
   * The RAW facet value used for filtering. Taken verbatim from the response
   * when present; reconstructed for synthesized intermediate nodes (see
   * `synthesized`).
   */
  value: string;
  count: number;
  /** True when the level was absent from the data and derived from children. */
  synthesized: boolean;
  children: MenuNode[];
}

interface BuildOptions {
  separator?: string;
  maxDepth?: number;
}

interface MutableNode extends MenuNode {
  children: MutableNode[];
  childIndex: Map<string, MutableNode>;
  explicitCount: boolean;
}

function splitPath(value: string, separator: string): string[] {
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build the tree from the flat facet response. Nodes present in the data keep
 * their raw value and explicit (disjunctive) count; missing intermediate
 * levels are synthesized with count = sum of children.
 */
export function buildMenuTree(values: FacetValue[], opts: BuildOptions = {}): MenuNode[] {
  const separator = opts.separator ?? '>>>';
  const maxDepth = opts.maxDepth ?? 3;

  const rootIndex = new Map<string, MutableNode>();
  const roots: MutableNode[] = [];

  const nodeFor = (segments: string[]): MutableNode | null => {
    let index = rootIndex;
    let siblings = roots;
    let node: MutableNode | null = null;
    for (let depth = 0; depth < segments.length && depth < maxDepth; depth++) {
      const label = segments[depth]!;
      let next = index.get(label);
      if (!next) {
        next = {
          label,
          value: segments.slice(0, depth + 1).join(` ${separator} `),
          count: 0,
          synthesized: true,
          explicitCount: false,
          children: [],
          childIndex: new Map(),
        };
        index.set(label, next);
        siblings.push(next);
      }
      node = next;
      index = next.childIndex;
      siblings = next.children;
    }
    return node;
  };

  for (const { value, count } of values) {
    const segments = splitPath(value, separator);
    if (segments.length === 0 || segments.length > maxDepth) continue;
    const node = nodeFor(segments);
    if (!node) continue;
    node.count = count;
    node.synthesized = false;
    node.explicitCount = true;
    node.value = value; // preserve the exact raw value for filtering
  }

  const finalize = (nodes: MutableNode[]): MenuNode[] => {
    for (const node of nodes) {
      if (!node.explicitCount) {
        node.count = node.children.reduce(
          (sum, child) => sum + (child.explicitCount ? child.count : sumTree(child)),
          0,
        );
      }
    }
    nodes.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    return nodes.map(({ childIndex: _drop, explicitCount: _drop2, children, ...node }) => ({
      ...node,
      children: finalize(children),
    }));
  };

  // Bottom-up sum for chains of synthesized nodes (computed before finalize
  // rewrites children, so it walks the mutable tree).
  const sumTree = (node: MutableNode): number =>
    node.explicitCount ? node.count : node.children.reduce((sum, child) => sum + sumTree(child), 0);

  return finalize(roots);
}

/** Is `ancestor` the same node as — or an ancestor of — `path`? */
export function isOnLineage(ancestor: string, path: string | null, separator = '>>>'): boolean {
  if (path === null) return false;
  if (path === ancestor) return true;
  const ancestorSegs = splitPath(ancestor, separator);
  const pathSegs = splitPath(path, separator);
  if (ancestorSegs.length >= pathSegs.length) return false;
  return ancestorSegs.every((seg, i) => pathSegs[i] === seg);
}

/**
 * Drill-down visibility: root nodes always render; a node's children render
 * only while that node sits on the selected lineage.
 */
export function isExpanded(node: MenuNode, selected: string | null, separator = '>>>'): boolean {
  return node.children.length > 0 && isOnLineage(node.value, selected, separator);
}

/** The parent path of a raw value, or null at root level. */
export function parentPath(value: string, separator = '>>>'): string | null {
  const segments = splitPath(value, separator);
  if (segments.length <= 1) return null;
  return segments.slice(0, -1).join(` ${separator} `);
}
