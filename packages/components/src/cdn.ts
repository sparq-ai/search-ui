/**
 * IIFE/CDN entry — the zero-tooling promise: one script tag registers every
 * element and exposes a small global for programmatic use.
 */
import { AutocompleteController, createMockClient, createSparqClient, SearchController } from '@sparq/search-core';
import { configure, setClient } from './config';
import { register } from './register';

declare const __SPARQ_VERSION__: string;

const api = {
  version: typeof __SPARQ_VERSION__ !== 'undefined' ? __SPARQ_VERSION__ : 'dev',
  register,
  configure,
  setClient,
  createMockClient,
  createSparqClient,
  SearchController,
  AutocompleteController,
};

declare global {
  interface Window {
    SparqSearchUI?: typeof api;
  }
}

// The global MUST exist before register() dispatches sparq:ready — that event
// is the documented moment to call SparqSearchUI.configure()/setClient().
window.SparqSearchUI = api;
register();

export default api;
