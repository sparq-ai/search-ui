<script setup lang="ts">
import { computed, ref, useHost } from 'vue';
import type { FacetValue } from '@sparq/search-core';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';

type TransformValues = (values: FacetValue[]) => FacetValue[];

// Read config BEFORE registering so the facet attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-filters> requires an attribute="..." attribute.');

const { controller } = useController({ role: 'filters', facetAttribute: attribute ?? undefined });

const header = host.getAttribute('header');
const limit = parseNumAttr(host.getAttribute('limit'), 10);
const showMore = parseBoolAttr(host.getAttribute('show-more'));
const searchable = parseBoolAttr(host.getAttribute('searchable'));
const sortBy = host.getAttribute('sort-by') === 'alpha' ? 'alpha' : 'count';

const expanded = ref(false);
const searchTerm = ref('');

const values = computed<FacetValue[]>(() => {
  if (!attribute) return [];
  let vals = controller.value?.state.results?.facets[attribute] ?? [];
  const transform = (host as HTMLElement & { transformValues?: TransformValues }).transformValues;
  if (transform) vals = transform(vals) ?? vals;
  if (searchTerm.value) {
    const t = searchTerm.value.toLowerCase();
    vals = vals.filter((v) => v.value.toLowerCase().includes(t));
  }
  if (sortBy === 'alpha') vals = [...vals].sort((a, b) => a.value.localeCompare(b.value));
  return vals;
});

const visible = computed(() => (expanded.value ? values.value : values.value.slice(0, limit)));
const hasMore = computed(() => showMore && values.value.length > limit);

function toggle(value: string): void {
  if (attribute) controller.value?.toggleFacetValue(attribute, value);
}
</script>

<template>
  <div v-if="values.length > 0 || searchTerm" class="sq-root" part="root">
    <div v-if="header" class="header" part="header">{{ header }}</div>
    <input
      v-if="searchable"
      class="search"
      part="search-input"
      type="search"
      :placeholder="`Search ${attribute ?? ''}…`"
      :value="searchTerm"
      @input="searchTerm = ($event.target as HTMLInputElement).value"
    />
    <ul class="list" part="list">
      <li v-for="v in visible" :key="v.value" class="item" part="item">
        <label class="label" part="label">
          <input
            class="checkbox"
            part="checkbox"
            type="checkbox"
            :checked="v.selected"
            @change="toggle(v.value)"
          />
          <span class="value">{{ v.value }}</span>
          <span class="count" part="count">{{ v.count }}</span>
        </label>
      </li>
    </ul>
    <button
      v-if="hasMore"
      class="show-more"
      part="show-more-button"
      type="button"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show less' : 'Show more' }}
    </button>
  </div>
</template>

<style>
.header {
  font-weight: 600;
  margin-bottom: calc(var(--sparq-spacing, 8px));
}
.search {
  width: 100%;
  margin-bottom: calc(var(--sparq-spacing, 8px));
  padding: calc(var(--sparq-spacing, 8px) * 0.75);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius-sm, 4px);
  background: var(--sparq-color-bg, #fff);
}
.list {
  list-style: none;
}
.item {
  margin: 2px 0;
}
.label {
  display: flex;
  align-items: center;
  gap: calc(var(--sparq-spacing, 8px));
  cursor: pointer;
  padding: 3px 0;
}
.checkbox {
  accent-color: var(--sparq-color-primary, #2563eb);
  width: 1em;
  height: 1em;
}
.value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.85em;
}
.show-more {
  margin-top: calc(var(--sparq-spacing, 8px) * 0.5);
  color: var(--sparq-color-primary, #2563eb);
  font-size: 0.9em;
}
</style>
