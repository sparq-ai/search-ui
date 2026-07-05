import { describe, expect, it } from 'vitest';
import { AutocompleteController, type AcSourceConfig, type SearchRequest, type SparqClient } from '../src';
import { deferredClient, response, sleep, tick } from './helpers';

const SOURCES: AcSourceConfig[] = [
  { id: 'popular', collection: 'POPULAR', limit: 5, showOn: 'empty' },
  { id: 'products', collection: 'PRODUCTS', limit: 4 },
  { id: 'categories', collection: 'CATEGORIES', limit: 5 },
];

function recordingAcClient(
  respond: (req: SearchRequest) => ReturnType<typeof response> = () => response(),
) {
  const requests: SearchRequest[] = [];
  const client: SparqClient = {
    async search(req) {
      requests.push(req);
      return respond(req);
    },
  };
  return { client, requests };
}

function make(client: SparqClient, overrides: Record<string, unknown> = {}) {
  return new AutocompleteController(client, {
    sources: SOURCES,
    debounceMs: 10,
    minChars: 2,
    ...overrides,
  });
}

const byId = (c: AutocompleteController, id: string) => c.state.sources.find((s) => s.id === id)!;

describe('mode + active-source resolution', () => {
  it('empty focus fires ONLY empty/always sources with query ""', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.focus();
    await tick();
    expect(requests.map((r) => r.collection)).toEqual(['POPULAR']);
    expect(requests[0]!.query).toBe('');
    expect(c.state.mode).toBe('empty');
  });

  it('typing ≥ min-chars fires query/always sources, not empty ones', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    expect(requests.map((r) => r.collection).sort()).toEqual(['CATEGORIES', 'PRODUCTS']);
    expect(c.state.mode).toBe('query');
    expect(byId(c, 'popular').items).toEqual([]);
  });

  it('an "always" source runs in both modes', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client, {
      sources: [...SOURCES, { id: 'pages', collection: 'PAGES', showOn: 'always' }],
    });
    c.focus();
    await tick();
    expect(requests.map((r) => r.collection).sort()).toEqual(['PAGES', 'POPULAR']);
    c.setInput('sh');
    await sleep(30);
    expect(requests.slice(2).map((r) => r.collection).sort()).toEqual(['CATEGORIES', 'PAGES', 'PRODUCTS']);
  });

  it('the inactive band (0 < len < min-chars) fires nothing and clears sections', async () => {
    const { client, requests } = recordingAcClient(() => response({ items: [{ id: 1 }], totalItems: 1 }));
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    expect(byId(c, 'products').items.length).toBe(1);

    c.setInput('s'); // below minChars: 2
    await sleep(30);
    expect(requests.length).toBe(2); // no new requests
    expect(c.state.mode).toBe('inactive');
    expect(byId(c, 'products').items).toEqual([]);
    expect(c.state.status).toBe('idle');
  });
});

describe('debounce + request shape', () => {
  it('a keystroke burst produces ONE run: one request per active source', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.setInput('s');
    c.setInput('sh');
    c.setInput('sho');
    c.setInput('shoe');
    await sleep(40);
    expect(requests.length).toBe(2); // products + categories, once
    expect(requests.every((r) => r.query === 'shoe')).toBe(true);
  });

  it('clearing the input settles IMMEDIATELY (empty mode must not lag)', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.setInput('');
    await tick();
    expect(requests.map((r) => r.collection)).toEqual(['POPULAR']);
  });

  it('source config maps onto the canonical request', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client, {
      sources: [
        {
          id: 'p',
          collection: 'PROD',
          limit: 3,
          searchFields: ['title', 'tags'],
          filter: 'in_stock = 1',
          sort: 'title',
        },
      ],
    });
    c.setInput('sh');
    await sleep(30);
    expect(requests[0]).toMatchObject({
      collection: 'PROD',
      query: 'sh',
      itemsPerPage: 3,
      page: 0,
      sort: 'title',
      searchFields: ['title', 'tags'],
      filter: 'in_stock = 1',
      facets: [],
      numericFacets: [],
    });
  });
});

