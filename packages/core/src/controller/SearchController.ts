import { reactive } from '@vue/reactivity';
import type {
  FacetValue,
  Item,
  NumericRange,
  SearchError,
  SearchResults,
  SearchState,
  UiState,
} from '../state';
import { cloneUiState, defaultUiState } from '../state';
import type { SearchRequest, SearchResponse, SparqClient } from '../client/types';
import { isAbortError, normalizeToSearchError } from '../client/types';
import { buildRequest, canonicalKey } from './requestBuilder';
import { LruCache } from './cache';

export interface SearchHooks {
  transformRequest?: (req: SearchRequest, ctx: { uiState: UiState }) => SearchRequest | Promise<SearchRequest>;
  transformResponse?: (res: SearchResponse, ctx: { request: SearchRequest }) => SearchResponse | Promise<SearchResponse>;
  transformItems?: (items: Item[], ctx: { uiState: UiState }) => Item[] | Promise<Item[]>;
  queryHook?: (query: string, search: (q: string) => void) => void;
  suggestionsSource?: (query: string) => Promise<string[]> | string[];
  onError?: (error: SearchError, ctx: { retry: () => void }) => void | false;
}

export type WidgetRole =
  | 'searchbox'
  | 'items'
  | 'filters'
  | 'sort'
  | 'pagination'
  | 'range'
  | 'refinements'
  | 'stats'
  | 'ssr';

export interface WidgetRegistration {
  role: WidgetRole;
  /** Filters widgets: request counts for this text facet attribute. */
  facetAttribute?: string;
  /** Range widgets: request stats for this numeric attribute. */
  numericAttribute?: string;
}

export interface ControllerOptions {
  collection: string;
  itemsPerPage?: number;
  debounceMs?: number;
  stalledDelayMs?: number;
  searchFields?: string[];
  returnFields?: string[];
  filter?: string;
  hooks?: SearchHooks;
  initialUiState?: Partial<UiState>;
}

export type ControllerEventName =
  | 'search'
  | 'error'
  | 'stateChange'
  | 'query-change'
  | 'refine'
  | 'page-change'
  | 'item-click';

export interface Refinement {
  attr: string;
  value: string;
  label: string;
  type: 'facet' | 'numeric';
}

interface Inflight {
  key: string;
  promise: Promise<SearchResponse>;
  abort: AbortController;
}

export class SearchController {
  readonly state: SearchState;
  hooks: SearchHooks;

  private client: SparqClient;
  private options: Required<Pick<ControllerOptions, 'collection' | 'itemsPerPage' | 'debounceMs' | 'stalledDelayMs'>> &
    Pick<ControllerOptions, 'searchFields' | 'returnFields' | 'filter'>;

  private textFacets = new Map<string, number>();
  private numericFacets = new Map<string, number>();

  private latestId = 0;
  private suggestId = 0;
  private started = false;
  private disposed = false;
  private appendNext = false;
  private pageFromLoadMore = false;
  private microtaskScheduled = false;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private stalledTimer: ReturnType<typeof setTimeout> | undefined;
  private inflight: Inflight | null = null;
  private accumulatedQueryIds: string[] = [];
  private cache = new LruCache<SearchResponse>();
  private listeners = new Map<ControllerEventName, Set<(detail: unknown) => void>>();
  private subscribers = new Set<(state: Readonly<SearchState>) => void>();

  constructor(client: SparqClient, options: ControllerOptions) {
    this.client = client;
    this.hooks = options.hooks ?? {};
    this.options = {
      collection: options.collection,
      itemsPerPage: options.itemsPerPage ?? 20,
      debounceMs: options.debounceMs ?? 200,
      stalledDelayMs: options.stalledDelayMs ?? 200,
      searchFields: options.searchFields,
      returnFields: options.returnFields,
      filter: options.filter,
    };
    const ui = { ...defaultUiState(), itemsPerPage: this.options.itemsPerPage, ...options.initialUiState };
    this.state = reactive<SearchState>({
      ...ui,
      status: 'idle',
      results: null,
      accumulatedItems: [],
      error: null,
      suggestions: [],
    }) as SearchState;
  }

  // ── intents ─────────────────────────────────────────────────────────────

  setQuery(q: string): void {
    if (this.hooks.queryHook) {
      this.hooks.queryHook(q, (finalQ) => this.applyQuery(finalQ));
    } else {
      this.applyQuery(q);
    }
  }

