import {
  SparqInsights,
  configureInsights as sdkConfigureInsights,
  getInsights as sdkGetInsights,
  trackPurchase as sdkTrackPurchase,
  type InsightsConfig,
  type PurchaseData,
} from '@sparq/analytics-js';
import type { SearchController } from '../controller/SearchController';
import type { Item } from '../state';

/**
 * Insights — automatic search analytics, enabled by the `insights` attribute
 * on <sparq-search> (or configureInsights() on pages without a search
 * element, e.g. order confirmation).
 *
 * The engine — wire client, queryID attribution, click map, session
 * windowing, dedupe — lives in @sparq/analytics-js (the canonical SDK,
 * ARCHITECTURE §20). This module contributes only what is search-ui-specific:
 * the middleware that maps controller bus events onto SDK calls. Counting
 * rules and event taxonomy are documented in the SDK.
 */
export class Insights {
  readonly sdk: SparqInsights;

  constructor(cfgOrSdk: InsightsConfig | SparqInsights) {
    this.sdk = cfgOrSdk instanceof SparqInsights ? cfgOrSdk : new SparqInsights(cfgOrSdk);
  }

  /** Subscribe to a controller's bus. Returns a detach function. */
  attach(controller: SearchController): () => void {
    const offSearch = controller.on('search', (detail) => {
      const d = detail as {
        results?: {
          queryId?: string;
          totalItems: number;
          processingTimeMs: number;
          forUiState: {
            query: string;
            facetFilters: Record<string, string[]>;
            numericFilters: Record<string, unknown>;
          };
        };
      };
      const r = d?.results;
      if (!r) return;
      this.sdk.trackSearch({
        query: r.forUiState.query,
        queryId: r.queryId,
        totalItems: r.totalItems,
        processingTimeMs: r.processingTimeMs,
        isFilterApplied:
          Object.keys(r.forUiState.facetFilters ?? {}).length > 0 ||
          Object.keys(r.forUiState.numericFilters ?? {}).length > 0,
      });
    });

    const offClick = controller.on('item-click', (detail) => {
      const d = detail as { item?: Item; index?: number; queryId?: string };
      if (!d?.item) return;
      const itemId = String(d.item.id ?? '');
      if (!itemId) return;
      this.sdk.trackClick({ itemId, queryId: d.queryId, position: (d.index ?? 0) + 1 });
    });

    return () => {
      offSearch();
      offClick();
    };
  }

  purchase(data: PurchaseData): void {
    this.sdk.purchase(data);
  }
}

// The facade mirrors the SDK singleton so <sparq-search insights> providers
// and window.sparq('purchase', …) share one instance (and its dedupe state).
let facade: Insights | null = null;

/** Idempotent for identical config (delegates to the SDK's singleton). */
export function configureInsights(cfg: InsightsConfig): Insights {
  const sdk = sdkConfigureInsights(cfg);
  if (!facade || facade.sdk !== sdk) facade = new Insights(sdk);
  return facade;
}

export function getInsights(): Insights | null {
  const sdk = sdkGetInsights();
  if (!sdk) return null;
  if (!facade || facade.sdk !== sdk) facade = new Insights(sdk);
  return facade;
}

/** Host-page convenience: window.sparq('purchase', …) lands here. */
export function trackPurchase(data: PurchaseData): void {
  sdkTrackPurchase(data);
}

export type { InsightsConfig, PurchaseData };
export type { PurchaseItem } from '@sparq/analytics-js';
