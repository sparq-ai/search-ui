import { describe, expect, it } from 'vitest';
import { SearchController } from '../src';
import { recordingClient, response, sleep, tick } from './helpers';

describe('hooks pipeline', () => {
  it('transformRequest modifies the outgoing request', async () => {
    const { client, requests } = recordingClient();
    const c = new SearchController(client, {
      collection: 'products',
      hooks: {
        transformRequest: (req) => ({ ...req, filter: 'in_stock:true' }),
      },
    });
    c.start();
    await tick();
    expect(requests[0]!.filter).toBe('in_stock:true');
  });

  it('transformResponse reshapes server data before it renders', async () => {
    const { client } = recordingClient(() =>
      response({ items: [{ price: 10 }], totalItems: 1 }),
    );
    const c = new SearchController(client, {
      collection: 'products',
      hooks: {
        transformResponse: (res) => ({
          ...res,
          items: res.items.map((it) => ({ ...it, price_display: `$${it.price as number}` })),
        }),
      },
    });
    c.start();
    await tick();
    expect(c.state.results!.items[0]).toEqual({ price: 10, price_display: '$10' });
  });

  it('transformItems decorates items after merge (async hook, still race-guarded)', async () => {
    const { client } = recordingClient(() => response({ items: [{ id: 1 }], totalItems: 1 }));
    const c = new SearchController(client, {
      collection: 'products',
      hooks: {
        transformItems: async (items) => {
          await sleep(5);
          return items.map((it) => ({ ...it, decorated: true }));
        },
      },
    });
    c.start();
    await sleep(20);
    expect(c.state.results!.items[0]).toEqual({ id: 1, decorated: true });
  });

  it('queryHook gates searches until the dev calls search()', async () => {
    const { client, requests } = recordingClient();
    const c = new SearchController(client, {
      collection: 'products',
      debounceMs: 5,
      hooks: {
        queryHook: (q, search) => {
          if (q.length >= 3) search(q.trim());
        },
      },
    });
    c.start();
    await tick();

    c.setQuery('ab');
    await sleep(20);
    expect(requests.length).toBe(1); // gated
    expect(c.state.query).toBe('');

    c.setQuery('  abc  ');
    await sleep(20);
    expect(requests.length).toBe(2);
    expect(requests[1]!.query).toBe('abc');
  });

  it('onError returning false suppresses built-in error state', async () => {
    const failing = {
      async search() {
        throw { type: 'server', status: 500, message: 'boom', retryable: true };
      },
    };
    const seen: unknown[] = [];
    const c = new SearchController(failing, {
      collection: 'products',
      hooks: {
        onError: (err) => {
          seen.push(err);
          return false;
        },
      },
    });
    c.start();
    await tick();
    expect(seen.length).toBe(1);
    expect(c.state.error).toBeNull();
    expect(c.state.status).toBe('idle'); // no prior results
  });

  it('suggestionsSource feeds state.suggestions, capped at 10', async () => {
    const { client } = recordingClient();
    const c = new SearchController(client, {
      collection: 'products',
      hooks: {
        suggestionsSource: () => Array.from({ length: 20 }, (_, i) => `sugg-${i}`),
      },
    });
    await c.fetchSuggestions('su');
    expect(c.state.suggestions.length).toBe(10);
    expect(c.state.suggestions[0]).toBe('sugg-0');

    await c.fetchSuggestions('');
    expect(c.state.suggestions).toEqual([]);
  });
});
