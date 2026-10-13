import { describe, expect, it, vi } from 'vitest';
import { computed, createApp, h, nextTick, ref, watch, type Ref } from 'vue';
import { useInfiniteSentinel } from '../src/composables/useInfiniteSentinel';

/**
 * The widget drops a sentinel hit that lands mid-request, and the observer
 * never fires again because the sentinel stays in view. These cover the retry
 * that gets loading going again — the scroll-fast-and-it-stops bug.
 */

type Fire = (isIntersecting: boolean) => void;

function mountSentinel(canLoad: Ref<boolean>, loadMore: () => void) {
  let fire: Fire = () => {};
  const disconnect = vi.fn();
  const observe = vi.fn();

  class FakeObserver {
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      fire = (isIntersecting) => cb([{ isIntersecting }]);
    }
    observe = observe;
    disconnect = disconnect;
    unobserve = vi.fn();
    takeRecords = () => [];
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);

  const host = document.createElement('div');
  const app = createApp({
    setup() {
      const sentinel = ref<Element | null>(document.createElement('div'));
      const ready = computed(() => canLoad.value);
      const inView = useInfiniteSentinel(sentinel, () => {
        if (ready.value) loadMore();
      });
      watch(ready, (ok) => {
        if (ok && inView.value) loadMore();
      });
      return () => h('div');
    },
  });
  app.mount(host);

  return { fire, app, observe, disconnect };
}

describe('useInfiniteSentinel', () => {
  it('retries the load when the guard clears while the sentinel is still in view', async () => {
    const canLoad = ref(false);
    const loadMore = vi.fn();
    const { fire } = mountSentinel(canLoad, loadMore);

    fire(true);
    expect(loadMore).not.toHaveBeenCalled();

    canLoad.value = true;
    await nextTick();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('does not load when the guard clears after the sentinel has scrolled away', async () => {
    const canLoad = ref(false);
    const loadMore = vi.fn();
    const { fire } = mountSentinel(canLoad, loadMore);

    fire(true);
    fire(false);

    canLoad.value = true;
    await nextTick();
    expect(loadMore).not.toHaveBeenCalled();
  });

  it('loads immediately when the sentinel appears and nothing is in flight', () => {
    const canLoad = ref(true);
    const loadMore = vi.fn();
    const { fire } = mountSentinel(canLoad, loadMore);

    fire(true);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('stops observing on unmount', () => {
    const canLoad = ref(true);
    const { app, observe, disconnect } = mountSentinel(canLoad, vi.fn());

    expect(observe).toHaveBeenCalledTimes(1);
    app.unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
