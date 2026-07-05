import { reactive } from '@vue/reactivity';
import type { Item, SearchError, UiState } from '../state';
import { defaultUiState } from '../state';
import type { SearchRequest, SearchResponse, SparqClient } from '../client/types';
import { isAbortError, normalizeToSearchError } from '../client/types';
import { buildRequest, canonicalKey } from './requestBuilder';
import { LruCache } from './cache';

/**
 * Federated autocomplete orchestration (ARCHITECTURE §9, <sparq-autocomplete>).
 *
 * Deliberately NOT SearchController: that class enforces the load-bearing
 * one-request-per-search invariant and owns facets/pagination/URL sync — all
 * wrong-shaped for N parallel sources. This controller fans out one small
 * request per ACTIVE source per settled keystroke, commits each source
 * independently as it settles (progressive fill), and isolates failures.
 */

export type AcShowOn = 'query' | 'empty' | 'always';
export type AcMode = 'empty' | 'query' | 'inactive';

export interface AcSourceConfig {
  /** Stable key supplied by the component (used for state + cache identity). */
  id: string;
  collection: string;
  limit?: number;
  showOn?: AcShowOn;
  searchFields?: string[];
  filter?: string;
  sort?: string | null;
  /** Per-source credential override; defaults to the shared client. */
  client?: SparqClient;
  transformItems?: (items: Item[], ctx: { query: string }) => Item[] | Promise<Item[]>;
}

export interface AcSourceState {
  id: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  items: Item[];
  totalItems: number;
  /** The settled query these items answer. */
  forQuery: string;
  error: SearchError | null;
}

export interface AutocompleteState {
  /** Raw input value, live. */
  inputValue: string;
  /** Last settled (post-debounce) query. */
  query: string;
  mode: AcMode;
  status: 'idle' | 'loading' | 'success';
  sources: AcSourceState[];
}

export interface AutocompleteControllerOptions {
  sources: AcSourceConfig[];
  minChars?: number;
  debounceMs?: number;
  /** Host-level request hook — same signature family as SearchHooks. */
  transformRequest?: (req: SearchRequest, ctx: { uiState: UiState }) => SearchRequest | Promise<SearchRequest>;
}

export type AcEventName = 'results' | 'error';

export function modeForInput(length: number, minChars: number): AcMode {
  if (length === 0) return 'empty';
  if (length >= minChars) return 'query';
  return 'inactive';
}

export function sourceActiveInMode(showOn: AcShowOn, mode: AcMode): boolean {
  if (mode === 'inactive') return false;
  if (mode === 'empty') return showOn === 'empty' || showOn === 'always';
  return showOn === 'query' || showOn === 'always';
}

function blankSourceState(id: string): AcSourceState {
  return { id, status: 'idle', items: [], totalItems: 0, forQuery: '', error: null };
}

export class AutocompleteController {
  readonly state: AutocompleteState;

  private client: SparqClient;
  private sources: AcSourceConfig[];
  private minChars: number;
  private debounceMs: number;
  private transformRequest: AutocompleteControllerOptions['transformRequest'];

  private latestRunId = 0;
  private runAbort: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private cache = new LruCache<SearchResponse>();
  private listeners = new Map<AcEventName, Set<(detail: unknown) => void>>();
  private disposed = false;

  constructor(client: SparqClient, options: AutocompleteControllerOptions) {
    this.client = client;
    this.sources = options.sources;
    this.minChars = options.minChars ?? 1;
    this.debounceMs = options.debounceMs ?? 200;
    this.transformRequest = options.transformRequest;
    this.state = reactive<AutocompleteState>({
      inputValue: '',
      query: '',
      mode: 'inactive',
      status: 'idle',
      sources: options.sources.map((s) => blankSourceState(s.id)),
    }) as AutocompleteState;
  }

  /** Live input updates; the query settles after the debounce ('' immediately). */
  setInput(value: string): void {
    if (this.disposed) return;
    this.state.inputValue = value;
    clearTimeout(this.debounceTimer);
    if (value === '') {
      this.settle();
      return;
    }
    this.debounceTimer = setTimeout(() => this.settle(), this.debounceMs);
  }

