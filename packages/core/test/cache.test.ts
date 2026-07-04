import { describe, expect, it } from 'vitest';
import { LruCache } from '../src';
import { sleep } from './helpers';

describe('LruCache', () => {
  it('evicts the least recently used entry beyond capacity', () => {
    const cache = new LruCache<number>(2, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // refresh recency of a
    cache.set('c', 3); // evicts b
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('expires entries after the TTL', async () => {
    const cache = new LruCache<number>(10, 10);
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    await sleep(20);
    expect(cache.get('a')).toBeUndefined();
  });

  it('clear() empties everything', () => {
    const cache = new LruCache<number>(10, 60_000);
    cache.set('a', 1);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
