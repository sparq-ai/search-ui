<script setup lang="ts">
import { computed, useHost } from 'vue';
import { useController } from '../composables/useController';

/**
 * <sparq-toggle> — a single on/off switch applying one facet value
 * (e.g. attribute="system_availability" value="in stock"), the store-ui
 * in-stock toggle generalized to any attribute/value pair.
 */
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
const value = host.getAttribute('value');
if (!attribute || !value) {
  console.error('[sparq] <sparq-toggle> requires attribute="..." and value="..." attributes.');
}

const { controller } = useController({ role: 'filters', facetAttribute: attribute ?? undefined });

const label = host.getAttribute('label') ?? (value ?? '');

const active = computed(() => {
  if (!attribute || !value) return false;
  return (controller.value?.state.facetFilters[attribute] ?? []).includes(value);
});

const count = computed(() => {
  if (!attribute || !value) return null;
  const facet = controller.value?.state.results?.facets[attribute];
  return facet?.find((v) => v.value === value)?.count ?? null;
});

function toggle(): void {
  if (attribute && value) controller.value?.toggleFacetValue(attribute, value);
}
</script>

<template>
  <div class="sq-root" part="root">
    <button
      class="wrap"
      part="toggle"
      type="button"
      role="switch"
      :aria-checked="active ? 'true' : 'false'"
      @click="toggle"
    >
      <span class="track" :class="{ on: active }" part="track" aria-hidden="true">
        <span class="knob" part="knob"></span>
      </span>
      <span class="label" part="label">{{ label }}</span>
      <span v-if="count !== null" class="count" part="count">{{ count }}</span>
    </button>
  </div>
</template>

<style>
.wrap {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--sparq-spacing, 8px));
  cursor: pointer;
}
.track {
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--sparq-color-border, #d1d5db);
  position: relative;
  transition: background 0.15s ease;
  flex: none;
}
.track.on {
  background: var(--sparq-color-primary, #2563eb);
}
.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--sparq-color-bg, #fff);
  transition: transform 0.15s ease;
}
.track.on .knob {
  transform: translateX(14px);
}
.count {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.85em;
}
</style>
