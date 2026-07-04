import { computed, type ComputedRef, type ShallowRef } from 'vue';
import type { SearchController, SearchState } from '@sparq/search-core';

/**
 * Typed computed selector over controller state. Works because core and Vue
 * share ONE @vue/reactivity instance (resolve.dedupe — ARCHITECTURE §18).
 */
export function useSearchState<T>(
  controller: ShallowRef<SearchController | null>,
  selector: (state: Readonly<SearchState>) => T,
  fallback: T,
): ComputedRef<T> {
  return computed(() => {
    const c = controller.value;
    return c ? selector(c.state) : fallback;
  });
}
