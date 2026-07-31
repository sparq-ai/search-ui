import type { Item, NumericRange, SearchError } from '../state';

/** Normalized request — the shape the whole library codes against. */
export interface SearchRequest {
  collection: string;
  query: string;
  /** 0-based. */
  page: number;
  itemsPerPage: number;
  /**
   * One sort key, or several in priority order. An array is what the API needs
   * for a tiebreak: ["-_rank", "-price"] keeps relevance primary and orders
   * equally-relevant hits by price. A comma-joined string does NOT work — the
   * API reads one key per array element.
   */
  sort: string | string[] | null;
  /** Text facet attributes to return counts for. */
  facets: string[];
  /** Numeric facet attributes to return stats for. */
  numericFacets: string[];
  facetFilters: Record<string, string[]>;
  numericFilters: Record<string, NumericRange>;
  searchFields?: string[];
  returnFields?: string[];
  /** Raw filter-string escape hatch, passed through to the API verbatim. */
  filter?: string;
  /**
   * Extra body fields merged into the request verbatim, last. The escape hatch
   * for anything this interface does not model yet — an integration can reach a
   * new API field without waiting for a library release. Nothing validates it,
   * so a wrong key is simply sent and rejected by the API.
   */
  raw?: Record<string, unknown>;
}

/** Normalized response. The adapter maps API wire fields into this. */
export interface SearchResponse {
  items: Item[];
  totalItems: number;
  /** attr -> value -> count. Counts are disjunctive server-side (see ARCHITECTURE §4). */
  facets: Record<string, Record<string, number>>;
  facetStats?: Record<string, { min: number; max: number }>;
  processingTimeMs: number;
  /**
   * Reserved for backend match metadata (positions / pre-highlighted fields).
   * Unused in v1 — no highlighting exists until the API provides this.
   */
  highlights?: unknown;
  /** Untouched API payload for power users (exposed on the sparq:search event). */
  raw?: unknown;
}

export interface SparqClient {
  search(req: SearchRequest, opts?: { signal?: AbortSignal }): Promise<SearchResponse>;
  /** Optional — the Sparq API has no suggest endpoint yet; hidden UI when absent. */
  suggest?(query: string, opts?: { signal?: AbortSignal }): Promise<string[]>;
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

export function normalizeToSearchError(e: unknown): SearchError {
  if (typeof e === 'object' && e !== null && 'type' in e && 'retryable' in e && 'message' in e) {
    return e as SearchError;
  }
  if (e instanceof TypeError) {
    return { type: 'network', message: e.message, retryable: true };
  }
  return { type: 'client', message: e instanceof Error ? e.message : String(e), retryable: false };
}

export function searchErrorFromStatus(status: number, message: string): SearchError {
  if (status === 401 || status === 403) return { type: 'auth', status, message, retryable: false };
  if (status === 429) return { type: 'rate-limit', status, message, retryable: true };
  if (status >= 500) return { type: 'server', status, message, retryable: true };
  return { type: 'client', status, message, retryable: false };
}