  private applyQuery(q: string): void {
    if (this.state.query === q) return;
    this.state.query = q;
    this.state.page = 0;
    this.emit('query-change', { query: q });
    this.schedule('debounced');
  }

  /** Immediate search with the current query — e.g. pressing Enter. */
  searchNow(): void {
    this.schedule('immediate');
  }

  setPage(page: number): void {
    const clamped = Math.max(0, Math.min(page, this.totalPages - 1));
    if (this.state.page === clamped) return;
    this.state.page = clamped;
    this.pageFromLoadMore = false;
    this.emit('page-change', { page: clamped });
    this.schedule('immediate');
  }

  setSort(sortKey: string | null): void {
    if (this.state.sort === sortKey) return;
    this.state.sort = sortKey;
    this.state.page = 0;
    this.emit('refine', { attr: '_sort', value: sortKey, uiState: this.snapshotUiState() });
    this.schedule('immediate');
  }

  setItemsPerPage(n: number): void {
    if (n <= 0 || this.state.itemsPerPage === n) return;
    this.state.itemsPerPage = n;
    this.state.page = 0;
    this.schedule('immediate');
  }

  toggleFacetValue(attr: string, value: string): void {
    const current = this.state.facetFilters[attr] ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    if (next.length === 0) delete this.state.facetFilters[attr];
    else this.state.facetFilters[attr] = next;
    this.state.page = 0;
    this.emit('refine', { attr, value, uiState: this.snapshotUiState() });
    this.schedule('immediate');
  }

  setFacetValues(attr: string, values: string[]): void {
    if (values.length === 0) delete this.state.facetFilters[attr];
    else this.state.facetFilters[attr] = [...values];
    this.state.page = 0;
    this.emit('refine', { attr, uiState: this.snapshotUiState() });
    this.schedule('immediate');
  }

  setNumericRange(attr: string, range: NumericRange | null): void {
    if (range === null || (range.min === undefined && range.max === undefined)) {
      delete this.state.numericFilters[attr];
    } else {
      this.state.numericFilters[attr] = { ...range };
    }
    this.state.page = 0;
    this.emit('refine', { attr, uiState: this.snapshotUiState() });
    this.schedule('immediate');
  }

  clearRefinements(attr?: string): void {
    if (attr) {
      delete this.state.facetFilters[attr];
      delete this.state.numericFilters[attr];
    } else {
      this.state.facetFilters = {};
      this.state.numericFilters = {};
    }
    this.state.page = 0;
    this.emit('refine', { attr: attr ?? '*', uiState: this.snapshotUiState() });
    this.schedule('immediate');
  }

  /** Batch state application (URL sync, host-page JS). */
  setUiState(partial: Partial<UiState>): void {
    if (partial.query !== undefined) this.state.query = partial.query;
    if (partial.page !== undefined) {
      this.state.page = partial.page;
      this.pageFromLoadMore = false;
    }
    if (partial.itemsPerPage !== undefined) this.state.itemsPerPage = partial.itemsPerPage;
    if (partial.sort !== undefined) this.state.sort = partial.sort;
    if (partial.facetFilters !== undefined) this.state.facetFilters = { ...partial.facetFilters };
    if (partial.numericFilters !== undefined) this.state.numericFilters = { ...partial.numericFilters };
    this.schedule('immediate');
  }

  async loadMore(): Promise<void> {
    if (this.isLastPage || this.state.status === 'loading' || this.state.status === 'stalled') return;
    this.state.page += 1;
    this.appendNext = true;
    this.pageFromLoadMore = true;
    await this.run();
  }

  /**
   * True when the page was reached by loadMore() rather than an explicit
   * navigation. Routing omits it: "scrolled through 8 pages" is not "?page=8".
   */
  get isAccumulatedPage(): boolean {
    return this.pageFromLoadMore;
  }

  refresh(): void {
    this.cache.clear();
    this.schedule('immediate');
  }

  async fetchSuggestions(q: string): Promise<void> {
    const source =
      this.hooks.suggestionsSource ??
      (this.client.suggest ? (query: string) => this.client.suggest!(query) : null);
    if (!source || q.length === 0) {
      this.state.suggestions = [];
      return;
    }
    const sid = ++this.suggestId;
    try {
      const suggestions = await source(q);
      if (sid === this.suggestId && !this.disposed) this.state.suggestions = suggestions.slice(0, 10);
    } catch {
      /* suggestions are best-effort */
    }
  }

