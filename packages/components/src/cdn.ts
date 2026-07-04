/**
 * IIFE/CDN entry — the zero-tooling promise: one script tag registers every
 * element and exposes a small global for programmatic use.
 */
import { createMockClient, createSparqClient, SearchController } from '@sparq/search-core';
import { configure, setClient } from './config';
import { register } from './register';

register();

declare const __SPARQ_VERSION__: string;

const api = {
  version: typeof __SPARQ_VERSION__ !== 'undefined' ? __SPARQ_VERSION__ : 'dev',
  register,
  configure,
  setClient,
  createMockClient,
  createSparqClient,
  SearchController,
};

declare global {
  interface Window {
    SparqSearchUI?: typeof api;
  }
}

window.SparqSearchUI = api;

export default api;
