<script setup lang="ts">
import { computed } from 'vue';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { useController } from '../composables/useController';

const { controller, host } = useController({ role: 'pagination' });

const padding = parseNumAttr(host.getAttribute('padding'), 2);
const showFirstLast = parseBoolAttr(host.getAttribute('show-first-last'));
const prevNext = host.getAttribute('mode') === 'prevnext';
const prevLabel = host.getAttribute('prev-label') ?? '‹ Prev';
const nextLabel = host.getAttribute('next-label') ?? 'Next ›';

const page = computed(() => controller.value?.state.results?.page ?? 0);
const totalPages = computed(() => controller.value?.state.results?.totalPages ?? 1);
// CLS guard (ARCHITECTURE §17): before the first results, render an invisible
// placeholder row so pagination appearing later never shifts surrounding content.
const resultsKnown = computed(() => (controller.value?.state.results ?? null) !== null);

const pages = computed<number[]>(() => {
  const total = totalPages.value;
  const current = page.value;
  const start = Math.max(0, Math.min(current - padding, total - 2 * padding - 1));
  const end = Math.min(total - 1, start + 2 * padding);
  const list: number[] = [];
  for (let p = Math.max(0, start); p <= end; p++) list.push(p);
  return list;
});

function go(p: number): void {
  controller.value?.setPage(p);
}
</script>

<template>
  <nav
    v-if="!resultsKnown || totalPages > 1"
    class="sq-root"
    :class="{ placeholder: !resultsKnown }"
    part="root nav"
    aria-label="Search results pages"
  >
    <ul v-if="!resultsKnown" class="list" aria-hidden="true">
      <li class="item"><button class="link" type="button" disabled>1</button></li>
    </ul>
    <div v-else-if="prevNext" class="prevnext" part="list">
      <button class="link" part="link prev" type="button" :disabled="page === 0" aria-label="Previous page" @click="go(page - 1)">{{ prevLabel }}</button>
      <span class="status" part="status">Page {{ page + 1 }} of {{ totalPages }}</span>
      <button class="link" part="link next" type="button" :disabled="page >= totalPages - 1" aria-label="Next page" @click="go(page + 1)">{{ nextLabel }}</button>
    </div>
    <ul v-else class="list" part="list">
      <li v-if="showFirstLast" class="item" part="item">
        <button class="link" part="link first" type="button" :disabled="page === 0" aria-label="First page" @click="go(0)">«</button>
      </li>
      <li class="item" part="item">
        <button class="link" part="link prev" type="button" :disabled="page === 0" aria-label="Previous page" @click="go(page - 1)">‹</button>
      </li>
      <li v-for="p in pages" :key="p" class="item" part="item">
        <button
          class="link"
          :class="{ active: p === page }"
          :part="p === page ? 'link link-active' : 'link'"
          type="button"
          :aria-current="p === page ? 'page' : undefined"
          @click="go(p)"
        >
          {{ p + 1 }}
        </button>
      </li>
      <li class="item" part="item">
        <button class="link" part="link next" type="button" :disabled="page >= totalPages - 1" aria-label="Next page" @click="go(page + 1)">›</button>
      </li>
      <li v-if="showFirstLast" class="item" part="item">
        <button class="link" part="link last" type="button" :disabled="page >= totalPages - 1" aria-label="Last page" @click="go(totalPages - 1)">»</button>
      </li>
    </ul>
  </nav>
</template>

<style>
.placeholder {
  visibility: hidden;
}
.list {
  display: flex;
  gap: 4px;
  list-style: none;
  align-items: center;
}
.prevnext {
  display: flex;
  gap: calc(var(--sparq-spacing, 8px));
  align-items: center;
}
.status {
  color: var(--sparq-color-text-muted, #6b7280);
  font-size: 0.9em;
  font-variant-numeric: tabular-nums;
}
.link {
  min-width: 2.2em;
  padding: calc(var(--sparq-spacing, 8px) * 0.75);
  text-align: center;
  border: 1px solid var(--sparq-color-border, #d1d5db);
  border-radius: var(--sparq-radius-sm, 4px);
  background: var(--sparq-color-bg, #fff);
}
.link:hover:not(:disabled):not(.active) {
  border-color: var(--sparq-color-primary, #2563eb);
}
.link.active {
  background: var(--sparq-color-primary, #2563eb);
  border-color: var(--sparq-color-primary, #2563eb);
  color: var(--sparq-color-primary-contrast, #fff);
}
.link:disabled {
  opacity: 0.4;
}
</style>
