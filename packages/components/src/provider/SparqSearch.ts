import {
  SearchController,
  attachUrlSync,
  type SearchHooks,
  type SparqClient,
} from '@sparq/search-core';
import { parseBoolAttr, parseListAttr, parseNumAttr } from '../attrs';
import { dispatchSparqEvent } from '../events';
import { getGlobalHooks, mergeHooks } from '../config';
import { createLazyClient } from '../clientResolution';

/**
 * <sparq-search> — the provider. Deliberately a PLAIN custom element (no Vue):
 * it renders only a <slot>, and creating the SearchController synchronously in
 * connectedCallback guarantees it exists before any descendant widget mounts
 * (upgrades run in document order; this element is defined first).
 * ARCHITECTURE §6.
 */
export class SparqSearchElement extends HTMLElement {
  controller: SearchController | null = null;
  /** Per-element client override (property-only API). */
  client: SparqClient | null = null;

  private elementHooks: SearchHooks = {};
  private detachUrlSync: (() => void) | null = null;
  private unsubs: (() => void)[] = [];

  get hooks(): SearchHooks {
    return this.elementHooks;
  }

  set hooks(h: SearchHooks | null | undefined) {
    this.elementHooks = h ?? {};
    if (this.controller) this.controller.hooks = mergeHooks(getGlobalHooks(), this.elementHooks);
  }

  connectedCallback(): void {
    if (!this.shadowRoot) {
      const sr = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host { display: block; }';
      sr.append(style, document.createElement('slot'));
    }
    if (this.controller) return; // reconnect after a DOM move — keep everything

    const collection = this.getAttribute('collection') ?? '';
    if (!collection) {
      console.error('[sparq] <sparq-search> requires a collection="..." attribute.');
    }

    const controller = new SearchController(createLazyClient(this), {
      collection,
      itemsPerPage: parseNumAttr(this.getAttribute('items-per-page'), 20),
      debounceMs: parseNumAttr(this.getAttribute('debounce'), 200),
      stalledDelayMs: parseNumAttr(this.getAttribute('stalled-delay'), 200),
      searchFields: parseListAttr(this.getAttribute('search-fields')),
      returnFields: parseListAttr(this.getAttribute('return-fields')),
      filter: this.getAttribute('filter') ?? undefined,
      hooks: mergeHooks(getGlobalHooks(), this.elementHooks),
    });
    this.controller = controller;

    this.unsubs.push(
      controller.on('search', (d) => dispatchSparqEvent(this, 'sparq:search', d)),
      controller.on('error', (d) => dispatchSparqEvent(this, 'sparq:error', d)),
      controller.on('query-change', (d) => dispatchSparqEvent(this, 'sparq:query-change', d)),
      controller.on('refine', (d) => dispatchSparqEvent(this, 'sparq:refine', d)),
      controller.on('page-change', (d) => dispatchSparqEvent(this, 'sparq:page-change', d)),
    );

    // URL → state must apply BEFORE the first search (ARCHITECTURE §13).
    if (parseBoolAttr(this.getAttribute('routing'))) {
      this.detachUrlSync = attachUrlSync(controller);
    }

    if (parseBoolAttr(this.getAttribute('search-on-load'), true)) {
      this.scheduleFirstSearch();
    }
  }

  disconnectedCallback(): void {
    // A DOM move fires disconnect→connect in the same task; only tear down
    // when the element is truly gone (ARCHITECTURE §18: idempotent lifecycle).
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.unsubs.forEach((fn) => fn());
      this.unsubs = [];
      this.detachUrlSync?.();
      this.detachUrlSync = null;
      this.controller?.dispose();
      this.controller = null;
    });
  }

  /**
   * With an SSR fallback the content is already on screen — defer the takeover
   * query past first paint so it never competes with LCP (ARCHITECTURE §17).
   */
  private scheduleFirstSearch(): void {
    const hasSsrFallback = this.querySelector('sparq-ssr') !== null;
    if (!hasSsrFallback) {
      // One macrotask later: widget registrations (microtasks queued during
      // element upgrades) land first, so the first request already includes
      // every displayed facet — one request on load, not two.
      setTimeout(() => this.controller?.start(), 0);
      return;
    }
    const idle = (cb: () => void) =>
      'requestIdleCallback' in window
        ? window.requestIdleCallback(cb, { timeout: 2000 })
        : setTimeout(cb, 1); // Safari fallback
    requestAnimationFrame(() => idle(() => this.controller?.start()));
  }
}
