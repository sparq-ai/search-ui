<script setup lang="ts">
import { computed } from 'vue';
import type { Refinement } from '@sparq/search-core';
import { useController } from '../composables/useController';

type TransformValues = (values: Refinement[]) => Refinement[];

const { controller, host } = useController({ role: 'refinements' });
const clearLabel = host.getAttribute('clear-label') ?? 'Clear all';

const refinements = computed<Refinement[]>(() => {
  let refs = controller.value?.refinements ?? [];
  const transform = (host as HTMLElement & { transformValues?: TransformValues }).transformValues;
  if (transform) refs = transform(refs) ?? refs;
  return refs;
});

function remove(r: Refinement): void {
  const c = controller.value;
  if (!c) return;
  if (r.type === 'facet') c.toggleFacetValue(r.attr, r.value);
  else c.setNumericRange(r.attr, null);
}

function clearAll(): void {
  controller.value?.clearRefinements();
}
</script>

<template>
  <div v-if="refinements.length > 0" class="sq-root" part="root">
    <ul class="list" part="list">
      <li v-for="r in refinements" :key="`${r.attr}:${r.value}`" class="chip" part="chip">
        <span class="chip-label" part="chip-label">{{ r.label }}</span>
        <button
          class="chip-remove"
          part="chip-remove"
          type="button"
          :aria-label="`Remove ${r.label}`"
          @click="remove(r)"
        >
          ×
        </button>
      </li>
      <li class="chip-clear">
        <button class="clear-all" part="clear-all" type="button" @click="clearAll">
          {{ clearLabel }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style>
.list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px 4px 10px;
  background: var(--sparq-color-bg-elevated, #f3f4f6);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: 999px;
  font-size: 0.9em;
}
.chip-remove {
  line-height: 1;
  padding: 0 4px;
  color: var(--sparq-color-text-muted, #6b7280);
}
.chip-remove:hover {
  color: var(--sparq-color-error, #dc2626);
}
.clear-all {
  color: var(--sparq-color-primary, #2563eb);
  font-size: 0.9em;
  padding: 4px 8px;
}
</style>
