<script setup lang="ts">
import { computed } from 'vue';
import { useController } from '../composables/useController';

const { controller, host } = useController({ role: 'stats' });
const template = host.getAttribute('template') ?? '{totalItems} results in {processingTimeMs}ms';

const text = computed(() => {
  const state = controller.value?.state;
  const results = state?.results;
  if (!state || !results) return '';
  const vars: Record<string, string> = {
    totalItems: String(results.totalItems),
    processingTimeMs: String(results.processingTimeMs),
    page: String(results.page + 1),
    totalPages: String(results.totalPages),
    query: state.query,
  };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
});
</script>

<template>
  <!-- Always rendered with a reserved line height so the text appearing after
       the first results never shifts surrounding content (ARCHITECTURE §17). -->
  <div class="sq-root stats" part="root">{{ text }}</div>
</template>

<style>
.stats {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.9em;
  min-height: 1.5em;
}
</style>
