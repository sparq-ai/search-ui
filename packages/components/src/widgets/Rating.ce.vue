<script setup lang="ts">
import { computed, useHost } from 'vue';
import { parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';

// Read config BEFORE registering so the numeric attribute reaches the request builder.
const host = useHost() as HTMLElement;
const attribute = host.getAttribute('attribute');
if (!attribute) console.error('[sparq] <sparq-rating> requires an attribute="..." attribute (e.g. average_rating).');

const { controller } = useController({ role: 'range', numericAttribute: attribute ?? undefined });

const header = host.getAttribute('header');
const maxRating = parseNumAttr(host.getAttribute('max'), 5);
const andUpLabel = host.getAttribute('and-up-label') ?? '& up';

/** Rows: max-1 stars & up … 1 star & up. "N & up" ⇒ numeric filter attribute >= N. */
const rows = computed(() => {
  const out: { threshold: number; selected: boolean }[] = [];
  const current = attribute ? controller.value?.state.numericFilters[attribute]?.min : undefined;
  for (let threshold = maxRating - 1; threshold >= 1; threshold--) {
    out.push({ threshold, selected: current === threshold });
  }
  return out;
});

function pick(threshold: number, selected: boolean): void {
  if (!attribute) return;
  controller.value?.setNumericRange(attribute, selected ? null : { min: threshold });
}
</script>

<template>
  <div class="sq-root" part="root">
    <div v-if="header" class="header" part="header">{{ header }}</div>
    <div class="rows" role="radiogroup" :aria-label="header ?? 'Rating'">
      <button
        v-for="row in rows"
        :key="row.threshold"
        class="row"
        :class="{ selected: row.selected }"
        :part="row.selected ? 'row row-selected' : 'row'"
        type="button"
        role="radio"
        :aria-checked="row.selected ? 'true' : 'false'"
        :aria-label="`${row.threshold} stars ${andUpLabel}`"
        @click="pick(row.threshold, row.selected)"
      >
        <span class="stars" part="stars" aria-hidden="true">
          <span v-for="n in maxRating" :key="n" class="star" :class="{ filled: n <= row.threshold }">★</span>
        </span>
        <span class="and-up" part="label">{{ andUpLabel }}</span>
      </button>
    </div>
  </div>
</template>

<style>
.header {
  font-weight: 600;
  margin-bottom: calc(var(--sparq-spacing, 8px));
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row {
  display: flex;
  align-items: center;
  gap: calc(var(--sparq-spacing, 8px));
  padding: 4px 6px;
  border-radius: var(--sparq-radius-sm, 4px);
  text-align: left;
}
.row:hover {
  background: var(--sparq-color-bg-elevated, #f3f4f6);
}
.row.selected {
  background: var(--sparq-color-bg-elevated, #f3f4f6);
  outline: 1px solid var(--sparq-color-primary, #2563eb);
}
.star {
  color: var(--sparq-color-border, #d1d5db);
  font-size: 1.05em;
}
.star.filled {
  color: var(--sparq-rating-color, #f59e0b);
}
.and-up {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.85em;
}
</style>
