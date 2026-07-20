<script setup lang="ts">
import { computed, ref, useHost } from 'vue';
import type { FacetValue } from '@sparq/search-core';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';
import { resolveSwatch, type SwatchStyle } from './swatchColors';

type TransformValues = (values: FacetValue[]) => FacetValue[];
type FilterMode = 'checkbox' | 'single' | 'pill' | 'swatch' | 'color-list';

const MODES = new Set<FilterMode>(['checkbox', 'single', 'pill', 'swatch', 'color-list']);

// Read config BEFORE registering so the facet attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-filters> requires an attribute="..." attribute.');

const { controller } = useController({ role: 'filters', facetAttribute: attribute ?? undefined });

const header = host.getAttribute('header');
// Collapsible sections are how storefront facet sidebars usually look; without
// them every integration wraps this widget in its own accordion, which then has
// to be hidden separately when the widget renders nothing.
const collapsible = parseBoolAttr(host.getAttribute('collapsible'));
const isCollapsed = ref(collapsible && parseBoolAttr(host.getAttribute('collapsed')));
const limit = parseNumAttr(host.getAttribute('limit'), 10);
const showMore = parseBoolAttr(host.getAttribute('show-more'));
const searchable = parseBoolAttr(host.getAttribute('searchable'));
const sortBy = host.getAttribute('sort-by') === 'alpha' ? 'alpha' : 'count';

const modeRaw = host.getAttribute('mode') as FilterMode | null;
const mode: FilterMode = modeRaw && MODES.has(modeRaw) ? modeRaw : 'checkbox';
if (modeRaw && !MODES.has(modeRaw)) {
  console.error(`[sparq] <sparq-filters mode="${modeRaw}"> is not a mode — using "checkbox". Modes: checkbox, single, pill, swatch, color-list.`);
}

/** Colors config: JSON attribute (value → CSS/gradient/"*"/"#") or `colors` property. */
function readColorMap(): Record<string, string> | undefined {
  const prop = (host as HTMLElement & { colors?: Record<string, string> }).colors;
  if (prop) return prop;
  const attr = host.getAttribute('colors');
  if (!attr) return undefined;
  try {
    return JSON.parse(attr) as Record<string, string>;
  } catch {
    console.error('[sparq] <sparq-filters colors="..."> must be a JSON object, e.g. colors=\'{"Ocean":"#0ea5e9"}\'.');
    return undefined;
  }
}

const expanded = ref(false);
const searchTerm = ref('');

