import { watchEffect } from 'vue';
import {
  AutocompleteController,
  compileItemTemplate,
  createSparqClient,
  type AcSourceConfig,
  type Item,
  type ItemRenderer,
  type SearchRequest,
  type SparqClient,
  type UiState,
} from '@sparq/search-core';
import { parseBoolAttr, parseNumAttr } from '../attrs';
import { dispatchSparqEvent } from '../events';
import { RESET_CSS } from '../styles/reset';
import { createLazyClient } from '../clientResolution';
import { AC_CSS } from './acStyles';
import { buildSearchUrl, computePanelPlacement, moveActive, viewAllLabel } from './acLogic';
import { applyComboboxAria, isTextInput, restoreAria, setExpanded } from './externalInput';
import type { AcSourceReading, SparqAcSourceElement } from './SparqAcSource';

interface FlatItemEntry {
  wrapper: HTMLElement;
  item: Item;
  sourceIndex: number;
  itemIndex: number;
}

export interface AutocompleteHooks {
  transformRequest?: (req: SearchRequest, ctx: { uiState: UiState }) => SearchRequest | Promise<SearchRequest>;
}

let instanceCounter = 0;

/**
 * <sparq-autocomplete> — federated search-as-you-type panel (ARCHITECTURE §9).
 * Attaches to a THEME'S existing input (input="selector") or renders its own;
 * child <sparq-ac-source> elements define the sections, one collection each,
 * each with its own <template>. Items render into the LIGHT DOM (page CSS
 * styles them; ids resolve for aria-activedescendant), panel chrome in shadow.
 */
export class SparqAutocompleteElement extends HTMLElement {
  controller: AutocompleteController | null = null;
  /** Shared-client override (property-only). */
  client: SparqClient | null = null;
  /** Host-level hooks; transformRequest applies to every source request. */
  hooks: AutocompleteHooks = {};

  private panel!: HTMLDivElement;
  private sectionsHost!: HTMLDivElement;
  private viewAllEl!: HTMLAnchorElement;
  private statusEl!: HTMLDivElement;
  private sectionEls: HTMLElement[] = [];

  private ownInput: HTMLInputElement | null = null;
  private anchor: HTMLInputElement | null = null;
  private readings: AcSourceReading[] = [];
  private renderers: (ItemRenderer | null)[] = [];
  private flatItems: FlatItemEntry[] = [];
  private activeIndex = -1;
  private open = false;
  private rebuildScheduled = false;
  private repositionScheduled = false;
  private stopRender: (() => void) | null = null;
  private sharedClient: SparqClient | null = null;
  private docCleanups: (() => void)[] = [];

  connectedCallback(): void {
    if (!this.id) this.id = `sparq-ac-${++instanceCounter}`;
    if (!this.shadowRoot) this.buildShadow();
    if (this.controller) return; // reconnect after DOM move

    if (!this.getAttribute('input') && !this.ownInput) {
      const input = document.createElement('input');
      input.type = 'search';
      input.setAttribute('data-sparq-ac-input', '');
      input.setAttribute('slot', 'ac-input');
      input.setAttribute('placeholder', this.getAttribute('placeholder') ?? 'Search…');
      this.appendChild(input);
      this.ownInput = input;
    }

    this.attachDocumentListeners();
    this.sourcesChanged();
  }

  disconnectedCallback(): void {
    queueMicrotask(() => {
      if (this.isConnected) return;
      this.stopRender?.();
      this.stopRender = null;
      this.docCleanups.forEach((fn) => fn());
      this.docCleanups = [];
      if (this.anchor) restoreAria(this.anchor);
      this.anchor = null;
      this.controller?.dispose();
      this.controller = null;
      this.sharedClient = null;
      this.clearWrappers();
      this.ownInput?.remove();
      this.ownInput = null;
    });
  }

  /** Called by <sparq-ac-source> children on connect/disconnect; coalesced. */
  sourcesChanged(): void {
    if (this.rebuildScheduled || !this.isConnected) return;
    this.rebuildScheduled = true;
    queueMicrotask(() => {
      this.rebuildScheduled = false;
      if (!this.isConnected) return;
      this.rebuildSources();
    });
  }

