/**
 * IIFE/CDN entry — the zero-tooling promise: one script tag registers every
 * element and exposes a small global for programmatic use.
 */
import {
  AutocompleteController,
  configureInsights,
  createMockClient,
  createSparqClient,
  SearchController,
  trackPurchase,
  type InsightsConfig,
  type PurchaseData,
} from '@sparq/search-core';
import { configure, setClient } from './config';
import { register } from './register';

declare const __SPARQ_VERSION__: string;

const api = {
  version: typeof __SPARQ_VERSION__ !== 'undefined' ? __SPARQ_VERSION__ : 'dev',
  register,
  configure,
  setClient,
  configureInsights,
  createMockClient,
  createSparqClient,
  SearchController,
  AutocompleteController,
};

/**
 * window.sparq('purchase', {...}) — the one call merchants place on the order
 * confirmation page. Command-style so future verbs need no API change.
 * 'init' configures insights on pages without a <sparq-search> element.
 *
 * Calls made BEFORE this script executes are not lost: host pages use the
 * standard pre-load stub
 *   window.sparq = window.sparq || function(){(window.sparq.q = window.sparq.q || []).push(arguments)};
 * and the queue is drained (in order) the moment the real implementation
 * installs below.
 */
function sparq(command: 'purchase', data: PurchaseData): void;
function sparq(command: 'init', data: InsightsConfig): void;
function sparq(command: string, data: unknown): void {
  if (command === 'purchase') trackPurchase(data as PurchaseData);
  else if (command === 'init') configureInsights(data as InsightsConfig);
  else console.error(`[sparq] unknown command "${command}"`);
}

type SparqStub = typeof sparq & { q?: IArguments[] };

declare global {
  interface Window {
    SparqSearchUI?: typeof api;
    sparq?: SparqStub;
  }
}

// The global MUST exist before register() dispatches sparq:ready — that event
// is the documented moment to call SparqSearchUI.configure()/setClient().
window.SparqSearchUI = api;
const queued = window.sparq?.q;
window.sparq = sparq;
if (Array.isArray(queued)) {
  for (const args of queued) {
    try {
      sparq(args[0] as never, args[1] as never);
    } catch {
      /* one bad queued call must not drop the rest */
    }
  }
}
register();

export default api;
