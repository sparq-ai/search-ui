// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { SearchController, attachUrlSync, parseUrlState, serializeUrlState, defaultUiState } from '../src';
import { recordingClient, sleep, tick } from './helpers';

describe('URL state serialization', () => {
  it('round-trips the full state', () => {
    const ui = {
      ...defaultUiState(),
      query: 'running shoes',
      page: 2,
      sort: 'price:asc',
      facetFilters: { brand: ['Nike', 'Adidas'], category: ['Road'] },
      numericFilters: { price: { min: 10, max: 50 } },
    };
    const search = serializeUrlState(ui, '');
    expect(search).toContain('q=running');
    expect(search).toContain('page=3'); // 1-based in URLs
    const parsed = parseUrlState(search);
    expect(parsed.query).toBe('running shoes');
    expect(parsed.page).toBe(2);
    expect(parsed.sort).toBe('price:asc');
    expect(parsed.facetFilters).toEqual({ brand: ['Nike', 'Adidas'], category: ['Road'] });
    expect(parsed.numericFilters).toEqual({ price: { min: 10, max: 50 } });
  });

  it('writes only non-defaults and preserves foreign params', () => {
    const search = serializeUrlState({ ...defaultUiState(), query: 'x' }, '?utm_source=mail&ref=abc');
    expect(search).toContain('utm_source=mail');
    expect(search).toContain('ref=abc');
    expect(search).toContain('q=x');
    expect(search).not.toContain('page=');
    expect(search).not.toContain('sort=');
  });

  it('parses open-ended numeric ranges', () => {
    expect(parseUrlState('?r.price=10-')).toEqual({ numericFilters: { price: { min: 10 } } });
    expect(parseUrlState('?r.price=-50')).toEqual({ numericFilters: { price: { max: 50 } } });
  });
});

describe('attachUrlSync', () => {
  it('applies URL state before the first search and writes refinements back', async () => {
    window.history.replaceState(null, '', '/search?q=boots&f.brand=Nike');
    const { client, requests } = recordingClient();
    const c = new SearchController(client, { collection: 'products' });
    const detach = attachUrlSync(c);

    expect(c.state.query).toBe('boots');
    expect(c.state.facetFilters).toEqual({ brand: ['Nike'] });

    c.start();
    await tick();
    expect(requests[0]!.query).toBe('boots');

    c.toggleFacetValue('category', 'Road');
    await sleep(20);
    expect(window.location.search).toContain('f.category=Road');
    expect(window.location.search).toContain('q=boots');
    detach();
  });

  it('applies popstate navigation back into controller state', async () => {
    window.history.replaceState(null, '', '/search?q=first');
    const { client } = recordingClient();
    const c = new SearchController(client, { collection: 'products' });
    const detach = attachUrlSync(c);
    c.start();
    await tick();

    window.history.replaceState(null, '', '/search?q=second&f.brand=Asics');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await tick();

    expect(c.state.query).toBe('second');
    expect(c.state.facetFilters).toEqual({ brand: ['Asics'] });
    detach();
  });
});