  /** Focus with an empty input enters empty mode (popular sources; cache-served). */
  focus(): void {
    if (this.disposed) return;
    if (this.state.inputValue === '') this.settle();
  }

  /** Rebuild from re-registered source elements; re-runs the current mode. */
  setSources(sources: AcSourceConfig[]): void {
    if (this.disposed) return;
    this.sources = sources;
    this.state.sources = sources.map((s) => blankSourceState(s.id));
    this.settle();
  }

  refresh(): void {
    if (this.disposed) return;
    this.cache.clear();
    this.settle();
  }

  on(event: AcEventName, fn: (detail: unknown) => void): () => void {
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
    clearTimeout(this.debounceTimer);
    this.runAbort?.abort();
    this.runAbort = null;
    this.listeners.clear();
    this.cache.clear();
  }

  // ── internals ───────────────────────────────────────────────────────────

  private emit(event: AcEventName, detail: unknown): void {
    this.listeners.get(event)?.forEach((fn) => fn(detail));
  }

  private sourceState(id: string): AcSourceState | undefined {
    return this.state.sources.find((s) => s.id === id);
  }

  private settle(): void {
    clearTimeout(this.debounceTimer);
    const query = this.state.inputValue;
    const mode = modeForInput(query.length, this.minChars);
    this.state.query = query;
    this.state.mode = mode;

    const runId = ++this.latestRunId;
    this.runAbort?.abort();

    const active = this.sources.filter((s) => sourceActiveInMode(s.showOn ?? 'query', mode));
    if (active.length === 0) {
      this.runAbort = null;
      this.state.status = 'idle';
      for (const s of this.state.sources) Object.assign(s, blankSourceState(s.id));
      return;
    }

    const abort = new AbortController();
    this.runAbort = abort;
    this.state.status = 'loading';

    const activeIds = new Set(active.map((s) => s.id));
    for (const s of this.state.sources) {
      if (!activeIds.has(s.id)) Object.assign(s, blankSourceState(s.id));
    }

    let pending = active.length;
    const onSourceSettled = () => {
      pending -= 1;
      if (pending === 0 && runId === this.latestRunId && !this.disposed) {
        this.state.status = 'success';
        this.emit('results', { query, mode, sources: this.state.sources });
      }
    };

    // Query mode uses the settled query; empty mode always queries "".
    const effectiveQuery = mode === 'empty' ? '' : query;
    for (const source of active) {
      void this.runSource(source, effectiveQuery, runId, abort.signal).finally(onSourceSettled);
    }
  }

  private async runSource(
    source: AcSourceConfig,
    query: string,
    runId: number,
    signal: AbortSignal,
  ): Promise<void> {
    const stale = () => runId !== this.latestRunId || this.disposed;
    const target = this.sourceState(source.id);
    if (!target) return;
    target.status = 'loading';

    try {
      const ui: UiState = {
        ...defaultUiState(),
        query,
        itemsPerPage: source.limit ?? 5,
        sort: source.sort ?? null,
      };
      let req = buildRequest(
        ui,
        { text: new Set(), numeric: new Set() },
        { collection: source.collection, searchFields: source.searchFields, filter: source.filter },
      );
      if (this.transformRequest) {
        req = await this.transformRequest(req, { uiState: ui });
        if (stale()) return;
      }

      const clientTag = source.client ? `s:${source.id}` : 'd';
      const key = `${clientTag}|${canonicalKey(req)}`;
      let res = this.cache.get(key);
      if (!res) {
        res = await (source.client ?? this.client).search(req, { signal });
        if (stale()) return;
        this.cache.set(key, res);
      }

      let items = res.items;
      if (source.transformItems) {
        items = await source.transformItems(items, { query });
        if (stale()) return;
      }

      target.items = items;
      target.totalItems = res.totalItems;
      target.forQuery = query;
      target.status = 'success';
      target.error = null;
    } catch (e) {
      if (isAbortError(e) || stale()) return;
      // Failure isolation: this section hides, siblings keep their results.
      const error = normalizeToSearchError(e);
      target.items = [];
      target.totalItems = 0;
      target.forQuery = query;
      target.status = 'error';
      target.error = error;
      this.emit('error', { sourceId: source.id, error });
    }
  }
}
