import { describe, expect, it } from 'vitest';
import { buildRequest, canonicalKey, defaultUiState } from '../src';

describe('buildRequest', () => {
  it('produces a canonical single request from state + registered facets', () => {
    const req = buildRequest(
      { ...defaultUiState(), query: 'shoes', facetFilters: { brand: ['Nike'] } },
      { text: new Set(['category', 'brand']), numeric: new Set(['price']) },
      { collection: 'products', searchFields: ['name'], filter: 'in_stock:true' },
    );
    expect(req).toMatchObject({
      collection: 'products',
      query: 'shoes',
      facets: ['brand', 'category'], // sorted
      numericFacets: ['price'],
      facetFilters: { brand: ['Nike'] },
      searchFields: ['name'],
      filter: 'in_stock:true',
    });
  });
});

describe('canonicalKey', () => {
  it('is insensitive to object key order at every depth', () => {
    const a = canonicalKey({ b: 1, a: { d: [1, 2], c: 'x' } });
    const b = canonicalKey({ a: { c: 'x', d: [1, 2] }, b: 1 });
    expect(a).toBe(b);
  });

  it('distinguishes different values', () => {
    expect(canonicalKey({ q: 'a' })).not.toBe(canonicalKey({ q: 'b' }));
  });
});