  // ── setup ───────────────────────────────────────────────────────────────

  private buildShadow(): void {
    const sr = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = RESET_CSS + AC_CSS;

    const root = document.createElement('div');
    root.className = 'sq-root';
    root.setAttribute('part', 'root');

    const inputSlot = document.createElement('slot');
    inputSlot.name = 'ac-input';

    this.panel = document.createElement('div');
    this.panel.className = 'panel';
    this.panel.setAttribute('part', 'panel');
    this.panel.hidden = true;
    // Keep the input focused while clicking inside the panel — item links
    // complete their navigation naturally (no blur-vs-click race).
    this.panel.addEventListener('mousedown', (e) => e.preventDefault());

    this.sectionsHost = document.createElement('div');
    this.sectionsHost.setAttribute('role', 'listbox');
    this.sectionsHost.setAttribute('aria-label', 'Search suggestions');

    this.viewAllEl = document.createElement('a');
    this.viewAllEl.className = 'view-all';
    this.viewAllEl.setAttribute('part', 'view-all');
    this.viewAllEl.hidden = true;

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'sr-status';
    this.statusEl.setAttribute('role', 'status');
    this.statusEl.setAttribute('aria-live', 'polite');

    this.panel.append(this.sectionsHost, this.viewAllEl, this.statusEl);
    root.append(inputSlot, this.panel);
    sr.append(style, root);

    this.addEventListener('click', (e) => this.onItemClick(e));
    this.addEventListener('mousemove', (e) => this.onItemHover(e));
  }

