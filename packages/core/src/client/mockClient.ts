import type { Item, NumericRange } from '../state';
import type { SearchRequest, SearchResponse, SparqClient } from './types';

export interface MockClientOptions {
  /** Artificial latency, useful for demoing stalled/loading states. */
  delayMs?: number;
  /** Static suggestion pool; enables the suggest() method. */
  suggestions?: string[];
}

function matchesQuery(item: Item, query: string, searchFields?: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const fields = searchFields?.length ? searchFields : Object.keys(item);
  return fields.some((f) => {
    const v = item[f];
    return typeof v === 'string' && v.toLowerCase().includes(q);
  });
}

function matchesFacetFilters(
  item: Item,
  filters: Record<string, string[]>,
  except?: string,
): boolean {
  for (const [attr, values] of Object.entries(filters)) {
    if (attr === except || values.length === 0) continue;
    const v = item[attr];
    if (!values.includes(String(v))) return false;
  }
  return true;
}

function matchesNumericFilters(item: Item, filters: Record<string, NumericRange>): boolean {
  for (const [attr, range] of Object.entries(filters)) {
    const v = item[attr];
    if (typeof v !== 'number') return false;
    if (range.min !== undefined && v < range.min) return false;
    if (range.max !== undefined && v > range.max) return false;
  }
  return true;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * In-memory search engine implementing the SparqClient contract, faithful to the
 * real backend's semantics — including server-side disjunctive facet counts
 * (a facet's own filter is excluded when aggregating that facet, ARCHITECTURE §4).
 */
export function createMockClient(data: Item[], opts: MockClientOptions = {}): SparqClient {
  const client: SparqClient = {
    async search(req: SearchRequest, callOpts?: { signal?: AbortSignal }): Promise<SearchResponse> {
      const started = performance.now();
      if (opts.delayMs) await delay(opts.delayMs, callOpts?.signal);
      if (callOpts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const baseMatch = (item: Item, exceptFacet?: string) =>
        matchesQuery(item, req.query, req.searchFields) &&
        matchesFacetFilters(item, req.facetFilters, exceptFacet) &&
        matchesNumericFilters(item, req.numericFilters);

      let matched = data.filter((item) => baseMatch(item));

      if (req.sort) {
        const [field, dir] = req.sort.split(':');
        const mul = dir === 'desc' ? -1 : 1;
        matched = [...matched].sort((a, b) => {
          const av = a[field ?? ''];
          const bv = b[field ?? ''];
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul;
          return String(av).localeCompare(String(bv)) * mul;
        });
      }

      // Disjunctive counts: for each requested facet, count over the set filtered
      // by everything EXCEPT that facet's own refinement.
      const facets: Record<string, Record<string, number>> = {};
      for (const attr of req.facets) {
        const pool = data.filter((item) => baseMatch(item, attr));
        const counts: Record<string, number> = {};
        for (const item of pool) {
          const v = item[attr];
          if (v === undefined || v === null) continue;
          counts[String(v)] = (counts[String(v)] ?? 0) + 1;
        }
        facets[attr] = counts;
      }

      const facetStats: Record<string, { min: number; max: number }> = {};
      for (const attr of req.numericFacets) {
        const nums = data
          .filter((item) => matchesQuery(item, req.query, req.searchFields))
          .map((item) => item[attr])
          .filter((v): v is number => typeof v === 'number');
        if (nums.length > 0) facetStats[attr] = { min: Math.min(...nums), max: Math.max(...nums) };
      }

      const start = req.page * req.itemsPerPage;
      const items = matched.slice(start, start + req.itemsPerPage);

      return {
        items,
        totalItems: matched.length,
        facets,
        facetStats,
        processingTimeMs: Math.max(1, Math.round(performance.now() - started)),
      };
    },
  };

  if (opts.suggestions) {
    client.suggest = async (query: string) => {
      const q = query.toLowerCase();
      return opts.suggestions!.filter((s) => s.toLowerCase().startsWith(q)).slice(0, 10);
    };
  }

  return client;
}
