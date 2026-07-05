import { describe, expect, it } from 'vitest';
import { createMockClient, defaultUiState, buildRequest } from '../src';

const DATA = [
  { id: 1, name: 'Air Runner', brand: 'Nike', category: 'Road', price: 120 },
  { id: 2, name: 'Air Walker', brand: 'Nike', category: 'Trail', price: 90 },
  { id: 3, name: 'Ultra Boost', brand: 'Adidas', category: 'Road', price: 150 },
  { id: 4, name: 'Gel Kayano', brand: 'Asics', category: 'Road', price: 140 },
];

function req(overrides: Record<string, unknown> = {}) {
  return {
    ...buildRequest(defaultUiState(), { text: new Set(['brand', 'category']), numeric: new Set(['price']) }, { collection: 'products' }),
    ...overrides,
  };
}

describe('mockClient — faithful to backend semantics', () => {
  it('computes DISJUNCTIVE facet counts: own filter excluded, others applied', async () => {
    const client = createMockClient(DATA);
    const res = await client.search(req({ facetFilters: { brand: ['Nike'] } }));

    // items: only Nike
    expect(res.items.every((i) => i.brand === 'Nike')).toBe(true);
    expect(res.totalItems).toBe(2);

    // brand counts ignore the brand filter itself — all brands stay visible
    expect(res.facets.brand).toEqual({ Nike: 2, Adidas: 1, Asics: 1 });

    // category counts DO reflect the Nike filter
    expect(res.facets.category).toEqual({ Road: 1, Trail: 1 });
  });

  it('matches query as substring across string fields', async () => {
    const client = createMockClient(DATA);
    const res = await client.search(req({ query: 'air' }));
    expect(res.totalItems).toBe(2);
  });

  it('applies numeric filters and returns facetStats', async () => {
    const client = createMockClient(DATA);
    const res = await client.search(req({ numericFilters: { price: { min: 100, max: 145 } } }));
    expect(res.items.map((i) => i.id).sort()).toEqual([1, 4]);
    expect(res.facetStats?.price).toEqual({ min: 90, max: 150 });
  });

  it('sorts and paginates', async () => {
    const client = createMockClient(DATA);
    const res = await client.search(req({ sort: 'price:desc', itemsPerPage: 2, page: 1 }));
    expect(res.items.map((i) => i.price)).toEqual([120, 90]);
  });

  it('respects AbortSignal when delayed', async () => {
    const client = createMockClient(DATA, { delayMs: 50 });
    const abort = new AbortController();
    const p = client.search(req(), { signal: abort.signal });
    abort.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('mockClient — multi-collection record datasets', () => {
  const COLLECTIONS = {
    PRODUCTS: DATA,
    CATEGORIES: [
      { title: 'Road running', url: '/c/road' },
      { title: 'Trail running', url: '/c/trail' },
    ],
  };

  it('routes requests to the dataset matching req.collection', async () => {
    const client = createMockClient(COLLECTIONS);
    const products = await client.search(req({ collection: 'PRODUCTS' }));
    const categories = await client.search(req({ collection: 'CATEGORIES', facets: [], numericFacets: [] }));
    expect(products.totalItems).toBe(4);
    expect(categories.totalItems).toBe(2);
    expect(categories.items[0]).toMatchObject({ title: 'Road running' });
  });

  it('unknown collections return empty results, not an error', async () => {
    const client = createMockClient(COLLECTIONS);
    const res = await client.search(req({ collection: 'NOPE', facets: [], numericFacets: [] }));
    expect(res.totalItems).toBe(0);
    expect(res.items).toEqual([]);
  });

  it('array datasets keep serving every collection (back-compat)', async () => {
    const client = createMockClient(DATA);
    const res = await client.search(req({ collection: 'ANYTHING' }));
    expect(res.totalItems).toBe(4);
  });
});
