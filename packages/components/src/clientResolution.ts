import {
  createMockClient,
  createSparqClient,
  type Item,
  type SearchRequest,
  type SparqClient,
} from '@sparq/search-core';
import { getGlobalClient } from './config';

declare global {
  interface Window {
    /** Playground/demo hook: plain global so it can be set before the CDN script loads. */
    __SPARQ_MOCK__?: {
      data?: Item[];
      /** Per-collection datasets for federated autocomplete demos/tests. */
      collections?: Record<string, Item[]>;
      delayMs?: number;
      suggestions?: string[];
    };
  }
}

export interface ClientHost extends HTMLElement {
  client: SparqClient | null;
}

let sharedMockClient: SparqClient | null = null;

function resolveMockClient(): SparqClient {
  const mock = window.__SPARQ_MOCK__;
  if (!mock || (!mock.data && !mock.collections)) {
    throw {
      type: 'client',
      message:
        '[sparq] api-host="mock:" needs mock data: set window.__SPARQ_MOCK__ = { data: [...] } (or { collections: {...} }) before searching.',
      retryable: false,
    };
  }
  sharedMockClient ??= createMockClient(mock.collections ?? mock.data ?? [], {
    delayMs: mock.delayMs,
    suggestions: mock.suggestions,
  });
  return sharedMockClient;
}

/**
 * Client resolution is lazy (per call) so host pages can set overrides in any
 * order relative to script load: element property > global setClient() >
 * api-host="mock:" > the real Sparq adapter (ARCHITECTURE §5, §9).
 */
export function createLazyClient(el: ClientHost): SparqClient {
  let resolvedClient: SparqClient | null = null;

  const resolve = (): SparqClient => {
    if (el.client) return el.client;
    const global = getGlobalClient();
    if (global) return global;
    if (resolvedClient) return resolvedClient;

    const apiHost = el.getAttribute('api-host');
    if (apiHost?.startsWith('mock:')) return resolveMockClient();

    const appId = el.getAttribute('app-id');
    const apiKey = el.getAttribute('api-key');
    if (!appId || !apiKey) {
      throw {
        type: 'auth',
        message: `[sparq] <${el.tagName.toLowerCase()}> needs app-id and api-key attributes (or a client set via JS).`,
        retryable: false,
      };
    }
    resolvedClient = createSparqClient({ appId, apiKey, host: apiHost ?? undefined });
    return resolvedClient;
  };

  return {
    search: (req: SearchRequest, opts?: { signal?: AbortSignal }) => resolve().search(req, opts),
    suggest: async (query: string, opts?: { signal?: AbortSignal }) => {
      const client = resolve();
      return client.suggest ? client.suggest(query, opts) : [];
    },
  };
}