  // ── derived ─────────────────────────────────────────────────────────────

  get totalPages(): number {
    return this.state.results?.totalPages ?? 1;
  }

  get isLastPage(): boolean {
    return this.state.page >= this.totalPages - 1;
  }

  get hasRefinements(): boolean {
    return (
      Object.keys(this.state.facetFilters).length > 0 ||
      Object.keys(this.state.numericFilters).length > 0
    );
  }

  get refinements(): Refinement[] {
    const out: Refinement[] = [];
    for (const [attr, values] of Object.entries(this.state.facetFilters)) {
      for (const value of values) out.push({ attr, value, label: `${attr}: ${value}`, type: 'facet' });
    }
    for (const [attr, range] of Object.entries(this.state.numericFilters)) {
      const value = `${range.min ?? ''}-${range.max ?? ''}`;
      out.push({ attr, value, label: `${attr}: ${range.min ?? '…'}–${range.max ?? '…'}`, type: 'numeric' });
    }
    return out;
  }

  // ── lifecycle & wiring ──────────────────────────────────────────────────

  /** Fired by the provider — runs the initial search. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.schedule('immediate');
  }

  registerWidget(reg: WidgetRegistration): () => void {
    const bump = (map: Map<string, number>, attr: string | undefined, delta: number): boolean => {
      if (!attr) return false;
      const next = (map.get(attr) ?? 0) + delta;
      if (next <= 0) map.delete(attr);
      else map.set(attr, next);
      return delta > 0 ? next === 1 : next === 0;
    };
    const addedText = bump(this.textFacets, reg.facetAttribute, +1);
    const addedNumeric = bump(this.numericFacets, reg.numericAttribute, +1);
    if ((addedText || addedNumeric) && this.started) this.schedule('immediate');

    let unregistered = false;
    return () => {
      if (unregistered) return;
      unregistered = true;
      bump(this.textFacets, reg.facetAttribute, -1);
      bump(this.numericFacets, reg.numericAttribute, -1);
    };
  }

  /**
   * Report a result click on the controller bus (widgets call this alongside
   * their DOM event). `index` is the position in the rendered list (which is
   * accumulatedItems in both paged and infinite modes), so the per-page
   * queryId lookup attributes the click to the exact search that produced
   * that item — not merely the most recent page's search.
   */
  trackItemClick(item: Item, index: number): void {
    const queryId = this.accumulatedQueryIds[index] || this.state.results?.queryId;
    this.emit('item-click', { item, index, queryId });
  }

  subscribe(fn: (state: Readonly<SearchState>) => void): () => void {
    this.subscribers.add(fn);
    fn(this.state);
    return () => this.subscribers.delete(fn);
  }

  on(event: ControllerEventName, fn: (detail: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn);
    return () => set.delete(fn);
  }

  dispose(): void {
    this.disposed = true;
    this.inflight?.abort.abort();
    this.inflight = null;
    clearTimeout(this.debounceTimer);
    clearTimeout(this.stalledTimer);
    this.listeners.clear();
    this.subscribers.clear();
    this.cache.clear();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private emit(event: ControllerEventName, detail: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(detail));
  }

  private notify(): void {
    this.emit('stateChange', this.state);
    this.subscribers.forEach((fn) => fn(this.state));
  }

  private snapshotUiState(): UiState {
    return cloneUiState({
      query: this.state.query,
      page: this.state.page,
      itemsPerPage: this.state.itemsPerPage,
      sort: this.state.sort,
      facetFilters: this.state.facetFilters,
      numericFilters: this.state.numericFilters,
    });
  }

