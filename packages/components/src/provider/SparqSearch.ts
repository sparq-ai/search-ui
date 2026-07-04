import {
  SearchController,
  attachUrlSync,
  createMockClient,
  createSparqClient,
  type Item,
  type SearchHooks,
  type SearchRequest,
  type SparqClient,
} from '@sparq/search-core';
import { parseBoolAttr, parseListAttr, parseNumAttr } from '../attrs';
import { dispatchSparqEvent } from '../events';
import { getGlobalClient, getGlobalHooks, mergeHooks } from '../config';

declare global {
  interface Window {
    /** Playground/demo hook: plain global so it can be set before the CDN script loads. */
    __SPARQ_MOCK__?: { data: Item[]; delayMs?: number; suggestions?: string[] };
  }
}

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
  private resolvedClient: SparqClient | null = null;
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

    const controller = new SearchController(this.lazyClient(), {
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
      this.scheduleFirstSearch(controller);
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
      this.resolvedClient = null;
    });
  }

  /**
   * With an SSR fallback the content is already on screen — defer the takeover
   * query past first paint so it never competes with LCP (ARCHITECTURE §17).
   */
  private scheduleFirstSearch(controller: SearchController): void {
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

  /**
   * Client resolution is lazy (per call) so host pages can set overrides in any
   * order relative to script load: element property > global setClient() >
   * api-host="mock:" > the real Sparq adapter.
   */
  private lazyClient(): SparqClient {
    const resolve = (): SparqClient => {
      if (this.client) return this.client;
      const global = getGlobalClient();
      if (global) return global;
      if (this.resolvedClient) return this.resolvedClient;

      const apiHost = this.getAttribute('api-host');
      if (apiHost?.startsWith('mock:')) {
        const mock = window.__SPARQ_MOCK__;
        if (!mock) {
          throw {
            type: 'client',
            message:
              '[sparq] api-host="mock:" needs mock data: set window.__SPARQ_MOCK__ = { data: [...] } before searching.',
            retryable: false,
          };
        }
        this.resolvedClient = createMockClient(mock.data, {
          delayMs: mock.delayMs,
          suggestions: mock.suggestions,
        });
        return this.resolvedClient;
      }

      const appId = this.getAttribute('app-id');
      const apiKey = this.getAttribute('api-key');
      if (!appId || !apiKey) {
        throw {
          type: 'auth',
          message: '[sparq] <sparq-search> needs app-id and api-key attributes (or a client set via JS).',
          retryable: false,
        };
      }
      this.resolvedClient = createSparqClient({ appId, apiKey, host: apiHost ?? undefined });
      return this.resolvedClient;
    };

    return {
      search: (req: SearchRequest, opts?: { signal?: AbortSignal }) => resolve().search(req, opts),
      suggest: async (query: string, opts?: { signal?: AbortSignal }) => {
        const client = resolve();
        return client.suggest ? client.suggest(query, opts) : [];
      },
    };
  }
}
