import type { Item } from '@sparq/search-core';
import { parseListAttr, parseNumAttr } from '../attrs';

export type AcTransformItems = (items: Item[], ctx: { query: string }) => Item[] | Promise<Item[]>;
export type AcRenderItem = (item: Item, ctx: { index: number }) => Node | string;

interface SourceParent {
  sourcesChanged?: () => void;
}

export interface AcSourceReading {
  el: SparqAcSourceElement;
  collection: string;
  title: string | null;
  limit: number;
  showOn: 'query' | 'empty' | 'always';
  searchFields: string[];
  filter: string | undefined;
  sort: string | null;
  appId: string | null;
  apiKey: string | null;
  template: HTMLTemplateElement | null;
}

/**
 * <sparq-ac-source> — inert configuration holder for one autocomplete section
 * (collection, limits, show-on rules, its own <template>). Registers UP to the
 * closest <sparq-autocomplete> on connect, so upgrade order and dynamic
 * insertion are non-issues (ARCHITECTURE §6 child→parent pattern).
 */
export class SparqAcSourceElement extends HTMLElement {
  /** Property-only hooks (functions can't ride attributes — ARCHITECTURE §11). */
  transformItems?: AcTransformItems;
  /** Dev-trusted full-rendering override, same contract as sparq-items renderItem. */
  renderItem?: AcRenderItem;

  private parent: SourceParent | null = null;

  connectedCallback(): void {
    this.style.display = 'none'; // config-only; never renders
    this.parent = this.closest('sparq-autocomplete') as SourceParent | null;
    this.parent?.sourcesChanged?.();
  }

  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.parent?.sourcesChanged?.();
      this.parent = null;
    });
  }

  read(): AcSourceReading | null {
    const collection = this.getAttribute('collection');
    if (!collection) {
      console.error('[sparq] <sparq-ac-source> requires a collection="..." attribute — section skipped.');
      return null;
    }
    const showOnRaw = this.getAttribute('show-on');
    const showOn = showOnRaw === 'empty' || showOnRaw === 'always' ? showOnRaw : 'query';
    return {
      el: this,
      collection,
      title: this.getAttribute('title') ?? this.getAttribute('header'),
      limit: parseNumAttr(this.getAttribute('limit'), 5),
      showOn,
      searchFields: parseListAttr(this.getAttribute('search-fields')),
      filter: this.getAttribute('filter') ?? undefined,
      sort: this.getAttribute('sort'),
      appId: this.getAttribute('app-id'),
      apiKey: this.getAttribute('api-key'),
      template: this.querySelector(':scope > template'),
    };
  }
}
