<script setup lang="ts">
import { computed } from 'vue';
import { parseListAttr } from '../attrs';
import { useController } from '../composables/useController';

const { controller, host } = useController({ role: 'perpage' });

const label = host.getAttribute('label');
const configured = parseListAttr(host.getAttribute('options'))
  .map((v) => Number(v))
  .filter((n) => Number.isFinite(n) && n > 0);
if (configured.length === 0) console.error('[sparq] <sparq-perpage> requires options="12,24,48".');

const current = computed(() => controller.value?.state.itemsPerPage ?? 0);

// The select never lies about state: if the provider's items-per-page isn't one
// of the configured options, surface it as a selected option too.
const options = computed<number[]>(() => {
  const set = new Set(configured);
  if (current.value > 0) set.add(current.value);
  return [...set].sort((a, b) => a - b);
});

function onChange(e: Event): void {
  controller.value?.setItemsPerPage(Number((e.target as HTMLSelectElement).value));
}
</script>

<template>
  <div class="sq-root" part="root">
    <label class="wrap">
      <span v-if="label" class="label" part="label">{{ label }}</span>
      <select class="select" part="select" aria-label="Results per page" @change="onChange">
        <option
          v-for="opt in options"
          :key="opt"
          :value="opt"
          :selected="opt === current"
        >
          {{ opt }}
        </option>
      </select>
    </label>
  </div>
</template>

<style>
.wrap {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--sparq-spacing, 8px));
}
.label {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.9em;
}
.select {
  padding: calc(var(--sparq-spacing, 8px) * 0.75) calc(var(--sparq-spacing, 8px));
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius, 6px);
  background: var(--sparq-color-bg, #fff);
  cursor: pointer;
}
</style>
