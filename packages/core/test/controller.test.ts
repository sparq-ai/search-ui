import { describe, expect, it } from 'vitest';
import { SearchController, type ControllerOptions, type SparqClient } from '../src';
import { deferredClient, recordingClient, response, sleep, tick } from './helpers';

function make(client: SparqClient, options: Partial<ControllerOptions> = {}) {
  return new SearchController(client, { collection: 'products', debounceMs: 10, stalledDelayMs: 10, ...options });
}

describe('SearchController scheduling', () => {
  it('coalesces multiple synchronous intents into one request', async () => {
    const { client, requests } = recordingClient();
    const c = make(client);
    c.start();
    await tick();
    expect(requests.length).toBe(1);

    c.toggleFacetValue('brand', 'Nike');
    c.setSort('price:asc');
    c.setNumericRange('price', { min: 10 });
    await tick();
    expect(requests.length).toBe(2);
    const req = requests[1]!;
    expect(req.facetFilters).toEqual({ brand: ['Nike'] });
    expect(req.sort).toBe('price:asc');
    expect(req.numericFilters).toEqual({ price: { min: 10 } });
  });

  it('debounces query changes to a single trailing request', async () => {
    const { client, requests } = recordingClient();
    const c = make(client, { debounceMs: 20 });
    c.start();
    await tick();

    c.setQuery('s');
    c.setQuery('sh');
    c.setQuery('sho');
    await sleep(60);
    expect(requests.length).toBe(2);
    expect(requests[1]!.query).toBe('sho');
  });

  it('an immediate intent cancels a pending query debounce (state still included)', async () => {
    const { client, requests } = recordingClient();
    const c = make(client, { debounceMs: 50 });
    c.start();
    await tick();

    c.setQuery('shoes');
    c.toggleFacetValue('brand', 'Nike');
    await tick();
    expect(requests.length).toBe(2);
    expect(requests[1]!.query).toBe('shoes');
    await sleep(80);
    expect(requests.length).toBe(2); // debounce timer was cancelled, no duplicate run
  });

  it('does not search before start()', async () => {
    const { client, requests } = recordingClient();
    const c = make(client);
    c.setQuery('early');
    c.toggleFacetValue('brand', 'Nike');
    await sleep(30);
    expect(requests.length).toBe(0);
    c.start();
    await tick();
    expect(requests.length).toBe(1);
    expect(requests[0]!.query).toBe('early');
  });
});

describe('SearchController race handling', () => {
  it('discards stale responses even when the client ignores abort', async () => {
    const { client, calls } = deferredClient({ respectAbort: false });
    const c = make(client);
    c.start();
    await tick();
    c.toggleFacetValue('brand', 'Nike');
    await tick();
    expect(calls.length).toBe(2);

    calls[1]!.resolve(response({ items: [{ id: 'new' }], totalItems: 1 }));
    await tick();
    calls[0]!.resolve(response({ items: [{ id: 'old' }], totalItems: 1 }));
    await tick();

    expect(c.state.results?.items).toEqual([{ id: 'new' }]);
  });

  it('aborts the previous in-flight request when the request changes', async () => {
    const { client, calls } = deferredClient();
    const c = make(client);
    c.start();
    await tick();
    c.toggleFacetValue('brand', 'Nike');
    await tick();

    expect(calls[0]!.signal?.aborted).toBe(true);
    expect(calls[1]!.signal?.aborted).toBe(false);
    calls[1]!.resolve(response());
    await tick();
    expect(c.state.status).toBe('success');
  });

  it('shares one network call between identical concurrent requests', async () => {
    const { client, calls } = deferredClient();
    const c = make(client);
    c.start();
    await tick();
    c.searchNow(); // same state, same key, first still in flight
    await tick();
    expect(calls.length).toBe(1);
    calls[0]!.resolve(response({ totalItems: 7 }));
    await tick();
    expect(c.state.results?.totalItems).toBe(7);
  });
});

