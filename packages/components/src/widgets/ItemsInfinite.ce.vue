<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseBoolAttr } from '../attrs';
import { useInfiniteSentinel } from '../composables/useInfiniteSentinel';
import { useItemsWidget } from '../composables/useItemsWidget';

const { controller, host, errorMessage, emptyVisible, stalled } = useItemsWidget('accumulated');
const emptyText = host.getAttribute('empty-text') ?? 'No results found.';
const loadMoreText = host.getAttribute('load-more-text') ?? 'Load more';
const auto = parseBoolAttr(host.getAttribute('auto'));

const sentinel = ref<Element | null>(null);
const canLoadMore = computed(() => {
  const c = controller.value;
  return !!c && c.state.status === 'success' && !c.isLastPage;
});

function loadMore(): void {
  void controller.value?.loadMore();
}

if (auto) {
  useInfiniteSentinel(sentinel, () => {
    if (canLoadMore.value) loadMore();
  });
}
</script>

<template>
  <div class="sq-root" part="root">
    <div v-if="errorMessage" class="state" part="error" role="alert">
      <slot name="error">Search is unavailable right now. {{ errorMessage }}</slot>
    </div>
    <div v-else-if="emptyVisible" class="state" part="empty">
      <slot name="empty">{{ emptyText }}</slot>
    </div>
    <div class="list" part="list" :data-stalled="stalled || undefined">
      <slot></slot>
    </div>
    <div v-if="auto" ref="sentinel" class="sentinel" part="sentinel" aria-hidden="true"></div>
    <button
      v-if="!auto && canLoadMore"
      class="load-more"
      part="load-more-button"
      type="button"
      @click="loadMore"
    >
      {{ loadMoreText }}
    </button>
  </div>
</template>

<style>
.list {
  display: block;
}
.list[data-stalled] {
  opacity: 0.6;
  transition: opacity 0.15s ease;
}
::slotted([data-sparq-skeleton]) {
  animation: sq-pulse 1.2s ease-in-out infinite;
}
@keyframes sq-pulse {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.85; }
}
.state {
  padding: calc(var(--sparq-spacing, 8px) * 2);
  color: var(--sparq-color-text-muted, #6b7280);
  text-align: center;
}
.sentinel {
  height: 1px;
}
.load-more {
  display: block;
  margin: calc(var(--sparq-spacing, 8px) * 2) auto;
  padding: calc(var(--sparq-spacing, 8px)) calc(var(--sparq-spacing, 8px) * 3);
  background: var(--sparq-color-primary, #2563eb);
  color: var(--sparq-color-primary-contrast, #fff);
  border-radius: var(--sparq-radius, 6px);
}
</style>
