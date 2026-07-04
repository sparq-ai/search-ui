import { onBeforeUnmount, onMounted, shallowRef, useHost, type ShallowRef } from 'vue';
import type { SearchController, WidgetRegistration } from '@sparq/search-core';
import { findProviderFor } from './findProvider';

export interface UseControllerResult {
  controller: ShallowRef<SearchController | null>;
  host: HTMLElement;
}

/**
 * Widget wiring (ARCHITECTURE §6): resolve the governing provider, register
 * with its controller (so the request builder knows which facets to fetch),
 * and tear down symmetrically. Registration is idempotent across the
 * disconnect/reconnect churn custom elements experience when moved.
 */
export function useController(reg: WidgetRegistration): UseControllerResult {
  const host = useHost() as HTMLElement;
  const controller = shallowRef<SearchController | null>(null);
  let unregister: (() => void) | null = null;

  onMounted(() => {
    void findProviderFor(host).then((provider) => {
      if (!provider?.controller) return;
      controller.value = provider.controller;
      unregister = provider.controller.registerWidget(reg);
    });
  });

  onBeforeUnmount(() => {
    unregister?.();
    unregister = null;
    controller.value = null;
  });

  return { controller, host };
}