describe('SearchController state semantics', () => {
  it('resets page to 0 on refinement changes but not on setPage', async () => {
    const { client, requests } = recordingClient(() => response({ totalItems: 100 }));
    const c = make(client, { itemsPerPage: 10 });
    c.start();
    await tick();

    c.setPage(3);
    await tick();
    expect(requests.at(-1)!.page).toBe(3);

    c.toggleFacetValue('brand', 'Nike');
    await tick();
    expect(requests.at(-1)!.page).toBe(0);
    expect(c.state.page).toBe(0);
  });

  it('retains selected facet values that return zero counts', async () => {
    const { client } = recordingClient(() => response({ facets: { brand: { Nike: 5 } }, totalItems: 5 }));
    const c = make(client);
    c.registerWidget({ role: 'filters', facetAttribute: 'brand' });
    c.start();
    await tick();

    c.toggleFacetValue('brand', 'Vanished');
    await tick();

    const brand = c.state.results!.facets.brand!;
    expect(brand.find((v) => v.value === 'Nike')).toMatchObject({ count: 5, selected: false });
    expect(brand.find((v) => v.value === 'Vanished')).toMatchObject({ count: 0, selected: true });
  });

  it('loadMore appends to accumulatedItems; refinements reset the buffer', async () => {
    const { client } = recordingClient((req) =>
      response({
        items: Array.from({ length: 10 }, (_, i) => ({ id: req.page * 10 + i })),
        totalItems: 30,
      }),
    );
    const c = make(client, { itemsPerPage: 10 });
    c.start();
    await tick();
    expect(c.state.accumulatedItems.length).toBe(10);

    await c.loadMore();
    expect(c.state.page).toBe(1);
    expect(c.state.accumulatedItems.length).toBe(20);
    expect(c.state.results!.items.length).toBe(10);

    c.toggleFacetValue('brand', 'Nike');
    await tick();
    expect(c.state.accumulatedItems.length).toBe(10);
  });

  it('registers widget facets into requests and re-searches when a new facet appears', async () => {
    const { client, requests } = recordingClient();
    const c = make(client);
    c.registerWidget({ role: 'filters', facetAttribute: 'brand' });
    c.start();
    await tick();
    expect(requests[0]!.facets).toEqual(['brand']);

    const unregister = c.registerWidget({ role: 'filters', facetAttribute: 'category' });
    await tick();
    expect(requests.at(-1)!.facets).toEqual(['brand', 'category']);

    unregister();
    c.refresh(); // bust cache — otherwise the original ['brand'] request is a cache hit
    await tick();
    expect(requests.at(-1)!.facets).toEqual(['brand']);
  });
});

describe('SearchController cache', () => {
  it('serves repeated requests from cache and refresh() busts it', async () => {
    const { client, requests } = recordingClient();
    const c = make(client);
    c.start();
    await tick();
    c.toggleFacetValue('brand', 'Nike');
    await tick();
    c.toggleFacetValue('brand', 'Nike'); // back to the original request shape
    await tick();
    expect(requests.length).toBe(2); // third search was a cache hit

    c.refresh();
    await tick();
    expect(requests.length).toBe(3);
  });
});

describe('SearchController status & errors', () => {
  it('goes loading → stalled only after the stall delay, then success', async () => {
    const { client, calls } = deferredClient();
    const c = make(client, { stalledDelayMs: 15 });
    c.start();
    await tick();
    expect(c.state.status).toBe('loading');
    await sleep(30);
    expect(c.state.status).toBe('stalled');
    calls[0]!.resolve(response());
    await tick();
    expect(c.state.status).toBe('success');
  });

  it('normalizes failures into state.error', async () => {
    const client = {
      async search() {
        throw { type: 'server', status: 500, message: 'boom', retryable: true };
      },
    };
    const c = make(client);
    c.start();
    await tick();
    expect(c.state.status).toBe('error');
    expect(c.state.error).toMatchObject({ type: 'server', status: 500 });
  });

  it('emits controller events for provider dispatch', async () => {
    const { client } = recordingClient();
    const c = make(client);
    const seen: string[] = [];
    c.on('search', () => seen.push('search'));
    c.on('query-change', () => seen.push('query-change'));
    c.on('refine', () => seen.push('refine'));
    c.on('page-change', () => seen.push('page-change'));
    c.start();
    await tick();
    c.setQuery('shoes');
    c.toggleFacetValue('brand', 'Nike');
    await sleep(30);
    expect(seen).toContain('search');
    expect(seen).toContain('query-change');
    expect(seen).toContain('refine');
  });
});