describe('race handling + aborts', () => {
  it('an out-of-order older run never commits (per source)', async () => {
    const { client, calls } = deferredClient({ respectAbort: false });
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    c.setInput('shoe');
    await sleep(30);
    expect(calls.length).toBe(4); // 2 sources × 2 runs

    // resolve the NEW run first, then the old one
    calls[2]!.resolve(response({ items: [{ id: 'new' }], totalItems: 1 }));
    calls[3]!.resolve(response({ items: [{ id: 'new' }], totalItems: 1 }));
    await tick();
    calls[0]!.resolve(response({ items: [{ id: 'old' }], totalItems: 1 }));
    calls[1]!.resolve(response({ items: [{ id: 'old' }], totalItems: 1 }));
    await tick();

    expect(byId(c, 'products').items).toEqual([{ id: 'new' }]);
    expect(byId(c, 'categories').items).toEqual([{ id: 'new' }]);
    expect(byId(c, 'products').forQuery).toBe('shoe');
  });

  it('a new run aborts the previous run’s in-flight requests', async () => {
    const { client, calls } = deferredClient();
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    c.setInput('shoe');
    await sleep(30);
    expect(calls[0]!.signal?.aborted).toBe(true);
    expect(calls[1]!.signal?.aborted).toBe(true);
    expect(calls[2]!.signal?.aborted).toBe(false);
  });

  it('sources commit progressively as they settle', async () => {
    const { client, calls } = deferredClient();
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    calls[0]!.resolve(response({ items: [{ id: 'p1' }], totalItems: 1 }));
    await tick();
    expect(byId(c, 'products').status).toBe('success');
    expect(byId(c, 'categories').status).toBe('loading');
    expect(c.state.status).toBe('loading'); // aggregate waits for all

    calls[1]!.resolve(response());
    await tick();
    expect(c.state.status).toBe('success');
  });
});

describe('cache', () => {
  it('serves a repeated settled query without network; refocus of empty state is free', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.focus();
    await tick();
    expect(requests.length).toBe(1);
    c.setInput('sh');
    await sleep(30);
    expect(requests.length).toBe(3);
    c.setInput('');
    await tick(); // back to empty mode → POPULAR served from cache
    expect(requests.length).toBe(3);
    c.setInput('sh');
    await sleep(30); // repeat query → cache
    expect(requests.length).toBe(3);
  });

  it('refresh() busts the cache', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.focus();
    await tick();
    c.refresh();
    await tick();
    expect(requests.length).toBe(2);
  });

  it('per-source client overrides never share cache entries with the default client', async () => {
    const shared = recordingAcClient(() => response({ items: [{ from: 'shared' }], totalItems: 1 }));
    const override = recordingAcClient(() => response({ items: [{ from: 'override' }], totalItems: 1 }));
    const c = make(shared.client, {
      sources: [
        { id: 'a', collection: 'SAME' },
        { id: 'b', collection: 'SAME', client: override.client },
      ],
    });
    c.setInput('sh');
    await sleep(30);
    expect(byId(c, 'a').items).toEqual([{ from: 'shared' }]);
    expect(byId(c, 'b').items).toEqual([{ from: 'override' }]);
    expect(shared.requests.length).toBe(1);
    expect(override.requests.length).toBe(1);
  });
});

describe('failure isolation + hooks', () => {
  it('one failing source hides only itself; siblings commit; error event fires', async () => {
    const failing: SparqClient = {
      async search(req) {
        if (req.collection === 'CATEGORIES') throw { type: 'server', status: 500, message: 'boom', retryable: true };
        return response({ items: [{ id: 1 }], totalItems: 1 });
      },
    };
    const errors: unknown[] = [];
    const c = make(failing);
    c.on('error', (d) => errors.push(d));
    c.setInput('sh');
    await sleep(30);
    expect(byId(c, 'products').status).toBe('success');
    expect(byId(c, 'categories').status).toBe('error');
    expect(byId(c, 'categories').items).toEqual([]);
    expect(errors[0]).toMatchObject({ sourceId: 'categories', error: { type: 'server' } });
    expect(c.state.status).toBe('success'); // aggregate still settles
  });

  it('per-source transformItems decorates (async, race-guarded)', async () => {
    const { client } = recordingAcClient(() => response({ items: [{ id: 1 }], totalItems: 1 }));
    const c = make(client, {
      sources: [
        {
          id: 'p',
          collection: 'PROD',
          transformItems: async (items: Record<string, unknown>[]) => {
            await sleep(5);
            return items.map((it) => ({ ...it, decorated: true }));
          },
        },
      ],
    });
    c.setInput('sh');
    await sleep(40);
    expect(byId(c, 'p').items).toEqual([{ id: 1, decorated: true }]);
  });

  it('host transformRequest applies to every source request', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client, {
      transformRequest: (req: SearchRequest) => ({ ...req, filter: 'published = 1' }),
    });
    c.setInput('sh');
    await sleep(30);
    expect(requests.every((r) => r.filter === 'published = 1')).toBe(true);
  });
});

describe('lifecycle', () => {
  it('setSources rebuilds state and re-runs the current mode', async () => {
    const { client, requests } = recordingAcClient();
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    c.setSources([{ id: 'pages', collection: 'PAGES' }]);
    await sleep(30);
    expect(c.state.sources.map((s) => s.id)).toEqual(['pages']);
    expect(requests.at(-1)!.collection).toBe('PAGES');
  });

  it('dispose aborts in-flight work and silences the controller', async () => {
    const { client, calls } = deferredClient();
    const c = make(client);
    c.setInput('sh');
    await sleep(30);
    c.dispose();
    expect(calls[0]!.signal?.aborted).toBe(true);
    c.setInput('shoe'); // no-op after dispose
    await sleep(30);
    expect(calls.length).toBe(2);
  });
});
