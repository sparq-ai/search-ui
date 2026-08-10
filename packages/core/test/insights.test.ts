import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchController, type SearchResponse } from '../src';
import { Insights } from '../src/insights/insights';
import { clearClickMap, queryIdFor, rememberClick } from '../src';
import { recordingClient, response, tick } from './helpers';

// The insights module touches window/document/localStorage/fetch; tests run in
// plain Node, so the DOM globals are stubbed. Everything goes through this
// loosely-typed view of globalThis — vitest doesn't typecheck, but core's build
// gate (tsc --noEmit) does, and the stubs are deliberately partial.
const g = globalThis as unknown as Record<string, unknown>;

function stubStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

let sentEvents: { url: string; body: Record<string, unknown> }[];

beforeEach(() => {
  sentEvents = [];
  g.window = g; // insights no-ops without a window
  g.localStorage = stubStorage();
  g.document = { cookie: '' };
  g.fetch = vi.fn((url: unknown, init: { body?: unknown }) => {
    sentEvents.push({ url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> });
    return Promise.resolve({ ok: true });
  });
});

afterEach(() => {
  Reflect.deleteProperty(g, 'window');
  Reflect.deleteProperty(g, 'localStorage');
  Reflect.deleteProperty(g, 'document');
  vi.restoreAllMocks();
});

const cfg = { appId: 'acme', apiKey: 'tok', collection: 'products' };

function eventNames() {
  return sentEvents.map((e) => e.body.eventName);
}
function eventByName(name: string) {
  return sentEvents.find((e) => e.body.eventName === name)?.body;
}

describe('clickMap', () => {
  it('remembers and returns a queryId within the window', () => {
    rememberClick('p1', 'q1');
    expect(queryIdFor('p1')).toBe('q1');
    expect(queryIdFor('p2')).toBeUndefined();
  });

  it('expires entries after the attribution window', () => {
    vi.useFakeTimers();
    rememberClick('p1', 'q1');
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(queryIdFor('p1')).toBeUndefined();
    vi.useRealTimers();
  });

  it('caps stored entries, dropping the oldest', () => {
    for (let i = 0; i < 60; i++) rememberClick(`p${i}`, `q${i}`);
    expect(queryIdFor('p0')).toBeUndefined();
    expect(queryIdFor('p59')).toBe('q59');
  });

  it('survives corrupted storage', () => {
    g.localStorage = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    } as unknown as Storage;
    expect(() => rememberClick('p1', 'q1')).not.toThrow();
    expect(queryIdFor('p1')).toBeUndefined();
    clearClickMap();
  });
});

describe('Insights.attach', () => {
  function controllerWith(respond: (i: number) => SearchResponse) {
    const { client } = recordingClient((_req, i) => respond(i));
    const controller = new SearchController(client, { collection: 'products', debounceMs: 0 });
    const insights = new Insights(cfg);
    const detach = insights.attach(controller);
    return { controller, insights, detach };
  }

  it('sends search-query with the queryId and a session event on the first search', async () => {
    const { controller } = controllerWith(() => response({ queryId: 'q1', totalItems: 3, items: [{ id: 'a' }] }));
    controller.start();
    await tick();
    expect(eventNames()).toContain('search-query');
    expect(eventNames()).toContain('search-session');
    const search = eventByName('search-query') as {
      app: string;
      eventData: { search: Record<string, unknown> };
    };
    expect(search.eventData.search.queryId).toBe('q1');
    expect(search.eventData.search.totalHits).toBe(3);
    expect(search.app).toBe('acme');
  });

  it('does not double-count the same queryId (cache replay)', async () => {
    let calls = 0;
    const { controller } = controllerWith(() => {
      calls++;
      return response({ queryId: 'q-same', totalItems: 1, items: [{ id: 'a' }] });
    });
    controller.start();
    await tick();
    controller.setQuery('shoes');
    await tick();
    await tick();
    expect(calls).toBeGreaterThanOrEqual(1);
    expect(eventNames().filter((n) => n === 'search-query')).toHaveLength(1);
  });

  it('sends empty-search-query when a search has no hits', async () => {
    const { controller } = controllerWith(() => response({ queryId: 'q-empty', totalItems: 0 }));
    controller.start();
    await tick();
    expect(eventNames()).toContain('empty-search-query');
  });

  it('sends product-clicked with position and remembers the click for attribution', async () => {
    const { controller } = controllerWith(() =>
      response({ queryId: 'q1', totalItems: 2, items: [{ id: 'p1' }, { id: 'p2' }] }),
    );
    controller.start();
    await tick();
    controller.trackItemClick({ id: 'p2' }, 1);
    const click = eventByName('product-clicked') as { eventData: { click: Record<string, unknown> } };
    expect(click.eventData.click).toMatchObject({ queryId: 'q1', itemId: 'p2', position: 2 });
    expect(queryIdFor('p2')).toBe('q1');
  });

  it('stops sending after detach', async () => {
    const { controller, detach } = controllerWith(() => response({ queryId: 'q1', totalItems: 1, items: [{ id: 'a' }] }));
    detach();
    controller.start();
    await tick();
    expect(sentEvents).toHaveLength(0);
  });
});

describe('Insights.purchase', () => {
  it('rejoins line items to clicked searches and derives the amount', () => {
    rememberClick('p1', 'q1');
    new Insights(cfg).purchase({
      orderId: 'o-1',
      currency: 'EUR',
      items: [
        { id: 'p1', price: 10, quantity: 2 },
        { id: 'p9', price: 5 },
      ],
    });
    const order = (eventByName('purchase-complete') as { eventData: { order: Record<string, unknown> } }).eventData
      .order;
    expect(order.orderId).toBe('o-1');
    expect(order.amount).toBe(25);
    const items = order.items as Record<string, unknown>[];
    expect(items[0]).toMatchObject({ id: 'p1', queryId: 'q1' });
    expect(items[1]!.queryId).toBeUndefined();
  });

  it('honors an explicit amount and ignores orders without an id', () => {
    const insights = new Insights(cfg);
    insights.purchase({ orderId: '', items: [] });
    expect(sentEvents).toHaveLength(0);
    insights.purchase({ orderId: 7, amount: 99.5 });
    const order = (eventByName('purchase-complete') as { eventData: { order: Record<string, unknown> } }).eventData
      .order;
    expect(order).toMatchObject({ orderId: '7', amount: 99.5 });
  });
});

describe('identity + wire format', () => {
  it('persists the uId cookie across events and sends it as x-st-user', async () => {
    const fetchMock = g.fetch as ReturnType<typeof vi.fn>;
    new Insights(cfg).purchase({ orderId: 'o-1' });
    new Insights(cfg).purchase({ orderId: 'o-2' });
    const users = fetchMock.mock.calls.map(
      (c) => (c[1] as { headers: Record<string, string> }).headers['x-st-user'],
    );
    expect(users[0]).toBeTruthy();
    expect(users[1]).toBe(users[0]);
    const headers = (fetchMock.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(headers.authorization).toBe('Bearer tok');
    expect(sentEvents[0]!.url).toBe('https://events.sparq.ai/v2/events');
    expect(sentEvents[0]!.body).toMatchObject({ app: 'acme', collection: 'products' });
    expect(typeof sentEvents[0]!.body.timeStamp).toBe('number');
  });
});
