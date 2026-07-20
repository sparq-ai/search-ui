import { describe, expect, it } from 'vitest';
import { slugifyPart } from '../src/autocomplete/SparqAutocomplete';

// Autocomplete sections all shipped the same part="section", so a host page
// could not style one source differently from another and had to rewrite the
// part attribute from JS. Sections now also carry an index- and title-based
// part; this covers the title half.
describe('slugifyPart', () => {
  it('turns a section title into a usable part token', () => {
    expect(slugifyPart('Categories')).toBe('categories');
    expect(slugifyPart('Top Products')).toBe('top-products');
  });

  it('collapses punctuation and trims stray dashes', () => {
    expect(slugifyPart('Brands & Makers')).toBe('brands-makers');
    expect(slugifyPart('  Spaced  Out  ')).toBe('spaced-out');
    expect(slugifyPart('Price ($)')).toBe('price');
  });

  it('returns empty when nothing usable is left, so the index part is the fallback', () => {
    expect(slugifyPart(undefined)).toBe('');
    expect(slugifyPart(null)).toBe('');
    expect(slugifyPart('')).toBe('');
    expect(slugifyPart('!!!')).toBe('');
  });
});
