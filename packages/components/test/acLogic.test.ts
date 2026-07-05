import { describe, expect, it } from 'vitest';
import {
  buildSearchUrl,
  computePanelPlacement,
  moveActive,
  viewAllLabel,
} from '../src/autocomplete/acLogic';

describe('moveActive — wrap matrix', () => {
  it('handles the empty list', () => {
    expect(moveActive(-1, 1, 0)).toBe(-1);
    expect(moveActive(2, -1, 0)).toBe(-1);
  });

  it('enters the list from -1 in both directions', () => {
    expect(moveActive(-1, 1, 5)).toBe(0);
    expect(moveActive(-1, -1, 5)).toBe(4);
  });

  it('wraps at both ends', () => {
    expect(moveActive(4, 1, 5)).toBe(0);
    expect(moveActive(0, -1, 5)).toBe(4);
  });

  it('moves normally in the middle and works with one item', () => {
    expect(moveActive(2, 1, 5)).toBe(3);
    expect(moveActive(0, 1, 1)).toBe(0);
    expect(moveActive(0, -1, 1)).toBe(0);
  });
});

describe('computePanelPlacement', () => {
  const viewport = { width: 1200, height: 800 };

  it('places below the input by default', () => {
    const p = computePanelPlacement({ top: 100, bottom: 140, left: 200, width: 400 }, viewport);
    expect(p.placement).toBe('below');
    expect(p.top).toBe(144);
    expect(p.bottom).toBeUndefined();
    expect(p.left).toBe(200);
    expect(p.minWidth).toBe(400);
    expect(p.maxHeight).toBe(800 - 144 - 8);
  });

  it('flips above when space below is cramped and above is roomier', () => {
    const p = computePanelPlacement({ top: 700, bottom: 740, left: 200, width: 400 }, viewport);
    expect(p.placement).toBe('above');
    expect(p.bottom).toBe(800 - 700 + 4);
    expect(p.top).toBeUndefined();
  });

  it('stays below when both spaces are cramped but below is larger', () => {
    const p = computePanelPlacement({ top: 60, bottom: 100, left: 0, width: 300 }, { width: 1200, height: 240 });
    expect(p.placement).toBe('below');
  });

  it('clamps horizontally into the viewport', () => {
    const p = computePanelPlacement({ top: 100, bottom: 140, left: 1000, width: 400 }, viewport);
    expect(p.left).toBe(1200 - 400 - 8);
    const q = computePanelPlacement({ top: 100, bottom: 140, left: -50, width: 400 }, viewport);
    expect(q.left).toBe(8);
  });

  it('never returns a maxHeight below the floor and shrinks minWidth to fit tiny viewports', () => {
    const p = computePanelPlacement({ top: 10, bottom: 780, left: 0, width: 500 }, viewport);
    expect(p.maxHeight).toBeGreaterThanOrEqual(96);
    const q = computePanelPlacement({ top: 0, bottom: 40, left: 0, width: 900 }, { width: 320, height: 600 });
    expect(q.minWidth).toBe(320 - 16);
  });
});

describe('buildSearchUrl', () => {
  const base = 'https://shop.example.com/collections/all';

  it('appends the query param to a relative search url', () => {
    expect(buildSearchUrl('/search', 'q', 'running shoes', base)).toBe(
      'https://shop.example.com/search?q=running+shoes',
    );
  });

  it('preserves params already on the search url', () => {
    expect(buildSearchUrl('/search?type=product', 'q', 'x', base)).toBe(
      'https://shop.example.com/search?type=product&q=x',
    );
  });

  it('supports custom param names and overwrites an existing one', () => {
    expect(buildSearchUrl('/s?term=old', 'term', 'new', base)).toBe('https://shop.example.com/s?term=new');
  });

  it('encodes reserved characters', () => {
    expect(buildSearchUrl('/search', 'q', 'a&b=c', base)).toBe('https://shop.example.com/search?q=a%26b%3Dc');
  });

  it('accepts absolute search urls on other origins', () => {
    expect(buildSearchUrl('https://other.example.com/find', 'q', 'x', base)).toBe(
      'https://other.example.com/find?q=x',
    );
  });
});

describe('viewAllLabel', () => {
  it('substitutes {count} everywhere', () => {
    expect(viewAllLabel('View all {count} results', 128)).toBe('View all 128 results');
    expect(viewAllLabel('{count} matches — see {count}', 3)).toBe('3 matches — see 3');
    expect(viewAllLabel('Show everything', 9)).toBe('Show everything');
  });
});
