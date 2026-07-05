import { describe, expect, it } from 'vitest';
import { MULTI_CSS, resolveSwatch, type IsCssColor } from '../src/widgets/swatchColors';

// Deterministic predicate: hex codes + a small named set.
const NAMED = new Set(['red', 'blue', 'black', 'white', 'green', 'navy']);
const isColor: IsCssColor = (v) => /^#[0-9a-f]{3,8}$/i.test(v) || NAMED.has(v);

describe('resolveSwatch', () => {
  it('uses the color map first, case-insensitively', () => {
    expect(resolveSwatch('Ocean', { Ocean: '#0ea5e9' }, isColor)).toEqual({ kind: 'color', css: '#0ea5e9' });
    expect(resolveSwatch('ocean', { OCEAN: '#0ea5e9' }, isColor)).toEqual({ kind: 'color', css: '#0ea5e9' });
  });

  it('falls back to the raw value as a CSS color, lowercasing named colors', () => {
    expect(resolveSwatch('red', undefined, isColor)).toEqual({ kind: 'color', css: 'red' });
    expect(resolveSwatch('Red', undefined, isColor)).toEqual({ kind: 'color', css: 'red' });
    expect(resolveSwatch('#ABC', undefined, isColor)).toEqual({ kind: 'color', css: '#ABC' });
  });

  it('builds two-tone gradients from "a/b" codes (map or raw)', () => {
    expect(resolveSwatch('Storm', { Storm: 'black/white' }, isColor)).toEqual({
      kind: 'gradient',
      css: 'linear-gradient(135deg, black 0% 50%, white 50% 100%)',
    });
    expect(resolveSwatch('navy/red', undefined, isColor).kind).toBe('gradient');
  });

  it('rejects gradients with an invalid side', () => {
    expect(resolveSwatch('black/sparkles', undefined, isColor)).toEqual({ kind: 'unknown', css: '' });
  });

  it('handles the multicolor (*) and clear (#) encodings', () => {
    expect(resolveSwatch('Multi', { Multi: '*' }, isColor)).toEqual({ kind: 'multi', css: MULTI_CSS });
    expect(resolveSwatch('*', undefined, isColor).kind).toBe('multi');
    expect(resolveSwatch('Clear', { Clear: '#' }, isColor)).toEqual({ kind: 'clear', css: '' });
  });

  it('returns unknown for unresolvable values (component renders a neutral swatch)', () => {
    expect(resolveSwatch('Sparkly Unicorn', undefined, isColor)).toEqual({ kind: 'unknown', css: '' });
  });

  it('trims mapped codes', () => {
    expect(resolveSwatch('Rose', { Rose: '  #f43f5e  ' }, isColor)).toEqual({ kind: 'color', css: '#f43f5e' });
  });
});