  private attachDocumentListeners(): void {
    const doc = this.ownerDocument;
    const on = <K extends keyof DocumentEventMap>(
      type: K,
      fn: (e: DocumentEventMap[K]) => void,
      opts?: AddEventListenerOptions,
    ) => {
      const bound = fn as EventListener;
      doc.addEventListener(type, bound, opts);
      this.docCleanups.push(() => doc.removeEventListener(type, bound, opts));
    };

    // Delegated: survives theme re-renders replacing the input node, supports
    // selectors matching several inputs (last-focused wins).
    on('focusin', (e) => this.onFocusIn(e));
    on('input', (e) => this.onInputEvent(e));
    on('keydown', (e) => this.onKeydown(e));
    on('pointerdown', (e) => this.onDocPointerDown(e));

    const reposition = () => this.scheduleReposition();
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition);
    this.docCleanups.push(() => {
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
    });
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', reposition);
      vv.addEventListener('scroll', reposition);
      this.docCleanups.push(() => {
        vv.removeEventListener('resize', reposition);
        vv.removeEventListener('scroll', reposition);
      });
    }
  }

  private rebuildSources(): void {
    const sourceEls = Array.from(this.querySelectorAll(':scope > sparq-ac-source'));
    this.readings = [];
    this.renderers = [];
    for (const el of sourceEls) {
      // Children may not be upgraded yet when the parent connects; their own
      // connectedCallback re-notifies us, so skipping here is safe.
      const source = el as SparqAcSourceElement;
      if (typeof source.read !== 'function') continue;
      const reading = source.read();
      if (!reading) continue;
      this.readings.push(reading);
      this.renderers.push(reading.template ? compileItemTemplate(reading.template) : null);
    }
    this.buildSectionSkeleton();

    const configs: AcSourceConfig[] = this.readings.map((reading, index) => ({
      id: `s${index}`,
      collection: reading.collection,
      limit: reading.limit,
      showOn: reading.showOn,
      searchFields: reading.searchFields.length ? reading.searchFields : undefined,
      filter: reading.filter,
      sort: reading.sort,
      client: this.perSourceClient(reading),
      transformItems: (items, ctx) =>
        reading.el.transformItems ? reading.el.transformItems(items, ctx) : items,
    }));

    if (this.controller) {
      this.controller.setSources(configs);
      return;
    }
    this.sharedClient ??= createLazyClient(this);
    this.controller = new AutocompleteController(this.sharedClient, {
      sources: configs,
      minChars: parseNumAttr(this.getAttribute('min-chars'), 1),
      debounceMs: parseNumAttr(this.getAttribute('debounce'), 200),
      // Live lookup so hooks assigned after upgrade still apply.
      transformRequest: (req, ctx) =>
        this.hooks.transformRequest ? this.hooks.transformRequest(req, ctx) : req,
    });
    this.stopRender = watchEffect(() => this.renderSections());
  }

  private perSourceClient(reading: AcSourceReading): SparqClient | undefined {
    if (!reading.appId && !reading.apiKey) return undefined;
    const apiHost = this.getAttribute('api-host');
    if (apiHost?.startsWith('mock:')) return undefined; // mock serves all collections
    const appId = reading.appId ?? this.getAttribute('app-id');
    const apiKey = reading.apiKey ?? this.getAttribute('api-key');
    if (!appId || !apiKey) return undefined;
    return createSparqClient({ appId, apiKey });
  }

  private buildSectionSkeleton(): void {
    this.sectionsHost.textContent = '';
    this.sectionEls = this.readings.map((reading, index) => {
      const section = document.createElement('section');
      section.setAttribute('part', 'section');
      section.setAttribute('role', 'group');
      section.hidden = true;
      if (reading.title) {
        const heading = document.createElement('div');
        heading.className = 'section-title';
        heading.setAttribute('part', 'section-title');
        heading.textContent = reading.title;
        section.setAttribute('aria-label', reading.title);
        section.appendChild(heading);
      }
      const items = document.createElement('div');
      items.className = 'items';
      const slot = document.createElement('slot');
      slot.name = `source-${index}`;
      items.appendChild(slot);
      section.appendChild(items);
      this.sectionsHost.appendChild(section);
      return section;
    });
  }

  // ── rendering ───────────────────────────────────────────────────────────

  private clearWrappers(): void {
    this.querySelectorAll(':scope > [data-sparq-ac-wrapper]').forEach((el) => el.remove());
  }

  private defaultRender(item: Item): Node {
    const div = document.createElement('div');
    const firstString = Object.values(item).find((v) => typeof v === 'string');
    div.textContent = firstString !== undefined ? String(firstString) : JSON.stringify(item);
    return div;
  }

  private renderSections(): void {
    const c = this.controller;
    if (!c) return;
    const state = c.state;
    // Reactive reads: mode/status/sources drive re-renders.
    const mode = state.mode;
    const aggregateStatus = state.status;
    const perSource = state.sources.map((s) => ({ items: [...s.items], total: s.totalItems }));

    this.clearWrappers();
    this.flatItems = [];
    let totalSum = 0;

    perSource.forEach((src, sourceIndex) => {
      const section = this.sectionEls[sourceIndex];
      if (!section) return;
      section.hidden = src.items.length === 0;
      totalSum += src.total;
      src.items.forEach((item, itemIndex) => {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-sparq-ac-wrapper', '');
        wrapper.setAttribute('slot', `source-${sourceIndex}`);
        wrapper.setAttribute('role', 'option');
        wrapper.setAttribute('aria-selected', 'false');
        wrapper.id = `${this.id}-opt-${this.flatItems.length}`;
        wrapper.setAttribute('data-flat', String(this.flatItems.length));

        const custom = this.readings[sourceIndex]?.el.renderItem;
        if (custom) {
          const out = custom(item, { index: itemIndex });
          // Dev-trusted by contract (ARCHITECTURE §11), like sparq-items renderItem.
          if (typeof out === 'string') wrapper.innerHTML = out;
          else wrapper.appendChild(out);
        } else {
          const renderer = this.renderers[sourceIndex];
          wrapper.appendChild(renderer ? renderer(item) : this.defaultRender(item));
        }
        this.appendChild(wrapper);
        this.flatItems.push({ wrapper, item, sourceIndex, itemIndex });
      });
    });

    // View-all footer (query mode only); view-all="false" disables it
    // (standard boolean-attr convention, see attrs.ts).
    const viewAllRaw = this.getAttribute('view-all');
    const viewAllDisabled = !parseBoolAttr(viewAllRaw, true);
    const showViewAll = !viewAllDisabled && mode === 'query' && totalSum > 0;
    this.viewAllEl.hidden = !showViewAll;
    if (showViewAll) {
      this.viewAllEl.href = this.searchHref(state.query);
      this.viewAllEl.textContent = viewAllLabel(
        viewAllRaw && !viewAllDisabled ? viewAllRaw : 'View all {count} results',
        totalSum,
      );
    }

    this.statusEl.textContent =
      aggregateStatus === 'success' ? `${this.flatItems.length} suggestions available` : '';

    this.setActive(-1, { scroll: false });

    // Openness policy.
    if (mode === 'inactive') {
      this.closePanel();
      return;
    }
    const hasContent = this.flatItems.length > 0 || showViewAll;
    if (hasContent && this.anchorFocused()) this.openPanel();
    else if (this.open && !hasContent && aggregateStatus === 'success') this.closePanel();
    else if (this.open) this.scheduleReposition();
  }

  // ── anchor + events ─────────────────────────────────────────────────────

  private matchAnchor(target: EventTarget | null): HTMLInputElement | null {
    if (!(target instanceof HTMLElement)) return null;
    if (this.ownInput) return target === this.ownInput ? this.ownInput : null;
    const selector = this.getAttribute('input');
    if (!selector) return null;
    try {
      const el = target.matches(selector) ? target : target.closest(selector);
      return isTextInput(el) ? el : null;
    } catch {
      return null;
    }
  }

  private setAnchor(input: HTMLInputElement): void {
    if (this.anchor === input) return;
    if (this.anchor) restoreAria(this.anchor);
    this.anchor = input;
    applyComboboxAria(input, this.id);
  }

  private anchorFocused(): boolean {
    return this.anchor !== null && this.ownerDocument.activeElement === this.anchor;
  }

  private onFocusIn(e: FocusEvent): void {
    const input = this.matchAnchor(e.target);
    if (!input) return;
    this.setAnchor(input);
    this.controller?.focus();
    if (!this.open && this.flatItems.length > 0) this.openPanel();
  }

  private onInputEvent(e: Event): void {
    const input = this.matchAnchor(e.target);
    if (!input) return;
    this.setAnchor(input);
    this.setActive(-1, { scroll: false });
    this.controller?.setInput(input.value);
  }

  private onKeydown(e: KeyboardEvent): void {
    const input = this.matchAnchor(e.target);
    if (!input || input !== this.anchor) return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.open) {
        this.controller?.focus();
        if (this.flatItems.length === 0) return;
        this.openPanel();
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      this.setActive(moveActive(this.activeIndex, delta, this.flatItems.length));
      return;
    }
    if (e.key === 'Enter') {
      if (this.open && this.activeIndex >= 0) {
        e.preventDefault();
        this.activate(this.activeIndex);
      } else if (this.open || this.ownInput) {
        e.preventDefault();
        this.submitQuery(input.value);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (this.open) {
        e.preventDefault();
        this.closePanel();
      }
      return;
    }
    if (e.key === 'Tab' && this.open) {
      this.closePanel();
    }
  }

  private onDocPointerDown(e: PointerEvent): void {
    if (!this.open) return;
    const path = e.composedPath();
    if (path.includes(this) || (this.anchor && path.includes(this.anchor))) return;
    this.closePanel();
  }

  private onItemClick(e: Event): void {
    const wrapper = (e.target as Element | null)?.closest?.('[data-sparq-ac-wrapper]');
    if (!wrapper || !this.contains(wrapper)) return;
    const entry = this.flatItems[Number(wrapper.getAttribute('data-flat'))];
    if (entry) this.dispatchSelect(entry);
    this.closePanel();
  }

  private onItemHover(e: Event): void {
    const wrapper = (e.target as Element | null)?.closest?.('[data-sparq-ac-wrapper]');
    if (!wrapper || !this.contains(wrapper)) return;
    const flat = Number(wrapper.getAttribute('data-flat'));
    if (flat !== this.activeIndex) this.setActive(flat, { scroll: false });
  }

  // ── active option + activation ──────────────────────────────────────────

  private setActive(index: number, opts: { scroll?: boolean } = {}): void {
    const previous = this.flatItems[this.activeIndex]?.wrapper;
    if (previous) {
      previous.removeAttribute('data-active');
      previous.setAttribute('aria-selected', 'false');
    }
    this.activeIndex = index;
    const entry = this.flatItems[index];
    if (entry) {
      entry.wrapper.setAttribute('data-active', '');
      entry.wrapper.setAttribute('aria-selected', 'true');
      if (opts.scroll !== false) entry.wrapper.scrollIntoView({ block: 'nearest' });
    }
    if (this.anchor) setExpanded(this.anchor, this.open, entry ? entry.wrapper.id : null);
  }

  private activate(index: number): void {
    const entry = this.flatItems[index];
    if (!entry) return;
    this.dispatchSelect(entry);
    const target = entry.wrapper.querySelector<HTMLElement>('a[href], button');
    (target ?? entry.wrapper).click();
    this.closePanel();
  }

  private dispatchSelect(entry: FlatItemEntry): void {
    const reading = this.readings[entry.sourceIndex];
    dispatchSparqEvent(this, 'sparq:ac-select', {
      source: {
        id: `s${entry.sourceIndex}`,
        collection: reading?.collection,
        title: reading?.title ?? null,
      },
      item: entry.item,
      index: entry.itemIndex,
      query: this.controller?.state.query ?? '',
    });
  }

  // ── navigation seam ─────────────────────────────────────────────────────

  private searchHref(query: string): string {
    return buildSearchUrl(
      this.getAttribute('search-url') ?? '/search',
      this.getAttribute('query-param') ?? 'q',
      query,
      this.ownerDocument.baseURI,
    );
  }

  /**
   * THE redirect seam: merchandising redirects (GAP-ANALYSIS Tier 1) hook in
   * here — check the redirects collection for `query`, navigate to its target
   * if matched, else fall through to the search page.
   */
  private submitQuery(query: string): void {
    this.closePanel();
    window.location.assign(this.searchHref(query));
  }

  // ── panel open/close + positioning ──────────────────────────────────────

  private openPanel(): void {
    if (this.open) {
      this.scheduleReposition();
      return;
    }
    this.open = true;
    this.panel.hidden = false;
    this.position();
    if (this.anchor) setExpanded(this.anchor, true, null);
    dispatchSparqEvent(this, 'sparq:ac-open', {
      query: this.controller?.state.query ?? '',
      mode: this.controller?.state.mode ?? 'inactive',
    });
  }

  private closePanel(): void {
    if (!this.open) return;
    this.open = false;
    this.panel.hidden = true;
    this.setActive(-1, { scroll: false });
    if (this.anchor) setExpanded(this.anchor, false, null);
    dispatchSparqEvent(this, 'sparq:ac-close', {});
  }

  private scheduleReposition(): void {
    if (!this.open || this.repositionScheduled) return;
    this.repositionScheduled = true;
    requestAnimationFrame(() => {
      this.repositionScheduled = false;
      if (this.open) this.position();
    });
  }

  private position(): void {
    if (!this.anchor) return;
    const rect = this.anchor.getBoundingClientRect();
    const placement = computePanelPlacement(
      { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      { width: window.innerWidth, height: window.innerHeight },
    );
    this.panel.style.top = placement.top !== undefined ? `${placement.top}px` : '';
    this.panel.style.bottom = placement.bottom !== undefined ? `${placement.bottom}px` : '';
    this.panel.style.left = `${placement.left}px`;
    this.panel.style.minWidth = `${placement.minWidth}px`;
    this.panel.style.maxHeight = `${placement.maxHeight}px`;
  }
}
