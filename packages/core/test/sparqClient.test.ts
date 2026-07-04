import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSparqClient, defaultUiState, buildRequest } from '../src';

const WIRE_OK = {
  results: [{ id: 1, title: 'Batman #1' }],
  textFacets: {
    system_vendor: [
      { label: 'marvel comics', value: 18462 },
      { label: 'dc comics', value: 11545 },
    ],
  },
  numericFacets: {},
  stats: { price: { min: 1.25, avg: 5.36, max: 600 } },
  totalHits: 40609,
  responseTime: 30,
};

function stubFetch(response: unknown, status = 200) {
  const spy = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(response), { status }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function bodyOf(spy: ReturnType<typeof stubFetch>, call = 0): Record<string, unknown> {
  return JSON.parse(spy.mock.calls[call]![1]!.body as string) as Record<string, unknown>;
}

function req(overrides: Record<string, unknown> = {}) {
  return {
    ...buildRequest(
      defaultUiState(),
      { text: new Set(['system_vendor']), numeric: new Set(['price']) },
      { collection: 'COLL' },
    ),
    ...overrides,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('sparqClient — request wire format (verified against production)', () => {
  it('sends Bearer auth, offset pagination, fields:["*"] default, and stats-only numericFacets', async () => {
    const spy = stubFetch(WIRE_OK);
    const client = createSparqClient({ appId: 'my-app', apiKey: 'pk_key' });
    await client.search(req({ page: 2, itemsPerPage: 10, query: 'batman' }));

    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('https://my-app.fast.sparq.ai/v2');
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer pk_key');
    expect(bodyOf(spy)).toMatchObject({
      query: 'batman',
      collection: 'COLL',
      skip: 20,
      count: 10,
      fields: ['*'],
      textFacets: ['system_vendor'],
      numericFacets: { price: [] }, // empty buckets → response carries stats
    });
  });

  it('translates sort: "field:desc" → "-field" (the API ignores "field:desc")', async () => {
    const spy = stubFetch(WIRE_OK);
    const client = createSparqClient({ appId: 'a', apiKey: 'k' });

    await client.search(req({ sort: 'price:desc' }));
    expect(bodyOf(spy, 0).sort).toEqual(['-price']);

    await client.search(req({ sort: 'title:asc' }));
    expect(bodyOf(spy, 1).sort).toEqual(['title']);

    await client.search(req({ sort: 'title' }));
    expect(bodyOf(spy, 2).sort).toEqual(['title']);
  });

  it('composes numeric ranges into the filter string alongside a user filter', async () => {
    const spy = stubFetch(WIRE_OK);
    const client = createSparqClient({ appId: 'a', apiKey: 'k' });
    await client.search(
      req({ filter: 'in_stock = 1', numericFilters: { price: { min: 5, max: 20 }, discount: { min: 10 } } }),
    );
    expect(bodyOf(spy).filter).toBe('(in_stock = 1) AND price >= 5 AND price <= 20 AND discount >= 10');
  });

  it('respects a custom host override', async () => {
    const spy = stubFetch(WIRE_OK);
    const client = createSparqClient({ appId: 'a', apiKey: 'k', host: 'https://staging.example.com/' });
    await client.search(req());
    expect(spy.mock.calls[0]![0]).toBe('https://staging.example.com/v2' as string);
  });
});

describe('sparqClient — response mapping (verified live shape)', () => {
  it('maps results/totalHits/responseTime and {label,value} facet counts', async () => {
    stubFetch(WIRE_OK);
    const client = createSparqClient({ appId: 'a', apiKey: 'k' });
    const res = await client.search(req());

    expect(res.items).toEqual([{ id: 1, title: 'Batman #1' }]);
    expect(res.totalItems).toBe(40609);
    expect(res.processingTimeMs).toBe(30);
    // label = facet VALUE, value = COUNT
    expect(res.facets.system_vendor).toEqual({ 'marvel comics': 18462, 'dc comics': 11545 });
    // response `stats` → facetStats
    expect(res.facetStats).toEqual({ price: { min: 1.25, max: 600 } });
    expect(res.raw).toMatchObject({ totalHits: 40609 });
  });

  it('normalizes HTTP errors into the SearchError taxonomy', async () => {
    stubFetch({ status: 401, data: 'Invalid API key' }, 401);
    const client = createSparqClient({ appId: 'a', apiKey: 'bad' });
    await expect(client.search(req())).rejects.toMatchObject({
      type: 'auth',
      status: 401,
      message: 'Invalid API key',
      retryable: false,
    });

    stubFetch({}, 429);
    await expect(client.search(req())).rejects.toMatchObject({ type: 'rate-limit', retryable: true });

    stubFetch({}, 500);
    await expect(client.search(req())).rejects.toMatchObject({ type: 'server', retryable: true });
  });

  it('normalizes fetch failures as retryable network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const client = createSparqClient({ appId: 'a', apiKey: 'k' });
    await expect(client.search(req())).rejects.toMatchObject({ type: 'network', retryable: true });
  });
});
