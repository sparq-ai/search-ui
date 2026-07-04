import type { NumericRange, UiState } from '../state';
import type { SearchController } from '../controller/SearchController';

/**
 * URL param format — a STABLE, VERSIONED contract shared with customer
 * backends that server-render <sparq-ssr> fallbacks (ARCHITECTURE §8, §13):
 *
 *   ?q=shoes&page=2&sort=price:asc&f.brand=Nike~Adidas&r.price=10-50
 *
 * `page` is 1-based in URLs. Only non-default values are written.
 * Params not owned by the library are preserved untouched.
 */

const VALUE_SEP = '~';

export function parseUrlState(search: string): Partial<UiState> {
  const params = new URLSearchParams(search);
  const out: Partial<UiState> = {};
  const facetFilters: Record<string, string[]> = {};
  const numericFilters: Record<string, NumericRange> = {};

  for (const [key, value] of params) {
    if (key === 'q') out.query = value;
    else if (key === 'page') {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n) && n >= 1) out.page = n - 1;
    } else if (key === 'sort') out.sort = value || null;
    else if (key.startsWith('f.')) {
      const attr = key.slice(2);
      if (attr) facetFilters[attr] = value.split(VALUE_SEP).filter(Boolean);
    } else if (key.startsWith('r.')) {
      const attr = key.slice(2);
      const m = /^(-?[\d.]*)-(-?[\d.]*)$/.exec(value);
      if (attr && m) {
        const range: NumericRange = {};
        if (m[1]) range.min = Number(m[1]);
        if (m[2]) range.max = Number(m[2]);
        if (range.min !== undefined || range.max !== undefined) numericFilters[attr] = range;
      }
    }
  }

  if (Object.keys(facetFilters).length > 0) out.facetFilters = facetFilters;
  if (Object.keys(numericFilters).length > 0) out.numericFilters = numericFilters;
  return out;
}

export function serializeUrlState(ui: UiState, currentSearch: string): string {
  const params = new URLSearchParams(currentSearch);
  // Drop every param we own, keep everything else.
  for (const key of [...params.keys()]) {
    if (key === 'q' || key === 'page' || key === 'sort' || key.startsWith('f.') || key.startsWith('r.')) {
      params.delete(key);
    }
  }
  if (ui.query) params.set('q', ui.query);
  if (ui.page > 0) params.set('page', String(ui.page + 1));
  if (ui.sort) params.set('sort', ui.sort);
  for (const [attr, values] of Object.entries(ui.facetFilters)) {
    if (values.length > 0) params.set(`f.${attr}`, values.join(VALUE_SEP));
  }
  for (const [attr, range] of Object.entries(ui.numericFilters)) {
    params.set(`r.${attr}`, `${range.min ?? ''}-${range.max ?? ''}`);
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export interface UrlSyncOptions {
  /** Debounce for replaceState while typing. */
  replaceDebounceMs?: number;
}

/**
 * Attach BEFORE the controller's first search so results and URL agree on load.
 * replaceState while typing (debounced); pushState for discrete actions so the
 * back button steps through meaningful states, not keystrokes.
 */
export function attachUrlSync(controller: SearchController, opts: UrlSyncOptions = {}): () => void {
  const replaceDebounceMs = opts.replaceDebounceMs ?? 400;
  let applyingFromUrl = false;
  let lastSerialized = '';
  let lastQuery = '';
  let replaceTimer: ReturnType<typeof setTimeout> | undefined;

  // 1. URL → state, before the first search.
  const initial = parseUrlState(window.location.search);
  if (Object.keys(initial).length > 0) {
    applyingFromUrl = true;
    controller.setUiState(initial);
    applyingFromUrl = false;
  }
  lastQuery = controller.state.query;
  lastSerialized = serializeUrlState(snapshot(controller), window.location.search);

  // 2. State → URL.
  const unsubscribe = controller.on('stateChange', () => {
    if (applyingFromUrl) return;
    const ui = snapshot(controller);
    const serialized = serializeUrlState(ui, window.location.search);
    if (serialized === lastSerialized) return;

    const queryOnlyChange =
      ui.query !== lastQuery &&
      serializeUrlState({ ...ui, query: lastQuery }, window.location.search) === lastSerialized;
    lastSerialized = serialized;
    lastQuery = ui.query;

    const url = serialized || window.location.pathname;
    if (queryOnlyChange) {
      clearTimeout(replaceTimer);
      replaceTimer = setTimeout(() => window.history.replaceState(null, '', url), replaceDebounceMs);
    } else {
      clearTimeout(replaceTimer);
      window.history.pushState(null, '', url);
    }
  });

  // 3. Back/forward → state.
  const onPopstate = () => {
    applyingFromUrl = true;
    const parsed = parseUrlState(window.location.search);
    controller.setUiState({
      query: parsed.query ?? '',
      page: parsed.page ?? 0,
      sort: parsed.sort ?? null,
      facetFilters: parsed.facetFilters ?? {},
      numericFilters: parsed.numericFilters ?? {},
    });
    lastSerialized = serializeUrlState(snapshot(controller), window.location.search);
    lastQuery = controller.state.query;
    applyingFromUrl = false;
  };
  window.addEventListener('popstate', onPopstate);

  return () => {
    clearTimeout(replaceTimer);
    unsubscribe();
    window.removeEventListener('popstate', onPopstate);
  };
}

function snapshot(controller: SearchController): UiState {
  const s = controller.state;
  return {
    query: s.query,
    page: s.page,
    itemsPerPage: s.itemsPerPage,
    sort: s.sort,
    facetFilters: { ...s.facetFilters },
    numericFilters: { ...s.numericFilters },
  };
}
