import { defineCustomElement, type Component } from 'vue';
import { SparqSearchElement } from './provider/SparqSearch';
import { SparqSsrElement } from './provider/SparqSsr';
import { SparqAutocompleteElement } from './autocomplete/SparqAutocomplete';
import { SparqAcSourceElement } from './autocomplete/SparqAcSource';
import { RESET_CSS } from './styles/reset';
import { ITEMS_SHARED_CSS } from './widgets/itemsShared';
import SearchBox from './widgets/SearchBox.ce.vue';
import Items from './widgets/Items.ce.vue';
import ItemsInfinite from './widgets/ItemsInfinite.ce.vue';
import Filters from './widgets/Filters.ce.vue';
import Menu from './widgets/Menu.ce.vue';
import Sort from './widgets/Sort.ce.vue';
import Pagination from './widgets/Pagination.ce.vue';
import Range from './widgets/Range.ce.vue';
import Rating from './widgets/Rating.ce.vue';
import Refinements from './widgets/Refinements.ce.vue';
import Stats from './widgets/Stats.ce.vue';
import Toggle from './widgets/Toggle.ce.vue';

function toElement(component: Component, extraStyles: string[] = []): CustomElementConstructor {
  const comp = component as Record<string, unknown> & { styles?: string[] };
  // Prepend the isolation firewall/reset to every shadow root (ARCHITECTURE §12).
  const withReset = { ...comp, styles: [RESET_CSS, ...extraStyles, ...(comp.styles ?? [])] };
  return defineCustomElement(withReset as unknown as Parameters<typeof defineCustomElement>[0]);
}

/**
 * Defines all Sparq elements. Order matters: the provider is defined FIRST so
 * document-order upgrades guarantee its controller exists before widgets mount
 * (ARCHITECTURE §6). Guarded against double script inclusion (§18).
 */
export function register(): void {
  if (customElements.get('sparq-search')) {
    console.warn('[sparq] Sparq Search UI is already registered on this page — skipping duplicate registration. Check for duplicate <script> tags or mismatched versions.');
    return;
  }
  customElements.define('sparq-search', SparqSearchElement);
  customElements.define('sparq-ssr', SparqSsrElement);
  customElements.define('sparq-autocomplete', SparqAutocompleteElement);
  customElements.define('sparq-ac-source', SparqAcSourceElement);
  customElements.define('sparq-searchbox', toElement(SearchBox));
  customElements.define('sparq-items', toElement(Items, [ITEMS_SHARED_CSS]));
  customElements.define('sparq-items-infinite', toElement(ItemsInfinite, [ITEMS_SHARED_CSS]));
  customElements.define('sparq-filters', toElement(Filters));
  customElements.define('sparq-menu', toElement(Menu));
  customElements.define('sparq-sort', toElement(Sort));
  customElements.define('sparq-pagination', toElement(Pagination));
  customElements.define('sparq-range', toElement(Range));
  customElements.define('sparq-rating', toElement(Rating));
  customElements.define('sparq-refinements', toElement(Refinements));
  customElements.define('sparq-stats', toElement(Stats));
  customElements.define('sparq-toggle', toElement(Toggle));

  // Safe timing signal for hook attachment from plain <script> tags (§11).
  document.dispatchEvent(new CustomEvent('sparq:ready'));
}
