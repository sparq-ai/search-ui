<script setup lang="ts">
import { computed, ref, useHost, watchEffect } from 'vue';
import { parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';

// Read config BEFORE registering so the numeric attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-range> requires an attribute="..." attribute.');

const { controller } = useController({ role: 'range', numericAttribute: attribute ?? undefined });

const prefix = host.getAttribute('prefix') ?? '';
const step = parseNumAttr(host.getAttribute('step'), 1);
const attrMin = host.getAttribute('min');
const attrMax = host.getAttribute('max');

const minInput = ref('');
const maxInput = ref('');
const editing = ref(false);

const stats = computed(() => (attribute ? controller.value?.state.results?.facetStats[attribute] : undefined));
const boundMin = computed(() => (attrMin !== null ? Number(attrMin) : stats.value?.min));
const boundMax = computed(() => (attrMax !== null ? Number(attrMax) : stats.value?.max));

// External changes (URL routing, clear-all chips) flow into the inputs when idle.
watchEffect(() => {
  if (!attribute || editing.value) return;
  const range = controller.value?.state.numericFilters[attribute];
  minInput.value = range?.min !== undefined ? String(range.min) : '';
  maxInput.value = range?.max !== undefined ? String(range.max) : '';
});

function apply(): void {
  if (!attribute) return;
  editing.value = false;
  const min = minInput.value === '' ? undefined : Number(minInput.value);
  const max = maxInput.value === '' ? undefined : Number(maxInput.value);
  if (min === undefined && max === undefined) {
    controller.value?.setNumericRange(attribute, null);
  } else {
    controller.value?.setNumericRange(attribute, { min, max });
  }
}
</script>

<template>
  <div class="sq-root" part="root">
    <div class="wrap">
      <span v-if="prefix" class="prefix" part="prefix">{{ prefix }}</span>
      <input
        class="input"
        part="input-min"
        type="number"
        inputmode="decimal"
        :step="step"
        :placeholder="boundMin !== undefined ? String(boundMin) : 'min'"
        :value="minInput"
        aria-label="Minimum"
        @focus="editing = true"
        @input="minInput = ($event.target as HTMLInputElement).value"
        @change="apply"
      />
      <span class="sep" part="separator">–</span>
      <span v-if="prefix" class="prefix" part="prefix">{{ prefix }}</span>
      <input
        class="input"
        part="input-max"
        type="number"
        inputmode="decimal"
        :step="step"
        :placeholder="boundMax !== undefined ? String(boundMax) : 'max'"
        :value="maxInput"
        aria-label="Maximum"
        @focus="editing = true"
        @input="maxInput = ($event.target as HTMLInputElement).value"
        @change="apply"
      />
    </div>
  </div>
</template>

<style>
.wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.input {
  width: 6em;
  padding: calc(var(--sparq-spacing, 8px) * 0.75);
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius-sm, 4px);
  background: var(--sparq-color-bg, #fff);
}
.sep,
.prefix {
  color: var(--sparq-color-text-muted, #6b7280);
}
</style>
