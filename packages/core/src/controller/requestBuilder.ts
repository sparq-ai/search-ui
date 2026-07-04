import type { UiState } from '../state';
import type { SearchRequest } from '../client/types';

export interface RequestBuilderOptions {
  collection: string;
  searchFields?: string[];
  returnFields?: string[];
  filter?: string;
}

export interface RegisteredFacets {
  /** Text facet attributes displayed by at least one widget. */
  text: ReadonlySet<string>;
  /** Numeric attributes displayed by at least one range widget. */
  numeric: ReadonlySet<string>;
}

/**
 * State + registered widgets → exactly ONE SearchRequest (ARCHITECTURE §4).
 * Only facets a widget actually displays are requested. If the backend ever
 * stops computing disjunctive counts server-side, this is the single seam
 * where client-side fan-out would be reintroduced.
 */
export function buildRequest(
  ui: UiState,
  registered: RegisteredFacets,
  opts: RequestBuilderOptions,
): SearchRequest {
  const req: SearchRequest = {
    collection: opts.collection,
    query: ui.query,
    page: ui.page,
    itemsPerPage: ui.itemsPerPage,
    sort: ui.sort,
    facets: [...registered.text].sort(),
    numericFacets: [...registered.numeric].sort(),
    facetFilters: sortRecord(ui.facetFilters, (v) => [...v].sort()),
    numericFilters: sortRecord(ui.numericFilters, (v) => v),
  };
  if (opts.searchFields?.length) req.searchFields = opts.searchFields;
  if (opts.returnFields?.length) req.returnFields = opts.returnFields;
  if (opts.filter) req.filter = opts.filter;
  return req;
}

function sortRecord<V>(rec: Record<string, V>, mapValue: (v: V) => V): Record<string, V> {
  const out: Record<string, V> = {};
  for (const key of Object.keys(rec).sort()) {
    out[key] = mapValue(rec[key] as V);
  }
  return out;
}

/** Canonical cache key — object keys are emitted in sorted order at every depth. */
export function canonicalKey(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
