<script setup lang="ts">
import { useItemsWidget } from '../composables/useItemsWidget';

const { host, errorMessage, emptyVisible, stalled } = useItemsWidget('paged');
const emptyText = host.getAttribute('empty-text') ?? 'No results found.';
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
</style>
