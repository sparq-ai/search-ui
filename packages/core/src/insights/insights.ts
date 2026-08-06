import type { SearchController } from '../controller/SearchController';
import type { Item } from '../state';
import { InsightsClient, type InsightsConfig } from './insightsClient';
import { queryIdFor, rememberClick } from './clickMap';

/**
 * Insights — automatic search analytics (ARCHITECTURE-level opt-in: the
 * `insights` attribute on <sparq-search>, or configureInsights() for pages
 * without a search element, e.g. order confirmation).
 *
 * Event taxonomy matches the existing Sparq pipeline (st-tracking → BigQuery
 * user_analytics): search-query / empty-search-query (analytics-js names),
 * search-session (session-based CTR denominator), product-clicked, and
 * purchase-complete with eventData.order.{orderId, amount} — the fields the
 * existing analytics SQL already reads. Attribution is queryID-chained: every
 * click carries the queryId of the results on screen, and purchases rejoin
 * per line item through the click map.
 */

export interface PurchaseItem {
  id: string | number;
  price?: number;
  quantity?: number;
}

export interface PurchaseData {
  orderId: string | number;
  /** Order total. Derived from items (Σ price × quantity) when omitted. */
  amount?: number;
  currency?: string;
  items?: PurchaseItem[];
}

const SESSION_KEY = 'sparq:session';
const SESSION_WINDOW_MS = 30 * 60 * 1000; // st-tracking's own session window
const SENT_QUERY_CAP = 200;

export class Insights {
  private client: InsightsClient;
  /** queryIds already reported — cache replays (back button, pagination back) must not double-count a search. */
  private sentQueries = new Set<string>();

  constructor(cfg: InsightsConfig) {
    this.client = new InsightsClient(cfg);
  }

  /** Subscribe to a controller's bus. Returns a detach function. */
  attach(controller: SearchController): () => void {
    const offSearch = controller.on('search', (detail) => {
      const d = detail as { results?: { queryId?: string; totalItems: number; processingTimeMs: number; forUiState: { query: string; facetFilters: Record<string, string[]>; numericFilters: Record<string, unknown> } } };
      const r = d?.results;
      if (!r?.queryId || this.sentQueries.has(r.queryId)) return;
      this.rememberQuery(r.queryId);
      this.touchSession();
      this.client.send('search-query', {
        search: {
          query: r.forUiState.query,
          queryId: r.queryId,
          responseTime: r.processingTimeMs,
          totalHits: r.totalItems,
        },
      });
      if (r.totalItems === 0) {
        const filtered =
          Object.keys(r.forUiState.facetFilters ?? {}).length > 0 ||
          Object.keys(r.forUiState.numericFilters ?? {}).length > 0;
        this.client.send('empty-search-query', {
          search: { query: r.forUiState.query, queryId: r.queryId, isFilterApplied: filtered },
        });
      }
    });

    const offClick = controller.on('item-click', (detail) => {
      const d = detail as { item?: Item; index?: number; queryId?: string };
      if (!d?.item) return;
      const itemId = String(d.item.id ?? '');
      if (!itemId) return;
      if (d.queryId) rememberClick(itemId, d.queryId);
      this.client.send('product-clicked', {
        click: { queryId: d.queryId, itemId, position: (d.index ?? 0) + 1 },
      });
    });

    return () => {
      offSearch();
      offClick();
    };
  }

  /**
   * Report a completed order (call on the confirmation page). Each line item
   * is attributed to the search whose result was clicked within the
   * attribution window; unmatched items still count toward total revenue.
   */
  purchase(data: PurchaseData): void {
    if (!data || data.orderId === undefined || data.orderId === null || data.orderId === '') return;
    const items = (data.items ?? []).map((it) => {
      const id = String(it.id);
      const queryId = queryIdFor(id);
      const entry: Record<string, unknown> = { id, price: it.price, quantity: it.quantity ?? 1 };
      if (queryId) entry.queryId = queryId;
      return entry;
    });
    const derived = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
    this.client.send('purchase-complete', {
      order: {
        orderId: String(data.orderId),
        amount: typeof data.amount === 'number' ? data.amount : +derived.toFixed(2),
        currency: data.currency,
        items,
      },
    });
  }

  private rememberQuery(queryId: string): void {
    if (this.sentQueries.size >= SENT_QUERY_CAP) {
      const first = this.sentQueries.values().next().value;
      if (first !== undefined) this.sentQueries.delete(first);
    }
    this.sentQueries.add(queryId);
  }

  /**
   * Emit `search-session` once per 30-minute activity window — the denominator
   * the existing session-based CTR SQL divides by. The window slides on every
   * search, mirroring st-tracking's server-side session semantics.
   */
  private touchSession(): void {
    let last = 0;
    try {
      last = Number(localStorage.getItem(SESSION_KEY)) || 0;
    } catch {
      /* storage unavailable — degrade to one session event per page load via sentinel below */
    }
    const now = Date.now();
    if (now - last >= SESSION_WINDOW_MS) {
      this.client.send('search-session', { session: { startedAt: now } });
    }
    try {
      localStorage.setItem(SESSION_KEY, String(now));
    } catch {
      /* storage unavailable */
    }
  }
}

// ── module-level singleton: lets pages without a <sparq-search> (order
// confirmation) report purchases after a one-line configureInsights() ────────

let singleton: Insights | null = null;

/** Idempotent for identical config; reconfigures on change. */
export function configureInsights(cfg: InsightsConfig): Insights {
  singleton = new Insights(cfg);
  return singleton;
}

export function getInsights(): Insights | null {
  return singleton;
}

/** Convenience for host pages: window.sparq('purchase', …) lands here. */
export function trackPurchase(data: PurchaseData): void {
  singleton?.purchase(data);
}
