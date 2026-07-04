import type { SearchRequest, SearchResponse, SparqClient } from './types';
import { searchErrorFromStatus } from './types';

/**
 * The ONLY file that knows the Sparq REST API.
 * Endpoint: POST https://{appUniqueId}.fast.sparq.ai/v2  (Bearer auth)
 * Docs: https://docs.sparq.ai/api-docs/search-records
 *
 * Wire behaviors verified against a production store (2026-07-04):
 * - Omitting `fields` returns bare {id, _rank} items → default to ["*"].
 * - Sort: "field" = ascending, "-field" = descending ("field:desc" is IGNORED
 *   by the API — the adapter translates our "field:desc" convention).
 * - Response `textFacets`: attr → [{label, value}] where label is the facet
 *   VALUE and value is the COUNT.
 * - Text AND numeric facet counts are disjunctive server-side (own filter
 *   excluded) — the load-bearing single-request contract, ARCHITECTURE §4.
 * - `numericFacets: {attr: []}` cheaply returns `stats: {attr: {min,avg,max}}`.
 * - Arbitrary numeric ranges filter via the `filter` string
 *   ("price >= 5 AND price <= 20"), which the adapter composes with any
 *   user-supplied filter.
 */
export interface SparqClientConfig {
  appId: string;
  apiKey: string;
  /** Override the default `https://{appId}.fast.sparq.ai` host (e.g. for staging). */
  host?: string;
}

/** "field" | "field:asc" → "field"; "field:desc" → "-field"; "-field" passes through. */
function toWireSort(sort: string): string {
  if (sort.startsWith('-')) return sort;
  const [field, dir] = sort.split(':');
  return dir === 'desc' ? `-${field}` : (field ?? sort);
}

function buildFilterString(req: SearchRequest): string | undefined {
  const parts: string[] = [];
  if (req.filter) parts.push(`(${req.filter})`);
  for (const [attr, range] of Object.entries(req.numericFilters)) {
    if (range.min !== undefined) parts.push(`${attr} >= ${range.min}`);
    if (range.max !== undefined) parts.push(`${attr} <= ${range.max}`);
  }
  return parts.length > 0 ? parts.join(' AND ') : undefined;
}

/** attr → [{label: <facet value>, value: <count>}] (verified live shape). */
function normalizeFacets(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [attr, entries] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      if (e.label !== undefined) {
        counts[String(e.label)] = Number(e.value ?? e.count ?? 0);
      } else if (e.value !== undefined) {
        // defensive fallback for a {value, count} variant
        counts[String(e.value)] = Number(e.count ?? 0);
      }
    }
    out[attr] = counts;
  }
  return out;
}

/** Response `stats`: attr → {min, avg, max} → our facetStats {min, max}. */
function normalizeStats(raw: unknown): Record<string, { min: number; max: number }> {
  const out: Record<string, { min: number; max: number }> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [attr, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.min === 'number' && typeof e.max === 'number') out[attr] = { min: e.min, max: e.max };
  }
  return out;
}

export function createSparqClient(cfg: SparqClientConfig): SparqClient {
  const host = (cfg.host ?? `https://${cfg.appId}.fast.sparq.ai`).replace(/\/$/, '');
  const endpoint = `${host}/v2`;

  return {
    async search(req: SearchRequest, opts?: { signal?: AbortSignal }): Promise<SearchResponse> {
      const body: Record<string, unknown> = {
        query: req.query,
        collection: req.collection,
        skip: req.page * req.itemsPerPage,
        count: req.itemsPerPage,
        fields: req.returnFields?.length ? req.returnFields : ['*'],
      };
      if (req.sort) body.sort = [toWireSort(req.sort)];
      if (req.facets.length > 0) {
        body.textFacets = req.facets;
        body.facetCount = 100;
      }
      if (req.facets.length > 0 || Object.keys(req.facetFilters).length > 0) {
        body.textFacetFilters = req.facetFilters;
      }
      if (req.numericFacets.length > 0) {
        // Empty bucket list per attr → response carries stats {min, avg, max}.
        body.numericFacets = Object.fromEntries(req.numericFacets.map((attr) => [attr, []]));
      }
      const filter = buildFilterString(req);
      if (filter) body.filter = filter;
      if (req.searchFields?.length) body.searchFields = req.searchFields;

      let httpRes: Response;
      try {
        httpRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: opts?.signal,
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        throw { type: 'network', message: e instanceof Error ? e.message : 'Network request failed', retryable: true };
      }

      if (!httpRes.ok) {
        let message = `Sparq API responded ${httpRes.status}`;
        try {
          const errBody = (await httpRes.json()) as { data?: unknown; message?: unknown };
          if (errBody.data) message = String(errBody.data);
          else if (errBody.message) message = String(errBody.message);
        } catch {
          /* non-JSON error body */
        }
        throw searchErrorFromStatus(httpRes.status, message);
      }

      const wire = (await httpRes.json()) as Record<string, unknown>;
      return {
        items: Array.isArray(wire.results) ? (wire.results as SearchResponse['items']) : [],
        // `totalHits` is the API wire field — renamed here and nowhere else (ARCHITECTURE §19).
        totalItems: Number(wire.totalHits ?? 0),
        facets: normalizeFacets(wire.textFacets),
        facetStats: normalizeStats(wire.stats),
        processingTimeMs: Number(wire.responseTime ?? 0),
        raw: wire,
      };
    },
  };
}