const values = computed<FacetValue[]>(() => {
  if (!attribute) return [];
  let vals = controller.value?.state.results?.facets[attribute] ?? [];
  // `selected` from LIVE filter state, not the (async) response snapshot —
  // selections reflect instantly and survive engine-specific radio quirks.
  const live = new Set(controller.value?.state.facetFilters[attribute] ?? []);
  vals = vals.map((v) => ({ ...v, selected: live.has(v.value) }));
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

const swatches = computed<Map<string, SwatchStyle>>(() => {
  if (mode !== 'swatch' && mode !== 'color-list') return new Map();
  const map = readColorMap();
  return new Map(visible.value.map((v) => [v.value, resolveSwatch(v.value, map)]));
});

function toggle(value: string): void {
  if (!attribute) return;
  const c = controller.value;
  if (!c) return;
  if (mode === 'single') {
    // Radio semantics: one value at a time; clicking the selected value clears.
    const selected = c.state.facetFilters[attribute] ?? [];
    c.setFacetValues(attribute, selected.includes(value) ? [] : [value]);
    return;
  }
  c.toggleFacetValue(attribute, value);
}

/**
 * Radio clicks: NEVER preventDefault — engines disagree about when a canceled
 * radio activation reverts (WebKit/Firefox restore checked AFTER dispatch,
 * clobbering in-handler writes). Let native activation run, update state, then
 * re-sync every radio from state in a microtask (covers the click-selected-
 * to-clear case, where the native check must be undone).
 */
function onSingleClick(e: Event, value: string): void {
  toggle(value);
  if (!attribute) return;
  const input = e.target as HTMLInputElement;
  queueMicrotask(() => {
    const live = new Set(controller.value?.state.facetFilters[attribute] ?? []);
    const root = input.getRootNode() as ShadowRoot;
    root.querySelectorAll<HTMLInputElement>(`input[name="sq-${attribute}"]`).forEach((radio) => {
      const rowValue = radio.closest('label')?.querySelector('.value')?.textContent ?? '';
      radio.checked = live.has(rowValue);
    });
  });
}

function swatchStyle(value: string): Record<string, string> {
  const s = swatches.value.get(value);
  return s && s.css ? { background: s.css } : {};
}

function swatchKind(value: string): string {
  return swatches.value.get(value)?.kind ?? 'unknown';
}
</script>

<template>
  <div v-if="values.length > 0 || searchTerm" class="sq-root" part="root">
    <!-- A collapsible header is a real <button> so it is focusable and
         announces its state; the static one stays a plain div as before. -->
    <button
      v-if="header && collapsible"
      class="header header-toggle"
      part="header"
      type="button"
      :aria-expanded="isCollapsed ? 'false' : 'true'"
      @click="isCollapsed = !isCollapsed"
    >
      <span class="header-text">{{ header }}</span>
      <span class="caret" part="caret" :class="{ collapsed: isCollapsed }" aria-hidden="true"></span>
    </button>
    <div v-else-if="header" class="header" part="header">{{ header }}</div>

    <div v-show="!isCollapsed" class="body" part="body">
    <input
      v-if="searchable"
      class="search"
      part="search-input"
      type="search"
      :placeholder="`Search ${header ?? attribute ?? ''}…`"
      :value="searchTerm"
      @input="searchTerm = ($event.target as HTMLInputElement).value"
    />

    <!-- pill: toggle buttons -->
    <div v-if="mode === 'pill'" class="pills" part="list" role="group" :aria-label="header ?? attribute ?? undefined">
      <button
        v-for="v in visible"
        :key="v.value"
        class="pill"
        :class="{ selected: v.selected }"
        :part="v.selected ? 'pill pill-selected' : 'pill'"
        type="button"
        :aria-pressed="v.selected ? 'true' : 'false'"
        @click="toggle(v.value)"
      >
        {{ v.value }}<span class="count" part="count">{{ v.count }}</span>
      </button>
    </div>

    <!-- swatch: color grid, value shown as tooltip/aria -->
    <div v-else-if="mode === 'swatch'" class="swatches" part="list" role="group" :aria-label="header ?? attribute ?? undefined">
      <button
        v-for="v in visible"
        :key="v.value"
        class="swatch"
        :class="{ selected: v.selected, clear: swatchKind(v.value) === 'clear', unknown: swatchKind(v.value) === 'unknown' }"
        :part="v.selected ? 'swatch swatch-selected' : 'swatch'"
        type="button"
        :style="swatchStyle(v.value)"
        :title="`${v.value} (${v.count})`"
        :aria-pressed="v.selected ? 'true' : 'false'"
        :aria-label="`${v.value}, ${v.count} results`"
        @click="toggle(v.value)"
      ></button>
    </div>

    <!-- checkbox / single / color-list: rows -->
    <ul v-else class="list" part="list" :role="mode === 'single' ? 'radiogroup' : undefined" :aria-label="mode === 'single' ? (header ?? attribute ?? undefined) : undefined">
      <li v-for="v in visible" :key="v.value" class="item" part="item">
        <label class="label" part="label">
          <input
            class="input"
            part="checkbox"
            :type="mode === 'single' ? 'radio' : 'checkbox'"
            :name="mode === 'single' ? `sq-${attribute}` : undefined"
            :checked="v.selected"
            @click="mode === 'single' ? onSingleClick($event, v.value) : undefined"
            @change="mode !== 'single' ? toggle(v.value) : undefined"
          />
          <span
            v-if="mode === 'color-list'"
            class="dot"
            :class="{ clear: swatchKind(v.value) === 'clear', unknown: swatchKind(v.value) === 'unknown' }"
            part="swatch"
            :style="swatchStyle(v.value)"
            aria-hidden="true"
          ></span>
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
  </div>
</template>

<style>
.header {
  font-weight: 600;
  margin-bottom: calc(var(--sparq-spacing, 8px));
}
/* Reset the button back to looking like the static header, so turning on
   `collapsible` changes behaviour without changing the design. */
.header-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--sparq-spacing, 8px));
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.caret {
  flex: 0 0 auto;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid currentColor;
  transform: rotate(180deg);
  transition: transform 0.15s ease;
}
.caret.collapsed {
  transform: rotate(0deg);
}
@media (prefers-reduced-motion: reduce) {
  .caret {
    transition: none;
  }
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
.input {
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

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: 999px;
  background: var(--sparq-color-bg, #fff);
  font-size: 0.9em;
}
.pill:hover:not(.selected) {
  border-color: var(--sparq-color-primary, #2563eb);
}
.pill.selected {
  background: var(--sparq-color-primary, #2563eb);
  border-color: var(--sparq-color-primary, #2563eb);
  color: var(--sparq-color-primary-contrast, #fff);
}
.pill.selected .count {
  color: inherit;
  opacity: 0.8;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--sparq-color-border, #d1d5db);
  cursor: pointer;
  padding: 0;
}
.swatch.selected {
  box-shadow: 0 0 0 2px var(--sparq-color-bg, #fff), 0 0 0 4px var(--sparq-color-primary, #2563eb);
}
.swatch.clear {
  background:
    linear-gradient(135deg, transparent 0% 44%, #ef4444 46% 54%, transparent 56% 100%),
    var(--sparq-color-bg, #fff);
}
.swatch.unknown {
  background: repeating-linear-gradient(45deg, #e5e7eb 0 4px, #f9fafb 4px 8px);
}

.dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--sparq-color-border, #d1d5db);
  flex: none;
}
.dot.clear {
  background:
    linear-gradient(135deg, transparent 0% 42%, #ef4444 46% 54%, transparent 58% 100%),
    var(--sparq-color-bg, #fff);
}
.dot.unknown {
  background: repeating-linear-gradient(45deg, #e5e7eb 0 3px, #f9fafb 3px 6px);
}

.show-more {
  margin-top: calc(var(--sparq-spacing, 8px) * 0.5);
  color: var(--sparq-color-primary, #2563eb);
  font-size: 0.9em;
}
</style>
