import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/** IntersectionObserver lifecycle for `auto` infinite scroll. */
export function useInfiniteSentinel(sentinel: Ref<Element | null>, onVisible: () => void): void {
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
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
  });
}
