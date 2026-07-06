<script setup lang="ts">
import { computed, useHost } from 'vue';
import type { FacetValue } from '@sparq/search-core';
import { parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';
import { buildMenuTree, isExpanded, type MenuNode } from './menuTree';

type TransformValues = (values: FacetValue[]) => FacetValue[];

interface Row {
  node: MenuNode;
  depth: number;
  parentValue: string | null;
  selected: boolean;
}

// Read config BEFORE registering so the facet attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-menu> requires an attribute="..." attribute.');

const { controller } = useController({ role: 'filters', facetAttribute: attribute ?? undefined });

const header = host.getAttribute('header');
const separator = host.getAttribute('separator') ?? '>>>';
const maxDepth = parseNumAttr(host.getAttribute('max-depth'), 3);

/** Menu semantics: at most one selected path (drill-down). */
const selected = computed<string | null>(() => {
  if (!attribute) return null;
  return controller.value?.state.facetFilters[attribute]?.[0] ?? null;
});

const tree = computed<MenuNode[]>(() => {
  if (!attribute) return [];
  let values = controller.value?.state.results?.facets[attribute] ?? [];
  const transform = (host as HTMLElement & { transformValues?: TransformValues }).transformValues;
  if (transform) values = transform(values) ?? values;
  return buildMenuTree(values, { separator, maxDepth });
});

/** Flatten drill-down-visible nodes: roots always; children of lineage nodes. */
const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  const walk = (nodes: MenuNode[], depth: number, parentValue: string | null) => {
    for (const node of nodes) {
      out.push({ node, depth, parentValue, selected: selected.value === node.value });
      if (isExpanded(node, selected.value, separator)) walk(node.children, depth + 1, node.value);
    }
  };
  walk(tree.value, 0, null);
  return out;
});

function pick(row: Row): void {
  if (!attribute) return;
  const c = controller.value;
  if (!c) return;
  // Clicking the selected node steps back up to its parent (root → clear).
  const next = row.selected ? row.parentValue : row.node.value;
  c.setFacetValues(attribute, next === null ? [] : [next]);
}
</script>

<template>
  <div v-if="rows.length > 0" class="sq-root" part="root">
    <div v-if="header" class="header" part="header">{{ header }}</div>
    <ul class="list" part="list" role="tree" :aria-label="header ?? attribute ?? undefined">
      <li
        v-for="row in rows"
        :key="row.node.value"
        class="item"
        part="item"
        role="none"
      >
        <button
          class="node"
          :class="{ selected: row.selected, branch: row.node.children.length > 0 }"
          :part="row.selected ? 'node node-selected' : 'node'"
          :style="{ paddingLeft: `calc(${row.depth} * var(--sparq-spacing, 8px) * 2 + 6px)` }"
          type="button"
          role="treeitem"
          :aria-level="row.depth + 1"
          :aria-selected="row.selected ? 'true' : 'false'"
          :aria-expanded="row.node.children.length > 0 ? (isExpanded(row.node, selected, separator) ? 'true' : 'false') : undefined"
          @click="pick(row)"
        >
          <span class="arrow" :class="{ open: isExpanded(row.node, selected, separator) }" aria-hidden="true">
            {{ row.node.children.length > 0 ? '›' : '' }}
          </span>
          <span class="label">{{ row.node.label }}</span>
          <span class="count" part="count">{{ row.node.count }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>

<style>
.header {
  font-weight: 600;
  margin-bottom: calc(var(--sparq-spacing, 8px));
}
.list {
  list-style: none;
}
.node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 6px;
  border-radius: var(--sparq-radius-sm, 4px);
  text-align: left;
}
.node:hover {
  background: var(--sparq-color-bg-elevated, #f3f4f6);
}
.node.selected {
  color: var(--sparq-color-primary, #2563eb);
  font-weight: 600;
}
.arrow {
  width: 0.9em;
  flex: none;
  color: var(--sparq-color-text-muted, #6b7280);
  transition: transform 0.12s ease;
}
.arrow.open {
  transform: rotate(90deg);
}
.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.85em;
}
</style>
