import { describe, expect, it } from 'vitest';
import { dispatchSparqEvent } from '../src/events';

describe('dispatchSparqEvent', () => {
  it('dispatches bubbling + composed CustomEvents with detail', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    let seen: CustomEvent | null = null;
    document.addEventListener('sparq:test', (e) => {
      seen = e as CustomEvent;
    });
    dispatchSparqEvent(el, 'sparq:test', { hello: 'world' });
    expect(seen).not.toBeNull();
    expect(seen!.detail).toEqual({ hello: 'world' });
    expect(seen!.bubbles).toBe(true);
    expect(seen!.composed).toBe(true);
    el.remove();
  });
});
