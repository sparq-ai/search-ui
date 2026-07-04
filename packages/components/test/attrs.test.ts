import { describe, expect, it } from 'vitest';
import { parseBoolAttr, parseListAttr, parseNumAttr, parseOptionsAttr } from '../src/attrs';

describe('parseBoolAttr — presence = true, explicit falsy strings = false', () => {
  it('handles the HTML-author reality', () => {
    expect(parseBoolAttr(null)).toBe(false);
    expect(parseBoolAttr(null, true)).toBe(true);
    expect(parseBoolAttr('')).toBe(true); // bare attribute
    expect(parseBoolAttr('true')).toBe(true);
    expect(parseBoolAttr('false')).toBe(false);
    expect(parseBoolAttr('0')).toBe(false);
    expect(parseBoolAttr('off')).toBe(false);
    expect(parseBoolAttr('no')).toBe(false);
  });
});

describe('parseNumAttr', () => {
  it('parses numbers with fallback', () => {
    expect(parseNumAttr('42', 1)).toBe(42);
    expect(parseNumAttr('abc', 7)).toBe(7);
    expect(parseNumAttr(null, 7)).toBe(7);
    expect(parseNumAttr('', 7)).toBe(7);
  });
});

describe('parseOptionsAttr — value|Label lists and JSON escape hatch', () => {
  it('parses comma lists with optional labels', () => {
    expect(parseOptionsAttr('price:asc|Price ↑, price:desc|Price ↓, relevance')).toEqual([
      { value: 'price:asc', label: 'Price ↑' },
      { value: 'price:desc', label: 'Price ↓' },
      { value: 'relevance', label: 'relevance' },
    ]);
  });

  it('parses JSON when the value starts with [', () => {
    expect(parseOptionsAttr('[{"value":"a","label":"A"}]')).toEqual([{ value: 'a', label: 'A' }]);
  });
});

describe('parseListAttr', () => {
  it('parses comma lists and JSON arrays', () => {
    expect(parseListAttr('name, title,description')).toEqual(['name', 'title', 'description']);
    expect(parseListAttr('["a","b"]')).toEqual(['a', 'b']);
    expect(parseListAttr(null)).toEqual([]);
  });
});
