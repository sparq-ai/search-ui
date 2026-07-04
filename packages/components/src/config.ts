import type { SearchHooks, SparqClient } from '@sparq/search-core';

/** Global defaults — lowest precedence in the widget > provider > global chain. */
let globalHooks: SearchHooks = {};
let globalClient: SparqClient | null = null;

export function configure(cfg: { hooks?: SearchHooks }): void {
  if (cfg.hooks) globalHooks = { ...globalHooks, ...cfg.hooks };
}

export function getGlobalHooks(): SearchHooks {
  return globalHooks;
}

/** Replace the network client for every provider (custom transport, tests, demos). */
export function setClient(client: SparqClient | null): void {
  globalClient = client;
}

export function getGlobalClient(): SparqClient | null {
  return globalClient;
}

export function mergeHooks(...layers: (SearchHooks | undefined)[]): SearchHooks {
  const out: SearchHooks = {};
  for (const layer of layers) {
    if (layer) Object.assign(out, layer);
  }
  return out;
}
