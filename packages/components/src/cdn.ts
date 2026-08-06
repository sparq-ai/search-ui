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
 * confirmation page. Command-style so future verbs need no API change, and so
 * platform snippets can call it defensively (window.sparq && window.sparq(...)).
 * 'init' configures insights on pages without a <sparq-search> element.
 */
function sparq(command: 'purchase', data: PurchaseData): void;
function sparq(command: 'init', data: InsightsConfig): void;
function sparq(command: string, data: unknown): void {
  if (command === 'purchase') trackPurchase(data as PurchaseData);
  else if (command === 'init') configureInsights(data as InsightsConfig);
  else console.error(`[sparq] unknown command "${command}"`);
}

declare global {
  interface Window {
    SparqSearchUI?: typeof api;
    sparq?: typeof sparq;
  }
}

// The global MUST exist before register() dispatches sparq:ready — that event
// is the documented moment to call SparqSearchUI.configure()/setClient().
window.SparqSearchUI = api;
window.sparq = sparq;
register();

export default api;