  private schedule(kind: 'immediate' | 'debounced'): void {
    if (!this.started || this.disposed) return;
    if (kind === 'debounced') {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => void this.run(), this.options.debounceMs);
      return;
    }
    if (this.microtaskScheduled) return;
    this.microtaskScheduled = true;
    queueMicrotask(() => {
      this.microtaskScheduled = false;
      if (this.disposed) return;
      clearTimeout(this.debounceTimer);
      void this.run();
    });
  }

  private async run(): Promise<void> {
    const append = this.appendNext;
    this.appendNext = false;
    const ui = this.snapshotUiState();
    const id = ++this.latestId;

    try {
      let req = buildRequest(
        ui,
        { text: new Set(this.textFacets.keys()), numeric: new Set(this.numericFacets.keys()) },
        this.options,
      );
      if (this.hooks.transformRequest) {
        req = await this.hooks.transformRequest(req, { uiState: ui });
        if (id !== this.latestId || this.disposed) return;
      }
      const key = canonicalKey(req);

      this.state.status = 'loading';
      clearTimeout(this.stalledTimer);
      this.stalledTimer = setTimeout(() => {
        if (id === this.latestId && this.state.status === 'loading') this.state.status = 'stalled';
      }, this.options.stalledDelayMs);

      let res = this.cache.get(key);
      if (!res) {
        let flight = this.inflight;
        if (flight && flight.key !== key) {
          flight.abort.abort();
          flight = null;
        }
        if (!flight) {
          const abort = new AbortController();
          const promise = this.client.search(req, { signal: abort.signal });
          flight = { key, promise, abort };
          this.inflight = flight;
          promise
            .catch(() => {})
            .finally(() => {
              if (this.inflight === flight) this.inflight = null;
            });
        }
        res = await flight.promise;
        this.cache.set(key, res);
      }
      if (id !== this.latestId || this.disposed) return;

      if (this.hooks.transformResponse) {
        res = await this.hooks.transformResponse(res, { request: req });
        if (id !== this.latestId || this.disposed) return;
      }

      let items = res.items;
      if (this.hooks.transformItems) {
        items = await this.hooks.transformItems(items, { uiState: ui });
        if (id !== this.latestId || this.disposed) return;
      }

      clearTimeout(this.stalledTimer);
      const totalPages = Math.max(1, Math.ceil(res.totalItems / ui.itemsPerPage));
      const results: SearchResults = {
        items,
        totalItems: res.totalItems,
        page: ui.page,
        totalPages,
        facets: this.mergeFacets(res.facets, ui),
        facetStats: res.facetStats ?? {},
        processingTimeMs: res.processingTimeMs,
        queryId: res.queryId,
        forUiState: ui,
      };
      this.state.results = results;
      this.state.accumulatedItems = append ? [...this.state.accumulatedItems, ...items] : [...items];
      // Parallel to accumulatedItems: which search produced each rendered item.
      // In accumulated (infinite-scroll) mode the latest results.queryId belongs
      // to the newest page only — a click on a page-1 item three loads later
      // must still attribute to page 1's search.
      const pageIds = items.map(() => res.queryId ?? '');
      this.accumulatedQueryIds = append ? [...this.accumulatedQueryIds, ...pageIds] : pageIds;
      this.state.status = 'success';
      this.state.error = null;
      this.emit('search', { results, uiState: ui, raw: res.raw });
      this.notify();
    } catch (e) {
      if (isAbortError(e)) return;
      if (id !== this.latestId || this.disposed) return;
      clearTimeout(this.stalledTimer);
      const err = normalizeToSearchError(e);
      const suppressed = this.hooks.onError?.(err, { retry: () => this.refresh() }) === false;
      this.emit('error', err);
      if (suppressed) {
        this.state.status = this.state.results ? 'success' : 'idle';
      } else {
        this.state.error = err;
        this.state.status = 'error';
      }
      this.notify();
    }
  }

  /**
   * Wire counts → FacetValue[] with `selected` flags. Zero-count retention:
   * a selected value missing from the response counts is re-appended with
   * count 0 so a checked box never vanishes (ARCHITECTURE §4).
   */
  private mergeFacets(
    counts: Record<string, Record<string, number>>,
    ui: UiState,
  ): Record<string, FacetValue[]> {
    const out: Record<string, FacetValue[]> = {};
    for (const [attr, valueCounts] of Object.entries(counts)) {
      const selected = new Set(ui.facetFilters[attr] ?? []);
      const values: FacetValue[] = Object.entries(valueCounts)
        .map(([value, count]) => ({ value, count, selected: selected.has(value) }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
      for (const sel of selected) {
        if (!(sel in valueCounts)) values.push({ value: sel, count: 0, selected: true });
      }
      out[attr] = values;
    }
    // A refined attribute may be entirely absent from the response (no widget
    // requested it, or nothing matched) — still surface its selected values.
    for (const [attr, selectedValues] of Object.entries(ui.facetFilters)) {
      if (out[attr] || selectedValues.length === 0) continue;
      out[attr] = selectedValues.map((value) => ({ value, count: 0, selected: true }));
    }
    return out;
  }
}
