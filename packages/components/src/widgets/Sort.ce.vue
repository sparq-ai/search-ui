<script setup lang="ts">
import { computed } from 'vue';
import { parseOptionsAttr } from '../attrs';
import { useController } from '../composables/useController';

const { controller, host } = useController({ role: 'sort' });

const label = host.getAttribute('label');
const options = parseOptionsAttr(host.getAttribute('options'));
if (options.length === 0) console.error('[sparq] <sparq-sort> requires options="value|Label, …".');

const current = computed(() => controller.value?.state.sort ?? '');

function onChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value;
  controller.value?.setSort(value === '' || value === 'relevance' ? null : value);
}
</script>

<template>
  <div class="sq-root" part="root">
    <label class="wrap">
      <span v-if="label" class="label" part="label">{{ label }}</span>
      <select class="select" part="select" @change="onChange">
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
          :selected="opt.value === current || (current === '' && (opt.value === 'relevance' || opt.value === ''))"
        >
          {{ opt.label }}
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
