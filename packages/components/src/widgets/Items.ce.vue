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

<!-- List/skeleton/state styles come from itemsShared.ts via register.ts -->

