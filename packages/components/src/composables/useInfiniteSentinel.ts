import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/**
 * IntersectionObserver lifecycle for `auto` infinite scroll.
 *
 * Returns whether the sentinel is currently in view. Callers need this because
 * the observer only fires on an intersection CHANGE: a scroll that reaches the
 * sentinel while a page is still loading gets rejected by the caller's guard,
 * and nothing re-fires once that guard clears — the sentinel never left the
 * viewport. Watching this ref lets the caller retry when its own state settles.
 */
export function useInfiniteSentinel(
  sentinel: Ref<Element | null>,
  onVisible: () => void,
): Ref<boolean> {
  const intersecting = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.value = entry.isIntersecting;
          if (entry.isIntersecting) onVisible();
        }
      },
      { rootMargin: '200px' },
    );
    if (sentinel.value) observer.observe(sentinel.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
    intersecting.value = false;
  });

  return intersecting;
}
