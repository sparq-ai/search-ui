import { computed, onBeforeUnmount, onMounted, watchEffect, type ComputedRef } from 'vue';
import { compileItemTemplate, renderBlank, type Item, type ItemRenderer } from '@sparq/search-core';
import { parseBoolAttr } from '../attrs';
import { dispatchSparqEvent } from '../events';
import { useController } from './useController';

export type RenderItemFn = (item: Item, ctx: { index: number }) => Node | string;

export interface ItemsWidgetApi {
  controller: ReturnType<typeof useController>['controller'];
  host: HTMLElement;
  status: ComputedRef<string>;
  errorMessage: ComputedRef<string | null>;
  emptyVisible: ComputedRef<boolean>;
  stalled: ComputedRef<boolean>;
}

/**
 * Shared engine for <sparq-items> / <sparq-items-infinite> (ARCHITECTURE §7, §17).
 *
 * Items are rendered into the HOST'S LIGHT DOM and pulled through the shadow
 * <slot>, so the customer's own page CSS styles their own item markup. The
 * light DOM is managed imperatively; the user's <template> child and any
 * slot="empty"/"error" content are never touched.
 *
 * CWV behaviors:
 * - skeletons: itemsPerPage blank stamps of the user's own template (real
 *   dimensions) while the first results load; `skeleton="false"` opts out.
 * - height retention: once results have rendered, the host's height is pinned
 *   as min-height during subsequent loads and released after commit.
 * - stale-while-loading: previous items stay visible during refinement loads.
 */
export function useItemsWidget(mode: 'paged' | 'accumulated'): ItemsWidgetApi {
  const { controller, host } = useController({ role: 'items' });
  let renderer: ItemRenderer | null = null;
  let lastItems: Item[] = [];
  let hasRenderedOnce = false;
  let stopRender: (() => void) | null = null;

  const status = computed(() => controller.value?.state.status ?? 'idle');
  const stalled = computed(() => status.value === 'stalled');
  const errorMessage = computed(() => controller.value?.state.error?.message ?? null);
  const emptyVisible = computed(() => {
    const st = controller.value?.state;
    return !!st && st.status === 'success' && st.results !== null && st.results.totalItems === 0;
  });

  const skeletonEnabled = () => parseBoolAttr(host.getAttribute('skeleton'), true);
  const customRenderer = () => (host as HTMLElement & { renderItem?: RenderItemFn }).renderItem;

  function clearRendered(): void {
    host.querySelectorAll(':scope > [data-sparq-item], :scope > [data-sparq-skeleton]').forEach((el) => el.remove());
  }

  function buildItemNode(item: Item, index: number): Element {
    const wrapper = host.ownerDocument.createElement('div');
    wrapper.setAttribute('data-sparq-item', String(index));
    const custom = customRenderer();
    if (custom) {
      const out = custom(item, { index });
      if (typeof out === 'string') {
        // Dev-trusted by contract (ARCHITECTURE §11): renderItem strings are
        // injected as HTML, unlike {{}} bindings which are always escaped.
        wrapper.innerHTML = out;
      } else {
        wrapper.appendChild(out);
      }
    } else if (renderer) {
      wrapper.appendChild(renderer(item));
    }
    return wrapper;
  }

  function renderSkeletons(count: number): void {
    if (!skeletonEnabled() || !renderer) return;
    clearRendered();
    const frag = host.ownerDocument.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const wrapper = host.ownerDocument.createElement('div');
      wrapper.setAttribute('data-sparq-skeleton', '');
      wrapper.setAttribute('aria-hidden', 'true');
      wrapper.appendChild(renderBlank(renderer));
      frag.appendChild(wrapper);
    }
    host.appendChild(frag);
  }

  function replaceItems(items: Item[]): void {
    clearRendered();
    const frag = host.ownerDocument.createDocumentFragment();
    items.forEach((item, index) => frag.appendChild(buildItemNode(item, index)));
    host.appendChild(frag);
    lastItems = items;
    hasRenderedOnce = true;
  }

  function pinHeight(): void {
    if (!hasRenderedOnce) return;
    const h = host.getBoundingClientRect().height;
    if (h > 0) host.style.minHeight = `${h}px`;
  }

  function releaseHeight(): void {
    requestAnimationFrame(() => {
      host.style.minHeight = '';
    });
  }

  function renderList(): void {
    const c = controller.value;
    if (!c) return;
    const st = c.state;
    // Reactive reads — this effect re-runs on any of these changing.
    const currentStatus = st.status;
    const results = st.results;
    const items = mode === 'accumulated' ? [...st.accumulatedItems] : (results?.items ?? []);

    if (results === null) {
      if (currentStatus === 'error') {
        clearRendered();
      } else {
        renderSkeletons(st.itemsPerPage);
      }
      return;
    }
    if (currentStatus === 'loading' || currentStatus === 'stalled') {
      // stale-while-loading: keep previous items on screen, prevent collapse
      pinHeight();
      return;
    }
    replaceItems(items);
    releaseHeight();
  }

  function onClick(e: Event): void {
    const target = e.target as Element | null;
    const wrapper = target?.closest('[data-sparq-item]');
    if (!wrapper || !host.contains(wrapper)) return;
    const index = Number(wrapper.getAttribute('data-sparq-item'));
    const item = lastItems[index];
    if (item !== undefined) {
      controller.value?.trackItemClick(item, index);
      dispatchSparqEvent(host, 'sparq:item-click', { item, index });
    }
  }

  onMounted(() => {
    const tpl = host.querySelector(':scope > template');
    renderer = tpl ? compileItemTemplate(tpl as HTMLTemplateElement) : defaultCardRenderer(host.ownerDocument);
    host.addEventListener('click', onClick);
    stopRender = watchEffect(() => renderList());
  });

  onBeforeUnmount(() => {
    stopRender?.();
    stopRender = null;
    host.removeEventListener('click', onClick);
    clearRendered();
    host.style.minHeight = '';
  });

  return { controller, host, status, errorMessage, emptyVisible, stalled };
}

/** Built-in fallback card so <sparq-items> works with zero configuration. */
function defaultCardRenderer(doc: Document): ItemRenderer {
  return (item: Item) => {
    const frag = doc.createDocumentFragment();
    const card = doc.createElement('div');
    card.setAttribute(
      'style',
      'border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:0 0 8px;font:inherit;',
    );
    const entries = Object.entries(item);
    const titleEntry = entries.find(([, v]) => typeof v === 'string') ?? entries[0];
    if (titleEntry) {
      const h = doc.createElement('div');
      h.setAttribute('style', 'font-weight:600;margin-bottom:4px;');
      h.textContent = String(titleEntry[1] ?? '');
      card.appendChild(h);
    }
    const meta = doc.createElement('div');
    meta.setAttribute('style', 'font-size:0.85em;opacity:0.75;');
    meta.textContent = entries
      .filter(([k]) => k !== titleEntry?.[0])
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('  ·  ');
    card.appendChild(meta);
    frag.appendChild(card);
    return frag;
  };
}
